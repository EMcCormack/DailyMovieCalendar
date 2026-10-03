import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

const hour = 60 * 60 * 1000;
export const movieCacheMaxAge = 7 * 24 * hour;
const maxEntries = 200;
type Storage = NonNullable<Parameters<typeof createAsyncStoragePersister>[0]["storage"]>;

function pruneCache(client: PersistedClient): PersistedClient {
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries
        .filter((query) => Date.now() - query.state.dataUpdatedAt < movieCacheMaxAge)
        .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
        .slice(0, maxEntries),
    },
  };
}

export function createMovieQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false } },
  });
  client.setQueryDefaults(["movie-details"], { staleTime: 24 * hour, gcTime: movieCacheMaxAge });
  client.setQueryDefaults(["availability"], { staleTime: hour, gcTime: movieCacheMaxAge });
  return client;
}

export function movieCacheOptions(storage: Storage, apiUrl: string | undefined) {
  return {
    maxAge: movieCacheMaxAge,
    buster: `movie-cache:v1:${apiUrl ?? ""}`,
    persister: createAsyncStoragePersister({
      storage,
      key: "reelritual:movie-cache:v1",
      serialize: (client) => JSON.stringify(pruneCache(client)),
      deserialize: (raw) => pruneCache(JSON.parse(raw)),
    }),
    dehydrateOptions: {
      shouldDehydrateQuery: (query: Parameters<typeof defaultShouldDehydrateQuery>[0]) =>
        defaultShouldDehydrateQuery(query) &&
        query.state.data != null &&
        (query.queryKey[0] === "movie-details" || query.queryKey[0] === "availability"),
      shouldDehydrateMutation: () => false,
    },
  };
}
