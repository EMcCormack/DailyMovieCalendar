import assert from "node:assert/strict";
import test from "node:test";
import {
  Calendar,
  currentDayMovie,
  editCalendar,
  isCalendar,
  parseMovies,
  shuffled,
  startCalendar,
  suggestedStartDay,
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
test("editing a chosen calendar preserves progress only for unchanged days", () => {
  const original = { ...calendar, revealed: [1, 2, 3], watched: [1, 2] };
  const movies = [...original.movies];
  movies[1] = collections[0].movies[0];
  const edited = editCalendar(original, "  My overrides  ", movies);
  assert.equal(edited.name, "My overrides");
  assert.equal(edited.season, original.season);
  assert.equal(edited.year, original.year);
  assert.equal(edited.movies.length, original.movies.length);
  assert.equal(edited.movies[1], collections[0].movies[0]);
  assert.deepEqual(edited.revealed, [1, 3]);
  assert.deepEqual(edited.watched, [1]);
  assert.deepEqual(original.revealed, [1, 2, 3]);
  assert.deepEqual(original.watched, [1, 2]);
  assert.equal(original.movies[1], calendar.movies[1]);
  assert.ok(isCalendar(edited));
});
test("renaming keeps progress while removing or reordering days clears affected progress", () => {
  const original = { ...calendar, revealed: [1, 2, 3], watched: [1, 2, 3] };
  const renamed = editCalendar(original, "Renamed", [...original.movies]);
  assert.deepEqual(renamed.watched, [1, 2, 3]);
  assert.deepEqual(renamed.revealed, [1, 2, 3]);
  const reordered = editCalendar(original, "Reordered", [
    original.movies[1],
    original.movies[0],
    original.movies[2],
  ]);
  assert.deepEqual(reordered.watched, [3]);
  assert.deepEqual(reordered.revealed, [3]);
  const shortened = editCalendar(original, "Shortened", original.movies.slice(0, 1));
  assert.deepEqual(shortened.watched, [1]);
  assert.deepEqual(shortened.revealed, [1]);
  assert.ok(isCalendar(shortened));
});
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

test("new calendars suggest today only within the selected season and year", () => {
  assert.equal(suggestedStartDay("halloween", 2026, new Date(2026, 9, 3)), 3);
  assert.equal(suggestedStartDay("halloween", 2027, new Date(2026, 9, 3)), 1);
  assert.equal(suggestedStartDay("christmas", 2026, new Date(2026, 9, 3)), 1);
  assert.equal(suggestedStartDay("christmas", 2026, new Date(2026, 11, 25)), 25);
  assert.equal(suggestedStartDay("christmas", 2026, new Date(2026, 11, 26)), 1);
});

test("starting October 3 assigns 29 movies to the remaining dates", () => {
  const draft = { ...calendar, startDay: 3, revealed: [1, 2], watched: [1] };
  const started = startCalendar(draft);
  assert.equal(started.movies.length, 29);
  assert.equal(started.startDay, 3);
  assert.deepEqual(started.movies, calendar.movies.slice(0, 29));
  assert.deepEqual(started.revealed, []);
  assert.deepEqual(started.watched, []);
  assert.equal(draft.movies.length, 31);
  assert.deepEqual(draft.watched, [1]);
  assert.ok(isCalendar(started));
  assert.ok(
    isCalendar(JSON.parse(JSON.stringify({ ...started, revealed: [3, 31], watched: [3] }))),
  );
});

test("late-start shuffling samples the full list before filling remaining slots", () => {
  const started = startCalendar({ ...calendar, startDay: 3 }, true, () => 0);
  assert.equal(started.movies.length, 29);
  assert.deepEqual(started.movies, shuffled(calendar.movies, () => 0).slice(0, 29));
  assert.ok(started.movies.includes(calendar.movies[29]));
  assert.equal(new Set(started.movies.map((movie) => movie.id)).size, 29);
  const custom = { ...calendar, startDay: 3, movies: calendar.movies.slice(0, 29) };
  const customShuffled = startCalendar(custom, true, () => 0);
  assert.deepEqual(
    customShuffled.movies.map((movie) => movie.id).sort(),
    custom.movies.map((movie) => movie.id).sort(),
  );
});

test("late-start unlocks and today's movie follow actual dates across midnight", () => {
  const late = startCalendar({ ...calendar, startDay: 3 });
  assert.equal(unlockedDays(late, new Date(2026, 9, 2, 23, 59)), 0);
  assert.equal(currentDayMovie(late, new Date(2026, 9, 2, 23, 59)), undefined);
  assert.equal(unlockedDays(late, new Date(2026, 9, 3)), 1);
  assert.equal(currentDayMovie(late, new Date(2026, 9, 3)), late.movies[0]);
  assert.equal(unlockedDays(late, new Date(2026, 9, 4)), 2);
  assert.equal(currentDayMovie(late, new Date(2026, 9, 4)), late.movies[1]);
  assert.equal(unlockedDays(late, new Date(2026, 9, 31)), 29);
  assert.equal(currentDayMovie(late, new Date(2026, 9, 31)), late.movies[28]);
  assert.equal(unlockedDays(late, new Date(2027, 0, 1)), 29);
  const short = { ...late, movies: late.movies.slice(0, 2) };
  assert.equal(unlockedDays(short, new Date(2026, 9, 5)), 2);
  assert.equal(currentDayMovie(short, new Date(2026, 9, 5)), undefined);
});

test("editing late-start calendars preserves progress at actual dates", () => {
  const original = {
    ...startCalendar({ ...calendar, startDay: 3 }),
    revealed: [3, 4, 31],
    watched: [3, 4],
  };
  const movies = [...original.movies];
  movies[1] = collections[0].movies[0];
  const edited = editCalendar(original, "Late October", movies);
  assert.equal(edited.startDay, 3);
  assert.deepEqual(edited.revealed, [3, 31]);
  assert.deepEqual(edited.watched, [3]);
  assert.ok(isCalendar(edited));
  const shortened = editCalendar(original, "Shorter", original.movies.slice(0, 1));
  assert.deepEqual(shortened.revealed, [3]);
  assert.deepEqual(shortened.watched, [3]);
  assert.ok(isCalendar(shortened));
});

test("saved late-start calendars reject invalid start dates, overflow, and progress", () => {
  const late = startCalendar({ ...calendar, startDay: 3 });
  for (const startDay of [0, -1, 32, 1.5, "3", null]) {
    assert.ok(!isCalendar({ ...late, startDay }));
  }
  assert.ok(!isCalendar({ ...late, movies: calendar.movies }));
  assert.ok(!isCalendar({ ...late, revealed: [2] }));
  assert.ok(!isCalendar({ ...late, watched: [32] }));
  assert.ok(isCalendar(calendar));
});

test("last-day Christmas calendars have one slot and no movie after the holiday", () => {
  const last = startCalendar({ ...calendar, season: "christmas", startDay: 25 });
  assert.equal(last.movies.length, 1);
  assert.equal(unlockedDays(last, new Date(2026, 11, 24, 23, 59)), 0);
  assert.equal(unlockedDays(last, new Date(2026, 11, 25)), 1);
  assert.equal(currentDayMovie(last, new Date(2026, 11, 25)), last.movies[0]);
  assert.equal(currentDayMovie(last, new Date(2026, 11, 26)), undefined);
  assert.ok(isCalendar({ ...last, watched: [25] }));
  assert.ok(!isCalendar({ ...last, startDay: 26 }));
});

test("moving the start date clears progress for movies assigned to different dates", () => {
  const original = {
    ...calendar,
    movies: calendar.movies.slice(0, 3),
    startDay: 3,
    revealed: [3, 4, 5],
    watched: [3, 5],
  };
  for (const startDay of [2, 4]) {
    const edited = editCalendar(original, "Moved", original.movies, startDay);
    assert.equal(edited.startDay, startDay);
    assert.deepEqual(edited.revealed, []);
    assert.deepEqual(edited.watched, []);
    assert.ok(isCalendar(edited));
  }
  assert.deepEqual(original.watched, [3, 5]);
  assert.equal(original.startDay, 3);
});

test("editing the start date preserves progress only for movies still on the same dates", () => {
  const original = {
    ...calendar,
    movies: calendar.movies.slice(0, 3),
    startDay: 3,
    revealed: [3, 4, 5],
    watched: [3, 5],
  };
  const later = editCalendar(original, "Later", original.movies.slice(1), 4);
  assert.deepEqual(later.revealed, [4, 5]);
  assert.deepEqual(later.watched, [5]);
  assert.equal(currentDayMovie(later, new Date(2026, 9, 4)), original.movies[1]);
  assert.ok(isCalendar(later));
  const earlier = editCalendar(
    original,
    "Earlier",
    [collections[0].movies[0], ...original.movies],
    2,
  );
  assert.deepEqual(earlier.revealed, [3, 4, 5]);
  assert.deepEqual(earlier.watched, [3, 5]);
  assert.ok(isCalendar(earlier));
});

test("editing a legacy calendar can move its start date", () => {
  const edited = editCalendar(calendar, "Remaining October", calendar.movies.slice(0, 29), 3);
  assert.equal(edited.startDay, 3);
  assert.equal(unlockedDays(edited, new Date(2026, 9, 3)), 1);
  assert.equal(currentDayMovie(edited, new Date(2026, 9, 3)), calendar.movies[0]);
  assert.ok(isCalendar(edited));
});
