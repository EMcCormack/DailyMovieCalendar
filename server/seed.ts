import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { collections } from "../src/collections";
import { createTokenProvider } from "./secrets";
import { resolveCollections } from "./seed-collections";
async function main() {
  const publish = process.argv.includes("--publish");
  if (publish && !process.env.COLLECTIONS_TABLE)
    throw new Error("Set COLLECTIONS_TABLE before publishing.");
  const token = process.env.TMDB_READ_TOKEN || (await createTokenProvider()());
  const resolved = await resolveCollections(collections, async (movie) => {
    const url = new URL("https://api.themoviedb.org/3/search/movie");
    url.searchParams.set("query", movie.title);
    url.searchParams.set("primary_release_year", String(movie.year));
    url.searchParams.set("include_adult", "false");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`TMDB lookup failed for ${movie.title}`);
    const result = (await response.json()) as {
      results: {
        id: number;
        title: string;
        original_title?: string;
        release_date?: string;
      }[];
    };
    const normalize = (value: string) =>
      value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    return result.results
      .filter(
        (m) =>
          Number(m.release_date?.slice(0, 4)) === movie.year &&
          [m.title, m.original_title || ""].some(
            (t) => normalize(t) === normalize(movie.title),
          ),
      )
      .map((m) => m.id);
  });
  for (const collection of resolved)
    console.log(
      `${collection.id}: ${collection.movies.length} resolved movies`,
    );
  if (!publish) {
    console.log(
      "Dry run complete. No database writes. Use --publish to insert collections.",
    );
    return;
  }
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  for (const collection of resolved) {
    try {
      await client.send(
        new PutCommand({
          TableName: process.env.COLLECTIONS_TABLE!,
          Item: {
            pk: `SEASON#${collection.season}`,
            sk: `COLLECTION#${collection.id}`,
            published: true,
            version: 1,
            collection,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
      console.log(`Published ${collection.id}`);
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      )
        console.log(`Kept existing collection ${collection.id}`);
      else throw error;
    }
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Collection seed failed",
  );
  process.exitCode = 1;
});
