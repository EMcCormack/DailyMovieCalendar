import type {
  Api,
  ApiResult,
  CollectionsReader,
  Fetcher,
  TmdbMovie,
  TmdbSearch,
  TmdbProviders,
} from "./types";
import { isSeason } from "../shared/validation";
import { movieDetails } from "./movie-details";
export function createApi({
  token,
  fetcher = fetch,
  readCollections,
}: {
  token?: string;
  fetcher?: Fetcher;
  readCollections?: CollectionsReader;
}): Api {
  const cache = new Map<string, { data: unknown; expires: number }>();
  async function tmdb<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    const key = url.toString(),
      cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.data as T;
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("TMDB unavailable");
    const data = await response.json();
    if (cache.size >= 1000) cache.clear();
    cache.set(key, {
      data,
      expires: Date.now() + (path === "search/movie" ? 300000 : 3600000),
    });
    return data as T;
  }
  return async function api(url: URL) {
    const send = (status: number, data: unknown): ApiResult => ({
      status,
      data,
    });
    if (url.pathname === "/health") return send(200, { ok: true });
    if (
      ![
        "/api/movie",
        "/api/providers",
        "/api/movies/search",
        "/api/collections",
      ].includes(url.pathname)
    )
      return send(404, { error: "Not found" });
    if (url.pathname === "/api/collections") {
      const season = url.searchParams.get("season");
      if (!isSeason(season))
        return send(400, { error: "Choose halloween or christmas." });
      if (!readCollections)
        return send(503, { error: "Collections are not configured." });
      try {
        return send(200, { collections: await readCollections(season) });
      } catch {
        return send(503, { error: "Collections are temporarily unavailable." });
      }
    }
    const p = url.searchParams;
    const region = p.get("region") || "US",
      id = p.get("id"),
      title = p.get("title")?.trim(),
      year = p.get("year");
    const query = p.get("q")?.trim(),
      page = p.get("page") || "1";
    const search = url.pathname === "/api/movies/search";
    if (
      search
        ? !query ||
          query.length > 200 ||
          !/^\d+$/.test(page) ||
          Number(page) < 1 ||
          Number(page) > 500
        : !["US", "GB", "CA", "AU"].includes(region) ||
          (id
            ? !/^[1-9]\d{0,9}$/.test(id)
            : !title ||
              title.length > 200 ||
              (year && !/^(0|\d{4})$/.test(year)))
    )
      return send(400, { error: "Invalid movie query" });
    if (!token)
      return send(503, { error: "Movie service is not configured yet." });
    try {
      if (search) {
        const result = await tmdb<TmdbSearch>("search/movie", {
          query: query!,
          page,
          include_adult: "false",
          language: "en-US",
        });
        return send(200, {
          page: result.page,
          totalPages: Math.min(result.total_pages, 500),
          movies: result.results
            .filter((m) => !m.adult)
            .map((m) => ({
              id: `tmdb:${m.id}`,
              tmdbId: m.id,
              title: m.title,
              year: Number(m.release_date?.slice(0, 4)) || 0,
              genre: "Your pick",
              description: m.overview || "",
              posterUrl: movieDetails(m).posterUrl,
            })),
        });
      }
      let movieId: string | number | null = id;
      let matched: TmdbMovie | undefined;
      if (!movieId) {
        const result = await tmdb<TmdbSearch>("search/movie", {
          query: title!,
          include_adult: "false",
          ...(year && year !== "0" ? { primary_release_year: year } : {}),
        });
        const normalize = (text: string | undefined) =>
          (text || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
        const matches = result.results.filter(
          (m) =>
            !m.adult &&
            [m.title, m.original_title].some(
              (t) => normalize(t) === normalize(title),
            ),
        );
        if (matches.length !== 1) return send(200, null);
        matched = matches[0];
        movieId = matched.id;
      }
      if (url.pathname === "/api/movie")
        return send(
          200,
          movieDetails(matched || (await tmdb<TmdbMovie>(`movie/${movieId}`))),
        );
      const providers = await tmdb<TmdbProviders>(
        `movie/${movieId}/watch/providers`,
      );
      const available = providers.results[region];
      if (!available) return send(200, null);
      return send(200, {
        link: available.link,
        groups: (
          [
            ["flatrate", "Stream"],
            ["free", "Free"],
            ["ads", "With ads"],
            ["rent", "Rent"],
            ["buy", "Buy"],
          ] as const
        )
          .filter(([key]) => available[key]?.length)
          .map(([key, label]) => ({
            label,
            names: available[key]!.map((p) => p.provider_name),
          })),
      });
    } catch {
      return send(502, {
        error: "Movie service is temporarily unavailable. Please try again.",
      });
    }
  };
}
