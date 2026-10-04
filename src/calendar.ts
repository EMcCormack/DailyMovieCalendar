import type { Calendar, Movie, Season } from "../shared/models";
export type { Calendar, Movie, Season } from "../shared/models";
export const seasonInfo = {
  halloween: {
    label: "Halloween",
    month: 9,
    days: 31,
    emoji: "🎃",
    subtitle: "A little fright. A movie every night.",
    color: "#b76236",
  },
  christmas: {
    label: "Christmas",
    month: 11,
    days: 25,
    emoji: "🎄",
    subtitle: "Make room for a little movie magic.",
    color: "#496347",
  },
};
export function suggestedStartDay(season: Season, year: number, now = new Date()): number {
  const info = seasonInfo[season];
  return now.getFullYear() === year && now.getMonth() === info.month && now.getDate() <= info.days
    ? now.getDate()
    : 1;
}
export function startCalendar(calendar: Calendar, shuffle = false, random = Math.random): Calendar {
  const startDay = calendar.startDay ?? 1;
  const capacity = seasonInfo[calendar.season].days - startDay + 1;
  return {
    ...calendar,
    startDay,
    movies: (shuffle ? shuffled(calendar.movies, random) : calendar.movies).slice(0, capacity),
    revealed: [],
    watched: [],
  };
}
export function unlockedDays(calendar: Calendar, now = new Date()) {
  const startDay = calendar.startDay ?? 1;
  const start = new Date(calendar.year, seasonInfo[calendar.season].month, startDay);
  if (now < start) return 0;
  if (now.getFullYear() > calendar.year || now.getMonth() > start.getMonth())
    return calendar.movies.length;
  return Math.min(now.getDate() - startDay + 1, calendar.movies.length);
}
export function currentDayMovie(calendar: Calendar, now = new Date()): Movie | undefined {
  if (now.getFullYear() !== calendar.year || now.getMonth() !== seasonInfo[calendar.season].month)
    return undefined;
  return calendar.movies[now.getDate() - (calendar.startDay ?? 1)];
}
export function shuffled<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function editCalendar(
  calendar: Calendar,
  name: string,
  movies: Movie[],
  startDay = calendar.startDay ?? 1,
): Calendar {
  const unchanged = (day: number) => {
    const previous = calendar.movies[day - (calendar.startDay ?? 1)];
    const next = movies[day - startDay];
    if (!previous || !next) return false;
    return previous.tmdbId && next.tmdbId
      ? previous.tmdbId === next.tmdbId
      : previous.id === next.id;
  };
  return {
    ...calendar,
    name: name.trim(),
    startDay,
    movies,
    revealed: calendar.revealed.filter(unchanged),
    watched: calendar.watched.filter(unchanged),
  };
}
export function parseMovies(text: string): Movie[] {
  const unique = new Set<string>();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(/^(.*?)\s*\((\d{4})\)$/);
      const title = (match?.[1] ?? line).trim();
      const year = match ? Number(match[2]) : 0;
      const id = `${title.toLowerCase()}-${year}`;
      if (!title || unique.has(id)) return [];
      unique.add(id);
      return [{ id, title, year, genre: "Your pick" }];
    });
}
export function isCalendar(value: unknown): value is Calendar {
  if (!value || typeof value !== "object") return false;
  const c = value as Calendar;
  const startDay = c.startDay ?? 1;
  return (
    (c.season === "halloween" || c.season === "christmas") &&
    Number.isInteger(c.year) &&
    typeof c.name === "string" &&
    (c.startDay === undefined || Number.isInteger(c.startDay)) &&
    startDay >= 1 &&
    startDay <= seasonInfo[c.season].days &&
    Array.isArray(c.movies) &&
    c.movies.length <= seasonInfo[c.season].days - startDay + 1 &&
    c.movies.every(
      (m) =>
        m &&
        typeof m.id === "string" &&
        typeof m.title === "string" &&
        typeof m.genre === "string" &&
        typeof m.year === "number" &&
        (m.tmdbId === undefined || (Number.isInteger(m.tmdbId) && m.tmdbId > 0)),
    ) &&
    [c.revealed, c.watched].every(
      (a) =>
        Array.isArray(a) &&
        a.every((d) => Number.isInteger(d) && d >= startDay && d < startDay + c.movies.length),
    )
  );
}
