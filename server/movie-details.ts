import type { TmdbMovie } from "./types";
export function movieDetails(movie: TmdbMovie) {
  return {
    posterUrl: movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : null,
    overview: movie.overview?.trim() || null,
  };
}
