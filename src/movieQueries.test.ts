import assert from "node:assert/strict";
import test from "node:test";
import { QueryObserver } from "@tanstack/react-query";
import { movieAvailabilityOptions, movieDetailsOptions } from "./movieQueries";
import { createMovieQueryClient } from "./queryCache";
import type { Movie } from "./calendar";

test("launch queries preload data and share requests and results with the movie dialog", async (t) => {
  const oldApiUrl = process.env.EXPO_PUBLIC_MOVIE_API_URL;
  process.env.EXPO_PUBLIC_MOVIE_API_URL = "https://movies.example";
  t.after(() => {
    if (oldApiUrl === undefined) delete process.env.EXPO_PUBLIC_MOVIE_API_URL;
    else process.env.EXPO_PUBLIC_MOVIE_API_URL = oldApiUrl;
  });
  const requests: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const url = new URL(input);
    requests.push(url);
    return Response.json(
      url.pathname === "/api/movie"
        ? { overview: "Today's story", posterUrl: "https://images.example/poster.jpg" }
        : { link: "https://watch.example", groups: [] },
    );
  });
  const client = createMovieQueryClient();
  const movie: Movie = { id: "elf", title: "Elf", year: 2003, genre: "Comedy", tmdbId: 10719 };
  const details = movieDetailsOptions(movie);
  const providers = movieAvailabilityOptions(movie, "GB");
  const launchDetails = new QueryObserver(client, details);
  const launchProviders = new QueryObserver(client, providers);
  const unsubscribeDetails = launchDetails.subscribe(() => {});
  const unsubscribeProviders = launchProviders.subscribe(() => {});
  try {
    // Opening the dialog while launch requests run reuses those requests.
    await Promise.all([client.fetchQuery(details), client.fetchQuery(providers)]);
    assert.equal(requests.length, 2);
    assert.ok(requests.every((url) => url.searchParams.get("id") === "10719"));
    assert.equal(
      requests.find((url) => url.pathname === "/api/providers")?.searchParams.get("region"),
      "GB",
    );
    const dialogDetails = new QueryObserver(client, movieDetailsOptions(movie));
    const dialogProviders = new QueryObserver(client, movieAvailabilityOptions(movie, "GB"));
    assert.equal(dialogDetails.getCurrentResult().data?.overview, "Today's story");
    assert.equal(dialogDetails.getCurrentResult().isPending, false);
    assert.equal(dialogProviders.getCurrentResult().data?.link, "https://watch.example");
    await Promise.all([client.fetchQuery(details), client.fetchQuery(providers)]);
    assert.equal(requests.length, 2);
  } finally {
    unsubscribeDetails();
    unsubscribeProviders();
    client.clear();
  }
});

test("preloading waits when there is no saved movie for today", () => {
  assert.equal(movieDetailsOptions(undefined).enabled, false);
  assert.equal(movieAvailabilityOptions(undefined, "US").enabled, false);
});
