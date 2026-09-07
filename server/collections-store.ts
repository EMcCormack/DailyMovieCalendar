import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  type QueryCommandInput,
  type QueryCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import type { Collection } from "../shared/models";
import { isCollection } from "../shared/validation";
import type { CollectionsReader } from "./types";
export type QueryPage = (
  input: QueryCommandInput,
) => Promise<Pick<QueryCommandOutput, "Items" | "LastEvaluatedKey">>;
export function createCollectionsReader(
  tableName: string,
  queryPage: QueryPage,
): CollectionsReader {
  return async (season) => {
    const collections: Collection[] = [];
    let cursor: QueryCommandOutput["LastEvaluatedKey"];
    do {
      const page = await queryPage({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `SEASON#${season}` },
        ExclusiveStartKey: cursor,
      });
      for (const item of page.Items ?? []) {
        if (item.published !== true) continue;
        if (!isCollection(item.collection) || item.collection.season !== season)
          throw new Error("Invalid stored collection");
        collections.push(item.collection);
      }
      cursor = page.LastEvaluatedKey;
    } while (cursor);
    return collections;
  };
}
export function dynamoCollectionsReader(tableName: string): CollectionsReader {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return createCollectionsReader(tableName, (input) =>
    client.send(new QueryCommand(input)),
  );
}
