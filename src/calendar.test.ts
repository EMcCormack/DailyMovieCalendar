import assert from "node:assert/strict";
import test from "node:test";
import {
  Calendar,
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
    parseMovies(
      " Elf (2003)\n\nelf (2003)\nThe Thing (1982)\nThe Thing (2011)",
    ).map((m) => m.year),
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
test("all curated calendars contain a full season of unique movies", () => {
  collections.forEach((c) => {
    assert.equal(c.movies.length, c.season === "halloween" ? 31 : 25);
    assert.equal(new Set(c.movies.map((m) => m.id)).size, c.movies.length);
  });
});
