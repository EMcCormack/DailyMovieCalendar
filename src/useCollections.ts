import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Collection, Season } from "../shared/models";
import { isCollection } from "../shared/validation";
import { collections as bundledCollections } from "./collections";
export function useCollections(season: Season) {
  const base = process.env.EXPO_PUBLIC_MOVIE_API_URL;
  const [reloadVersion, setReloadVersion] = useState(0);
  const request = useMemo(() => ({ season, base, reloadVersion }), [season, base, reloadVersion]);
  const reload = useCallback(() => setReloadVersion((version) => version + 1), []);
  const [state, setState] = useState<{
    season: Season;
    collections: Collection[];
    busy: boolean;
    message: string;
  }>({ season, collections: [], busy: !!base, message: "" });
  useEffect(() => {
    const { season, base } = request;
    if (!base) {
      setState({
        season,
        collections: bundledCollections.filter((c) => c.season === season),
        busy: false,
        message: "Local demo collections",
      });
      return;
    }
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    const key = `reelritual:collections:${season}`;
    let cached: Collection[] = [];
    const valid = (data: unknown): data is Collection[] =>
      Array.isArray(data) && data.every((c) => isCollection(c) && c.season === season);
    setState({ season, collections: [], busy: true, message: "" });
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        const data: unknown = raw ? JSON.parse(raw) : [];
        if (valid(data)) cached = data;
      } catch {
        /* Cache is optional. */
      }
      if (!active) return;
      setState({ season, collections: cached, busy: true, message: "" });
      try {
        const url = new URL("/api/collections", base);
        url.searchParams.set("season", season);
        const response = await fetch(url.toString(), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Collections unavailable");
        const data = (await response.json()) as { collections?: unknown };
        if (!valid(data.collections)) throw new Error("Invalid collections");
        if (!active) return;
        setState({
          season,
          collections: data.collections,
          busy: false,
          message: data.collections.length
            ? ""
            : "No collections have been published for this season yet.",
        });
        await AsyncStorage.setItem(key, JSON.stringify(data.collections)).catch(() => {});
      } catch {
        if (active)
          setState({
            season,
            collections: cached,
            busy: false,
            message: cached.length
              ? "Offline — showing your last downloaded collections."
              : "Could not load collections. Please try again.",
          });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [request]);
  return {
    ...(state.season === season ? state : { collections: [], busy: true, message: "" }),
    retry: reload,
  };
}
