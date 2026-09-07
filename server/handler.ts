import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { createApi } from "./api";
import { dynamoCollectionsReader } from "./collections-store";
import { createTokenProvider } from "./secrets";
import type { Api, CollectionsReader } from "./types";
export function createHandler({
  readCollections,
  getToken,
}: {
  readCollections: CollectionsReader;
  getToken: () => Promise<string>;
}) {
  const publicApi = createApi({ readCollections });
  let movieApi: Api | undefined, previousToken: string | undefined;
  return async (
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyStructuredResultV2> => {
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    };
    if (event.requestContext.http.method !== "GET")
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    const url = new URL(event.rawPath, "https://api.local");
    url.search = event.rawQueryString;
    try {
      let api = publicApi;
      if (
        ["/api/movie", "/api/providers", "/api/movies/search"].includes(
          url.pathname,
        )
      ) {
        const token = await getToken();
        if (!movieApi || token !== previousToken) {
          movieApi = createApi({ token });
          previousToken = token;
        }
        api = movieApi;
      }
      const result = await api(url);
      return {
        statusCode: result.status,
        headers,
        body: JSON.stringify(result.data),
      };
    } catch {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Movie service is temporarily unavailable.",
        }),
      };
    }
  };
}
let runtimeHandler: ReturnType<typeof createHandler> | undefined;
export async function handler(event: APIGatewayProxyEventV2) {
  if (!runtimeHandler) {
    const table = process.env.COLLECTIONS_TABLE;
    if (!table)
      return {
        statusCode: 503,
        body: JSON.stringify({ error: "Collections are not configured." }),
      };
    runtimeHandler = createHandler({
      readCollections: dynamoCollectionsReader(table),
      getToken: createTokenProvider(),
    });
  }
  return runtimeHandler(event);
}
