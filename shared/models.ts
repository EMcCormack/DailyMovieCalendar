export type Season = "halloween" | "christmas";
export type Movie = {
  id: string;
  tmdbId?: number;
  posterUrl?: string | null;
  title: string;
  year: number;
  genre: string;
  description?: string;
};
export type Calendar = {
  season: Season;
  year: number;
  name: string;
  movies: Movie[];
  revealed: number[];
  watched: number[];
};

export type Collection = {
  id: string;
  name: string;
  season: Season;
  description: string;
  badge: string;
  emoji: string;
  movies: Movie[];
  color: string;
};
