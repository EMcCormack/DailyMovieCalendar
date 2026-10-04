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
  /** Day of the season's month; older saved calendars start on day 1. */
  startDay?: number;
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
