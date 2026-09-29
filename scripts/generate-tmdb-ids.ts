import { collections } from "../src/collections";

// One-off generation: search candidates, then inspect every selected movie by ID.
// These four titles need a reviewed choice because TMDB's release year differs
// from the list year or because another movie has the same title and year.
const reviewedIds = new Map([
  ["Scream|1996", 4232],
  ["The Witch|2015", 310131],
  ["It Follows|2014", 270303],
  ["The Evil Dead|1981", 764],
]);
const token = process.env.TMDB_READ_TOKEN;
if (!token) throw new Error("Set TMDB_READ_TOKEN locally before generating IDs.");
const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`TMDB returned ${response.status} for ${path}`);
  return (await response.json()) as T;
}

type Candidate = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
};
const unique = new Map<string, { title: string; year: number }>();
for (const collection of collections)
  for (const movie of collection.movies)
    unique.set(`${movie.title}|${movie.year}`, { title: movie.title, year: movie.year });

async function main() {
  const results: { title: string; year: number; tmdbId: number; tmdbReleaseDate: string }[] = [];
  for (const [key, movie] of unique) {
    let id = reviewedIds.get(key);
    if (!id) {
      const search = await tmdb<{ results: Candidate[] }>("search/movie", {
        query: movie.title,
        primary_release_year: String(movie.year),
        include_adult: "false",
      });
      const matches = search.results.filter(
        (candidate) =>
          Number(candidate.release_date?.slice(0, 4)) === movie.year &&
          [candidate.title, candidate.original_title || ""].some(
            (title) => normalize(title) === normalize(movie.title),
          ),
      );
      if (matches.length !== 1)
        throw new Error(`Review ${movie.title} (${movie.year}): ${matches.length} exact matches`);
      id = matches[0].id;
    }
    const detail = await tmdb<Candidate & { vote_count: number }>(`movie/${id}`);
    if (normalize(detail.title) !== normalize(movie.title) || detail.vote_count < 100)
      throw new Error(`Review TMDB ID ${id} for ${movie.title} (${movie.year})`);
    results.push({
      title: movie.title,
      year: movie.year,
      tmdbId: id,
      tmdbReleaseDate: detail.release_date || "",
    });
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
