import type { Calendar, Movie } from "../shared/models";
export type { Calendar, Movie, Season } from "../shared/models";
export const seasonInfo = {
  halloween: {
    label: "Halloween",
    month: 9,
    days: 31,
    emoji: "🎃",
    subtitle: "A little fright. A nightly ritual.",
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
export function unlockedDays(calendar: Calendar, now = new Date()) {
  const start = new Date(calendar.year, seasonInfo[calendar.season].month, 1);
  if (now < start) return 0;
  if (now.getFullYear() > calendar.year || now.getMonth() > start.getMonth())
    return calendar.movies.length;
  return Math.min(now.getDate(), calendar.movies.length);
}
export function currentDayMovie(calendar: Calendar, now = new Date()): Movie | undefined {
  if (now.getFullYear() !== calendar.year || now.getMonth() !== seasonInfo[calendar.season].month)
    return undefined;
  return calendar.movies[now.getDate() - 1];
}
export function shuffled<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
  return (
    (c.season === "halloween" || c.season === "christmas") &&
    Number.isInteger(c.year) &&
    typeof c.name === "string" &&
    Array.isArray(c.movies) &&
    c.movies.length <= seasonInfo[c.season].days &&
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
        Array.isArray(a) && a.every((d) => Number.isInteger(d) && d > 0 && d <= c.movies.length),
    )
  );
}
