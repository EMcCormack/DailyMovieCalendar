import { createServer } from "node:http";
import { createApi } from "./api";
import { dynamoCollectionsReader } from "./collections-store";
import { collections } from "../src/collections";
const table = process.env.COLLECTIONS_TABLE;
const api = createApi({
  token: process.env.TMDB_READ_TOKEN,
  readCollections: table
    ? dynamoCollectionsReader(table)
    : async (season) => collections.filter((c) => c.season === season),
});
createServer(async (request, response) => {
  response.setHeader(
    "Access-Control-Allow-Origin",
    process.env.ALLOWED_ORIGIN || "*",
  );
  response.setHeader("Content-Type", "application/json");
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.writeHead(204);
    return response.end();
  }
  if (request.method !== "GET") {
    response.writeHead(405);
    return response.end(JSON.stringify({ error: "Method not allowed" }));
  }
  try {
    const result = await api(new URL(request.url || "/", "http://localhost"));
    response.writeHead(result.status);
    response.end(JSON.stringify(result.data));
  } catch {
    response.writeHead(500);
    response.end(JSON.stringify({ error: "Request failed" }));
  }
}).listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log(
    `Movie API ready (${table ? "DynamoDB collections" : "local fixture collections"})`,
  ),
);
