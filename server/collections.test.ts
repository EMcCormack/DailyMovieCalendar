import test from "node:test";
import assert from "node:assert/strict";
import type { QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { collections } from "../src/collections";
import { createCollectionsReader } from "./collections-store";
import { createApi } from "./api";
import { createHandler } from "./handler";
import { resolveCollections } from "./seed-collections";
const url = (path: string) => new URL(path, "http://localhost");
const collection = collections[0];
test("DynamoDB reader follows pagination, queries one season, and hides drafts", async () => {
  const calls: QueryCommandInput[] = [];
  const reader = createCollectionsReader("collections", async (input) => {
    calls.push(input);
    return calls.length === 1
      ? {
          Items: [{ published: false, collection }],
          LastEvaluatedKey: { pk: "SEASON#christmas", sk: "draft" },
        }
      : { Items: [{ published: true, collection }] };
  });
  assert.deepEqual(await reader("christmas"), [collection]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].ExpressionAttributeValues?.[":pk"], "SEASON#christmas");
  assert.equal(calls[1].ExclusiveStartKey?.sk, "draft");
});
test("invalid published records fail rather than reaching the app", async () => {
  const reader = createCollectionsReader("collections", async () => ({
    Items: [{ published: true, collection: { ...collection, movies: [] } }],
  }));
  await assert.rejects(reader("christmas"), /Invalid stored collection/);
});
test("collections do not depend on TMDB and distinguish empty results from failure", async () => {
  const api = createApi({ readCollections: async () => [] });
  assert.deepEqual(await api(url("/api/collections?season=christmas")), {
    status: 200,
    data: { collections: [] },
  });
  assert.equal((await api(url("/api/collections?season=easter"))).status, 400);
  const unavailable = createApi({
    readCollections: async () => {
      throw new Error("Database unavailable");
    },
  });
  assert.equal((await unavailable(url("/api/collections?season=christmas"))).status, 503);
});
function event(path: string, query = "", method = "GET"): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "GET /api/collections",
    rawPath: path,
    rawQueryString: query,
    headers: {},
    requestContext: {
      accountId: "test",
      apiId: "test",
      domainName: "test",
      domainPrefix: "test",
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "test",
      routeKey: "test",
      stage: "$default",
      time: "",
      timeEpoch: 0,
    },
    isBase64Encoded: false,
  };
}
test("Lambda adapter parses HTTP API events without secrets for public collections", async () => {
  let secrets = 0;
  const handler = createHandler({
    readCollections: async () => [collection],
    getToken: async () => {
      secrets++;
      throw new Error("secret-value-must-not-leak");
    },
  });
  const result = await handler(event("/api/collections", "season=christmas"));
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body!).collections[0].id, collection.id);
  assert.equal(secrets, 0);
  assert.equal((await handler(event("/api/collections", "", "POST"))).statusCode, 405);
  const failure = await handler(event("/api/movie", "id=42"));
  assert.equal(failure.statusCode, 503);
  assert.ok(!failure.body?.includes("secret-value"));
});
test("seed resolves unique titles once, preserves order, and rejects ambiguous IDs", async () => {
  const small = { ...collection, movies: collection.movies.slice(0, 2) };
  let count = 0;
  const result = await resolveCollections([small, { ...small, id: "second" }], async () => [
    ++count,
  ]);
  assert.equal(count, 2);
  assert.equal(result[0].movies[0].title, small.movies[0].title);
  assert.deepEqual(
    result[1].movies.map((m) => m.tmdbId),
    [1, 2],
  );
  assert.equal(small.movies[0].tmdbId, undefined);
  await assert.rejects(
    resolveCollections([small], async () => [1, 2]),
    /Review TMDB match/,
  );
});
