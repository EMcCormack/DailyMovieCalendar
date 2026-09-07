import type { Collection, Season } from "../shared/models";
export interface TmdbMovie {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
  adult?: boolean;
}
export interface TmdbSearch {
  page: number;
  total_pages: number;
  results: TmdbMovie[];
}
export interface TmdbProviders {
  results: Record<
    string,
    {
      link: string;
      flatrate?: Provider[];
      free?: Provider[];
      ads?: Provider[];
      rent?: Provider[];
      buy?: Provider[];
    }
  >;
}
interface Provider {
  provider_name: string;
}
export interface ApiResult {
  status: number;
  data: unknown;
}
export type Api = (url: URL) => Promise<ApiResult>;
export type CollectionsReader = (season: Season) => Promise<Collection[]>;
export type Fetcher = (
  url: URL,
  options: RequestInit,
) => Promise<Pick<Response, "ok" | "json">>;
