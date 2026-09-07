import type { Collection, Movie } from "../shared/models";
import { isCollection } from "../shared/validation";
export async function resolveCollections(
  collections: Collection[],
  resolve: (movie: Movie) => Promise<number[]>,
): Promise<Collection[]> {
  const ids = new Map<string, number>();
  const result: Collection[] = [];
  for (const collection of collections) {
    const movies: Movie[] = [];
    for (const movie of collection.movies) {
      const key = `${movie.title}-${movie.year}`;
      let id = movie.tmdbId ?? ids.get(key);
      if (!id) {
        const matches = await resolve(movie);
        if (
          matches.length !== 1 ||
          !Number.isSafeInteger(matches[0]) ||
          matches[0] <= 0
        )
          throw new Error(
            `Review TMDB match for ${movie.title} (${movie.year}); expected one result, got ${matches.length}. No collections have been written.`,
          );
        id = matches[0];
        ids.set(key, id);
      }
      movies.push({ ...movie, id: `tmdb:${id}`, tmdbId: id });
    }
    const resolved = { ...collection, movies };
    if (!isCollection(resolved))
      throw new Error(`Invalid collection ${collection.id}`);
    result.push(resolved);
  }
  return result;
}
