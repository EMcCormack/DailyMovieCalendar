import assert from "node:assert/strict";
import test from "node:test";
import {
  Calendar,
  currentDayMovie,
  isCalendar,
  parseMovies,
  shuffled,
  unlockedDays,
} from "./calendar";
import { collections } from "./collections";
const calendar: Calendar = {
  season: "halloween",
  year: 2026,
  name: "Test",
  movies: collections[1].movies,
  revealed: [],
  watched: [],
};
test("unlocks by local calendar date and retains past seasons", () => {
  assert.equal(unlockedDays(calendar, new Date(2026, 8, 30, 23, 59)), 0);
  assert.equal(unlockedDays(calendar, new Date(2026, 9, 1)), 1);
  assert.equal(unlockedDays(calendar, new Date(2026, 9, 31)), 31);
  assert.equal(unlockedDays(calendar, new Date(2027, 0, 1)), 31);
  assert.equal(unlockedDays(calendar, new Date(2025, 11, 31)), 0);
});
test("short Christmas lists stop at their movie count", () => {
  const short = {
    ...calendar,
    season: "christmas" as const,
    movies: calendar.movies.slice(0, 3),
  };
  assert.equal(unlockedDays(short, new Date(2026, 10, 30)), 0);
  assert.equal(unlockedDays(short, new Date(2026, 11, 2)), 2);
  assert.equal(unlockedDays(short, new Date(2026, 11, 25)), 3);
});
test("custom titles preserve remakes and remove duplicate lines", () => {
  assert.deepEqual(
    parseMovies(" Elf (2003)\n\nelf (2003)\nThe Thing (1982)\nThe Thing (2011)").map((m) => m.year),
    [2003, 1982, 2011],
  );
});
test("shuffle preserves every movie without mutating original", () => {
  const items = [1, 2, 3, 4];
  const result = shuffled(items, () => 0);
  assert.deepEqual(items, [1, 2, 3, 4]);
  assert.deepEqual([...result].sort(), items);
  assert.notDeepEqual(result, items);
});
test("saved calendars reject corrupt progress and invalid seasons", () => {
  assert.ok(isCalendar(calendar));
  assert.ok(!isCalendar({ ...calendar, season: "easter" }));
  assert.ok(!isCalendar({ ...calendar, watched: [32] }));
  assert.ok(!isCalendar(null));
});
test("saved calendars round-trip with empty seasons", () => {
  const emptyHalloween: Calendar = { ...calendar, name: "", movies: [] };
  const emptyChristmas: Calendar = { ...emptyHalloween, season: "christmas" };
  for (const halloween of [emptyHalloween, calendar]) {
    const saved = JSON.parse(
      JSON.stringify({
        calendars: { halloween, christmas: emptyChristmas },
        season: "halloween",
        region: "US",
      }),
    );
    assert.ok(isCalendar(saved.calendars.halloween));
    assert.ok(isCalendar(saved.calendars.christmas));
  }
  assert.equal(unlockedDays(emptyHalloween, new Date(2026, 9, 3)), 0);
});
test("empty saved calendars still reject invalid progress", () => {
  const empty: Calendar = { ...calendar, movies: [] };
  assert.ok(!isCalendar({ ...empty, revealed: [1] }));
  assert.ok(!isCalendar({ ...empty, watched: [1] }));
});
test("all curated calendars contain a full season of unique movies", () => {
  collections.forEach((c) => {
    assert.equal(c.movies.length, c.season === "halloween" ? 31 : 25);
    assert.equal(new Set(c.movies.map((m) => m.id)).size, c.movies.length);
  });
});

test("today's movie follows local date boundaries without changing reveal progress", () => {
  const progress = [...calendar.revealed];
  assert.equal(currentDayMovie(calendar, new Date(2026, 9, 1, 0, 0)), calendar.movies[0]);
  assert.equal(currentDayMovie(calendar, new Date(2026, 9, 3, 23, 59)), calendar.movies[2]);
  assert.equal(currentDayMovie(calendar, new Date(2026, 9, 4, 0, 0)), calendar.movies[3]);
  assert.equal(currentDayMovie(calendar, new Date(2026, 8, 30, 23, 59)), undefined);
  assert.equal(currentDayMovie(calendar, new Date(2026, 10, 1)), undefined);
  assert.equal(currentDayMovie(calendar, new Date(2027, 9, 3)), undefined);
  assert.equal(currentDayMovie({ ...calendar, movies: [] }, new Date(2026, 9, 3)), undefined);
  assert.equal(
    currentDayMovie({ ...calendar, movies: calendar.movies.slice(0, 2) }, new Date(2026, 9, 3)),
    undefined,
  );
  assert.deepEqual(calendar.revealed, progress);
});

test("Christmas preloading stops at the end of the movie list", () => {
  const christmas: Calendar = {
    ...calendar,
    season: "christmas",
    movies: calendar.movies.slice(0, 25),
  };
  assert.equal(currentDayMovie(christmas, new Date(2026, 11, 25)), christmas.movies[24]);
  assert.equal(currentDayMovie(christmas, new Date(2026, 11, 26)), undefined);
});
