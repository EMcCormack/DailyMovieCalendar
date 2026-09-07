import { Movie } from "./calendar";
export type Availability = {
  link: string;
  groups: { label: string; names: string[] }[];
};
export type MovieDetails = {
  posterUrl: string | null;
  overview: string | null;
};
export async function getMovieDetails(
  movie: Movie,
  signal: AbortSignal,
): Promise<MovieDetails | null> {
  const base = process.env.EXPO_PUBLIC_MOVIE_API_URL;
  if (!base) return null;
  const url = new URL("/api/movie", base);
  if (movie.tmdbId) url.searchParams.set("id", String(movie.tmdbId));
  url.searchParams.set("title", movie.title);
  url.searchParams.set("year", String(movie.year));
  const response = await fetch(url.toString(), { signal });
  if (!response.ok)
    throw new Error("Movie details are temporarily unavailable.");
  return response.json();
}
export async function getAvailability(
  movie: Movie,
  region: string,
  signal: AbortSignal,
): Promise<Availability | null> {
  const base = process.env.EXPO_PUBLIC_MOVIE_API_URL;
  if (!base) return null;
  const url = new URL("/api/providers", base);
  if (movie.tmdbId) url.searchParams.set("id", String(movie.tmdbId));
  url.searchParams.set("title", movie.title);
  url.searchParams.set("year", String(movie.year));
  url.searchParams.set("region", region);
  const response = await fetch(url.toString(), { signal });
  if (!response.ok)
    throw new Error(
      "Availability is temporarily unavailable. Try the search links below.",
    );
  return response.json();
}
export const watchSearch = (movie: Movie, region: string) =>
  `https://www.justwatch.com/${region.toLowerCase()}/search?q=${encodeURIComponent(movie.title)}`;

export async function searchMovies(
  query: string,
  page: number,
  signal: AbortSignal,
): Promise<{ movies: Movie[]; page: number; totalPages: number }> {
  const base = process.env.EXPO_PUBLIC_MOVIE_API_URL;
  if (!base)
    throw new Error(
      "Movie search is not connected yet. Configure the movie API server to search TMDB.",
    );
  const url = new URL("/api/movies/search", base);
  url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));
  const response = await fetch(url.toString(), { signal });
  if (!response.ok)
    throw new Error(
      response.status === 503
        ? "Movie search is not configured yet."
        : "Movie search is unavailable. Please try again.",
    );
  return response.json();
}
