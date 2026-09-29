import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { collections } from "../src/collections";
import { resolveCollections } from "./seed-collections";
async function main() {
  const publish = process.argv.includes("--publish");
  if (publish && !process.env.COLLECTIONS_TABLE)
    throw new Error("Set COLLECTIONS_TABLE before publishing.");
  const resolved = await resolveCollections(collections, async (movie) => {
    throw new Error(`Missing pinned TMDB ID for ${movie.title} (${movie.year})`);
  });
  for (const collection of resolved)
    console.log(`${collection.id}: ${collection.movies.length} resolved movies`);
  if (!publish) {
    console.log("Dry run complete. No database writes. Use --publish to insert collections.");
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
      if (error instanceof Error && error.name === "ConditionalCheckFailedException")
        console.log(`Kept existing collection ${collection.id}`);
      else throw error;
    }
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Collection seed failed");
  process.exitCode = 1;
});
