import { queryOptions } from "@tanstack/react-query";
import type { Movie } from "./calendar";
import { getAvailability, getMovieDetails } from "./providers";

function movieKey(movie: Movie | undefined) {
  return movie ? String(movie.tmdbId ?? `${movie.title}:${movie.year}`) : null;
}

export function movieDetailsOptions(movie: Movie | undefined) {
  return queryOptions({
    queryKey: ["movie-details", movieKey(movie)],
    queryFn: ({ signal }) => getMovieDetails(movie!, signal),
    enabled: !!movie,
    retry: 1,
  });
}

export function movieAvailabilityOptions(movie: Movie | undefined, region: string) {
  return queryOptions({
    queryKey: ["availability", movieKey(movie), region],
    queryFn: ({ signal }) => getAvailability(movie!, region, signal),
    enabled: !!movie,
    retry: 1,
  });
}
