import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "./api";
const url = (path: string) => new URL(path, "http://localhost");
const movie = {
  id: 42,
  title: "A Movie",
  release_date: "2001-01-01",
  overview: "A story.",
  poster_path: "/poster.jpg",
};
function fixture(responses: Record<string, unknown>) {
  const calls: { url: URL; options: RequestInit }[] = [];
  const api = createApi({
    token: "test-only-token",
    fetcher: async (url, options) => {
      calls.push({ url, options });
      const data = responses[url.pathname];
      if (!data) return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => data };
    },
  });
  return { api, calls };
}
test("search returns stable IDs, metadata, pagination, and excludes adult results", async () => {
  const { api, calls } = fixture({
    "/3/search/movie": {
      page: 2,
      total_pages: 3,
      results: [movie, { ...movie, id: 43, adult: true }],
    },
  });
  const response = await api(url("/api/movies/search?q=A%20Movie&page=2"));
  assert.equal(response.status, 200);
  const data = response.data as {
    movies: { tmdbId: number; posterUrl: string }[];
  };
  assert.equal(data.movies.length, 1);
  assert.equal(data.movies[0].tmdbId, 42);
  assert.equal(data.movies[0].posterUrl, "https://image.tmdb.org/t/p/w500/poster.jpg");
  assert.equal(calls[0].url.searchParams.get("page"), "2");
  assert.equal(
    new Headers(calls[0].options.headers).get("Authorization"),
    "Bearer test-only-token",
  );
  await api(url("/api/movies/search?q=A%20Movie&page=2"));
  assert.equal(calls.length, 1);
});
test("provider lookup uses selected ID and country without title searching", async () => {
  const { api, calls } = fixture({
    "/3/movie/42/watch/providers": {
      results: {
        US: {
          link: "https://www.themoviedb.org/movie/42/watch",
          rent: [{ provider_name: "Example rental" }],
        },
      },
    },
  });
  const result = await api(url("/api/providers?id=42&region=US"));
  assert.deepEqual((result.data as { groups: unknown }).groups, [
    { label: "Rent", names: ["Example rental"] },
  ]);
  assert.equal(calls[0].url.pathname, "/3/movie/42/watch/providers");
  assert.equal((await api(url("/api/providers?id=42&region=CA"))).data, null);
});
test("metadata does not depend on watch providers", async () => {
  const { api, calls } = fixture({ "/3/movie/42": movie });
  assert.equal(
    ((await api(url("/api/movie?id=42"))).data as { overview: string }).overview,
    "A story.",
  );
  assert.equal(calls.length, 1);
});
test("legacy ambiguous titles are not silently assigned the wrong movie", async () => {
  const { api } = fixture({
    "/3/search/movie": { results: [movie, { ...movie, id: 99 }] },
  });
  assert.equal((await api(url("/api/movie?title=A%20Movie"))).data, null);
});
test("invalid IDs/pages are rejected and upstream errors are handled", async () => {
  const { api, calls } = fixture({});
  assert.equal((await api(url("/api/movie?id=../42"))).status, 400);
  assert.equal((await api(url("/api/movies/search?q=Movie&page=501"))).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await api(url("/api/movie?id=42"))).status, 502);
  assert.equal((await createApi({})(url("/api/movies/search?q=Movie"))).status, 503);
});
