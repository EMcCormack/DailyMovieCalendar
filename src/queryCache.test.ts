import assert from "node:assert/strict";
import test from "node:test";
import { QueryObserver } from "@tanstack/react-query";
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";
import { createMovieQueryClient, movieCacheMaxAge, movieCacheOptions } from "./queryCache";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
}
const details = { posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg", overview: "A story" };

test("device cache survives restart without refetching fresh movie data", async () => {
  const storage = memoryStorage();
  const options = movieCacheOptions(storage, "https://movies.example");
  const first = createMovieQueryClient();
  const restarted = createMovieQueryClient();
  try {
    first.setQueryData(["movie-details", "123"], details);
    first.setQueryData(["availability", "123", "US"], { link: "us", groups: [] });
    first.setQueryData(["availability", "123", "GB"], { link: "gb", groups: [] });
    first.setQueryData(["movie-search", "Elf", 1], { movies: [] });
    first.setQueryData(["movie-details", "missing"], null);
    await persistQueryClientSave({ queryClient: first, ...options });
    await persistQueryClientRestore({ queryClient: restarted, ...options });
    let requests = 0;
    const result = await restarted.fetchQuery({
      queryKey: ["movie-details", "123"],
      queryFn: async () => {
        requests++;
        return details;
      },
    });
    assert.deepEqual(result, details);
    assert.equal(requests, 0);
    assert.deepEqual(restarted.getQueryData(["availability", "123", "US"]), {
      link: "us",
      groups: [],
    });
    assert.deepEqual(restarted.getQueryData(["availability", "123", "GB"]), {
      link: "gb",
      groups: [],
    });
    assert.equal(restarted.getQueryData(["movie-search", "Elf", 1]), undefined);
    assert.equal(restarted.getQueryData(["movie-details", "missing"]), undefined);
  } finally {
    first.clear();
    restarted.clear();
  }
});

test("stale cached details remain available throughout a background refresh", async () => {
  const client = createMovieQueryClient();
  client.setQueryData(["movie-details", "123"], details, {
    updatedAt: Date.now() - 25 * 60 * 60 * 1000,
  });
  let finish!: (value: typeof details) => void;
  const response = new Promise<typeof details>((resolve) => {
    finish = resolve;
  });
  const observer = new QueryObserver(client, {
    queryKey: ["movie-details", "123"],
    queryFn: () => response,
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    const result = observer.getCurrentResult();
    assert.deepEqual(result.data, details);
    assert.equal(result.isFetching, true);
    assert.equal(result.isPending, false);
    finish({ ...details, overview: "Updated story" });
    await observer.refetch();
    assert.equal(observer.getCurrentResult().data?.overview, "Updated story");
  } finally {
    unsubscribe();
    client.clear();
  }
});

test("cache drops old entries and keeps only the newest 200", async () => {
  const client = createMovieQueryClient();
  const storage = memoryStorage();
  const options = movieCacheOptions(storage, "api");
  const now = Date.now();
  try {
    client.setQueryData(["movie-details", "expired"], details, {
      updatedAt: now - movieCacheMaxAge - 1,
    });
    for (let id = 0; id < 205; id++) {
      client.setQueryData(["movie-details", String(id)], details, { updatedAt: now - id });
    }
    await persistQueryClientSave({ queryClient: client, ...options });
    const saved = await options.persister.restoreClient();
    assert.equal(saved?.clientState.queries.length, 200);
    assert.equal(
      saved?.clientState.queries.some((query) => query.queryKey[1] === "expired"),
      false,
    );
    assert.equal(
      saved?.clientState.queries.some((query) => query.queryKey[1] === "204"),
      false,
    );
    // The snapshot can still be recent while an individual entry has expired.
    saved!.clientState.queries[0].state.dataUpdatedAt = now - movieCacheMaxAge - 1;
    await storage.setItem("dailymoviecalendar:movie-cache:v1", JSON.stringify(saved));
    assert.equal((await options.persister.restoreClient())?.clientState.queries.length, 199);
  } finally {
    client.clear();
  }
});

test("changing API servers discards the saved movie cache", async () => {
  const storage = memoryStorage();
  const client = createMovieQueryClient();
  const restarted = createMovieQueryClient();
  try {
    client.setQueryData(["movie-details", "123"], details);
    await persistQueryClientSave({ queryClient: client, ...movieCacheOptions(storage, "old-api") });
    await persistQueryClientRestore({
      queryClient: restarted,
      ...movieCacheOptions(storage, "new-api"),
    });
    assert.equal(restarted.getQueryData(["movie-details", "123"]), undefined);
    assert.equal(storage.values.size, 0);
  } finally {
    client.clear();
    restarted.clear();
  }
});

test("watch providers refresh after one hour while movie details stay fresh", async () => {
  const client = createMovieQueryClient();
  const updatedAt = Date.now() - 61 * 60 * 1000;
  client.setQueryData(["movie-details", "123"], details, { updatedAt });
  client.setQueryData(["availability", "123", "US"], { link: "old", groups: [] }, { updatedAt });
  try {
    let detailRequests = 0;
    let providerRequests = 0;
    await client.fetchQuery({
      queryKey: ["movie-details", "123"],
      queryFn: async () => {
        detailRequests++;
        return details;
      },
    });
    await client.fetchQuery({
      queryKey: ["availability", "123", "US"],
      queryFn: async () => {
        providerRequests++;
        return { link: "new", groups: [] };
      },
    });
    assert.equal(detailRequests, 0);
    assert.equal(providerRequests, 1);
    assert.deepEqual(client.getQueryData(["availability", "123", "US"]), {
      link: "new",
      groups: [],
    });
  } finally {
    client.clear();
  }
});
