import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { type Movie, type Season, shuffled } from "./calendar";
import { Ionicons } from "@expo/vector-icons";
import DraggableFlatList from "react-native-draggable-flatlist";
import { FlatList } from "react-native-gesture-handler";
import { searchMovies } from "./providers";
import { MovieDragTarget } from "./MovieDragTarget";
export function MoviePicker({
  movies,
  onChange,
  limit,
  header,
  onSelect,
  startDay = 1,
  season,
  onDragStateChange,
}: {
  movies: Movie[];
  onChange: (movies: Movie[]) => void;
  limit: number;
  header?: ReactNode;
  onSelect?: (movie: Movie) => void;
  startDay?: number;
  season?: Season;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [replacing, setReplacing] = useState<number | null>(null);
  const scroll = useRef<FlatList<Movie>>(null);
  const headerHeight = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const searchReady = debouncedQuery.length >= 2 && query.trim() === debouncedQuery;
  const search = useQuery({
    queryKey: ["movie-search", debouncedQuery, page],
    queryFn: ({ signal }) => searchMovies(debouncedQuery, page, signal),
    enabled: searchReady,
    retry: 1,
  });
  // Reposition for each query, page, and result refresh, including cached results.
  const searchScrollKey = searchReady ? `${debouncedQuery}:${page}:${search.dataUpdatedAt}` : null;
  useEffect(() => {
    if (searchScrollKey !== null)
      scroll.current?.scrollToOffset({ offset: headerHeight.current, animated: false });
  }, [searchScrollKey]);
  const results = searchReady ? (search.data?.movies ?? []) : [];
  const totalPages = searchReady ? (search.data?.totalPages ?? 0) : 0;
  const busy = searchReady && search.isFetching;
  const error = searchReady && search.error instanceof Error ? search.error.message : "";
  const reload = () => search.refetch();
  const announcePosition = (movie: Movie, index: number) =>
    AccessibilityInfo.announceForAccessibility(
      index < limit
        ? `${movie.title} moved to day ${index + startDay}`
        : `${movie.title} moved outside the remaining dates`,
    );
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= movies.length) return;
    const next = [...movies];
    const [movie] = next.splice(index, 1);
    next.splice(target, 0, movie);
    setReplacing(null);
    onChange(next);
    announcePosition(movie, target);
  };
  const listHeader = (
    <View>
      <View
        className="px-7 pt-7 pb-4"
        onLayout={(event) => {
          headerHeight.current = event.nativeEvent.layout.height;
        }}
      >
        {header}
      </View>
      <View className="bg-paper px-7 py-3 border-b border-line">
        {replacing !== null && (
          <View className="flex-row items-center gap-3 mb-3">
            <Text className="text-ink flex-1">
              Replace day {replacing + startDay}: {movies[replacing]?.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel movie replacement"
              onPress={() => setReplacing(null)}
              className="p-2"
            >
              <Text className="text-moss">Cancel</Text>
            </Pressable>
          </View>
        )}
        <View className="flex-row items-center bg-white border border-line rounded-xl">
          <TextInput
            accessibilityLabel="Search movies"
            placeholder="Search TMDB for a movie…"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setPage(1);
            }}
            maxLength={200}
            className="flex-1 p-4 text-ink"
          />
          {!!query && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear movie search"
              onPress={() => {
                setQuery("");
                setDebouncedQuery("");
                setPage(1);
                scroll.current?.scrollToOffset({ offset: headerHeight.current, animated: false });
              }}
              className="p-4"
            >
              <Text className="text-moss text-xl">×</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View className="px-7">
        {busy && (
          <ActivityIndicator
            accessibilityLabel="Searching movies"
            className="my-4"
            color="#496347"
          />
        )}
        {!!error && (
          <View className="my-3">
            <Text className="text-red-700">{error}</Text>
            <Pressable accessibilityRole="button" onPress={reload}>
              <Text className="text-moss underline py-3">Retry search</Text>
            </Pressable>
          </View>
        )}
        {!busy && searchReady && search.isSuccess && !results.length && (
          <Text className="text-muted my-3">No movies found. Try another title.</Text>
        )}
        {results.map((movie) => {
          const added = movies.some(
            (m) =>
              m.tmdbId === movie.tmdbId ||
              (m.title.toLowerCase() === movie.title.toLowerCase() && m.year === movie.year),
          );
          return (
            <View key={movie.id} className="flex-row gap-3 items-center border-b border-line py-3">
              {movie.posterUrl ? (
                <Image
                  source={{ uri: movie.posterUrl }}
                  accessibilityLabel={`${movie.title} poster`}
                  style={{ width: 48, height: 72, borderRadius: 5 }}
                />
              ) : (
                <Text style={{ width: 48, fontSize: 28 }}>🎬</Text>
              )}
              <View className="flex-1">
                <Text className="text-ink font-semibold">
                  {movie.title} {movie.year ? `(${movie.year})` : ""}
                </Text>
                <Text numberOfLines={2} className="text-muted text-xs mt-1">
                  {movie.description || "No synopsis available."}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${added ? "Added" : onSelect ? "Replace with" : replacing !== null ? `Replace day ${replacing + startDay} with` : "Add"} ${movie.title}`}
                disabled={added || (!onSelect && replacing === null && movies.length >= limit)}
                onPress={() => {
                  if (onSelect) {
                    onSelect(movie);
                    return;
                  }
                  onChange(
                    replacing === null
                      ? [...movies, movie]
                      : movies.map((current, index) => (index === replacing ? movie : current)),
                  );
                  setReplacing(null);
                }}
                className="p-3"
              >
                <Text
                  className={
                    added || (!onSelect && replacing === null && movies.length >= limit)
                      ? "text-muted"
                      : "text-moss font-bold"
                  }
                >
                  {added ? "Added" : onSelect || replacing !== null ? "Replace" : "Add +"}
                </Text>
              </Pressable>
            </View>
          );
        })}
        {!busy && totalPages > 1 && (
          <View className="flex-row justify-between items-center my-3">
            <Pressable disabled={page === 1} onPress={() => setPage((current) => current - 1)}>
              <Text className={page === 1 ? "text-muted" : "text-moss"}>Previous</Text>
            </Pressable>
            <Text className="text-muted text-xs">
              Page {page} of {totalPages}
            </Text>
            <Pressable
              disabled={page === totalPages}
              onPress={() => setPage((current) => current + 1)}
            >
              <Text className={page === totalPages ? "text-muted" : "text-moss"}>Next</Text>
            </Pressable>
          </View>
        )}
        {!onSelect && (
          <View className="flex-row items-center justify-between mt-5 mb-2">
            <Text className="text-ink font-semibold">
              Movies · {movies.length} / {limit}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Shuffle movie order"
              disabled={movies.length < 2}
              onPress={() => {
                setReplacing(null);
                onChange(shuffled(movies));
              }}
              className="flex-row items-center gap-1 p-2"
              style={{ opacity: movies.length < 2 ? 0.4 : 1 }}
            >
              <Ionicons name="shuffle" size={18} color="#496347" />
              <Text className="text-moss">Shuffle</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
  return (
    <DraggableFlatList
      ref={scroll}
      containerStyle={{ flex: 1 }}
      data={onSelect ? [] : movies}
      extraData={{ startDay, replacing }}
      keyExtractor={(movie) => movie.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 28 }}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        onSelect ? null : (
          <Text className="text-muted px-7 mt-3">Search and add your first movie above.</Text>
        )
      }
      autoscrollThreshold={80}
      autoscrollSpeed={180}
      onDragBegin={() => {
        setReplacing(null);
        onDragStateChange?.(true);
      }}
      onDragEnd={({ data, from, to }) => {
        onChange(data);
        onDragStateChange?.(false);
        if (from !== to) announcePosition(data[to], to);
      }}
      renderItem={({ item: movie, getIndex, drag, isActive }) => {
        const index = getIndex() ?? movies.findIndex((pick) => pick.id === movie.id);
        const day = index + startDay;
        const scheduled = index < limit;
        return (
          <View
            className="mx-7 flex-row items-center border border-line rounded-xl mb-2 gap-2 px-2"
            style={{ height: 84, backgroundColor: isActive ? "#e7ecdf" : "#fffefb" }}
          >
            <MovieDragTarget
              title={movie.title}
              index={index}
              count={movies.length}
              dateLabel={scheduled ? `Day ${day}` : "Unscheduled"}
              drag={drag}
              isActive={isActive}
              onMove={(offset) => move(index, offset)}
            >
              <View className="items-center" style={{ width: 38 }}>
                <Text className="text-muted text-xs">
                  {!scheduled
                    ? "EXTRA"
                    : season === "halloween"
                      ? "OCT"
                      : season === "christmas"
                        ? "DEC"
                        : "DAY"}
                </Text>
                <Text className="text-moss text-lg font-semibold">{scheduled ? day : "—"}</Text>
              </View>
              <View className="flex-1">
                <Text numberOfLines={2} className="text-ink font-semibold">
                  {movie.title}
                </Text>
                {!!movie.year && <Text className="text-muted text-xs mt-1">{movie.year}</Text>}
              </View>
            </MovieDragTarget>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Replace day ${day}: ${movie.title}`}
              disabled={isActive}
              onPress={() => {
                setReplacing(index);
                setQuery("");
                setDebouncedQuery("");
                setPage(1);
                scroll.current?.scrollToOffset({ offset: headerHeight.current, animated: true });
              }}
              className="p-2"
            >
              <Ionicons name="swap-horizontal-outline" size={20} color="#496347" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${movie.title}`}
              disabled={isActive}
              onPress={() => {
                setReplacing(null);
                onChange(movies.filter((_, i) => i !== index));
              }}
              className="p-2"
            >
              <Ionicons name="close" size={20} color="#7c806f" />
            </Pressable>
          </View>
        );
      }}
    />
  );
}
