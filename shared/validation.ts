import type { Collection, Movie, Season } from "./models";
export const isSeason = (value: unknown): value is Season =>
  value === "halloween" || value === "christmas";
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";
export function isMovie(value: unknown): value is Movie {
  if (!object(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.genre === "string" &&
    Number.isInteger(value.year) &&
    (value.tmdbId === undefined ||
      (typeof value.tmdbId === "number" &&
        Number.isSafeInteger(value.tmdbId) &&
        value.tmdbId > 0)) &&
    (value.posterUrl === undefined ||
      value.posterUrl === null ||
      typeof value.posterUrl === "string") &&
    (value.description === undefined || typeof value.description === "string")
  );
}
export function isCollection(value: unknown): value is Collection {
  if (!object(value) || !isSeason(value.season)) return false;
  return (
    ["id", "name", "description", "badge", "emoji", "color"].every(
      (key) => typeof value[key] === "string",
    ) &&
    typeof value.id === "string" &&
    /^[a-z0-9-]{1,80}$/.test(value.id) &&
    typeof value.color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(value.color) &&
    Array.isArray(value.movies) &&
    value.movies.length > 0 &&
    value.movies.length <= (value.season === "halloween" ? 31 : 25) &&
    value.movies.every(isMovie) &&
    new Set(value.movies.map((movie) => movie.tmdbId ?? movie.id)).size === value.movies.length
  );
}
