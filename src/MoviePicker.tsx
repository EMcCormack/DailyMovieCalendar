import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Movie } from "./calendar";
import { searchMovies } from "./providers";
export function MoviePicker({
  movies,
  onChange,
  limit,
  header,
}: {
  movies: Movie[];
  onChange: (movies: Movie[]) => void;
  limit: number;
  header?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const scroll = useRef<ScrollView>(null);
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
  useEffect(() => {
    if (searchReady) scroll.current?.scrollTo({ y: headerHeight.current, animated: false });
  }, [searchReady, debouncedQuery, page, search.dataUpdatedAt]);
  const results = searchReady ? (search.data?.movies ?? []) : [];
  const totalPages = searchReady ? (search.data?.totalPages ?? 0) : 0;
  const busy = searchReady && search.isFetching;
  const error = searchReady && search.error instanceof Error ? search.error.message : "";
  const reload = () => search.refetch();
  const move = (index: number, offset: number) => {
    const next = [...movies];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  return (
    <ScrollView
      ref={scroll}
      style={{ flexShrink: 1 }}
      contentContainerStyle={{ paddingBottom: 28 }}
      stickyHeaderIndices={[1]}
      keyboardShouldPersistTaps="handled"
    >
      <View
        className="px-7 pt-7 pb-4"
        onLayout={(event) => {
          headerHeight.current = event.nativeEvent.layout.height;
        }}
      >
        {header}
      </View>
      <View className="bg-paper px-7 py-3 border-b border-line">
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
                scroll.current?.scrollTo({ y: headerHeight.current, animated: false });
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
                accessibilityLabel={`${added ? "Added" : "Add"} ${movie.title}`}
                disabled={added || movies.length >= limit}
                onPress={() => onChange([...movies, movie])}
                className="p-3"
              >
                <Text
                  className={added || movies.length >= limit ? "text-muted" : "text-moss font-bold"}
                >
                  {added ? "Added" : "Add +"}
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
        <Text className="text-ink font-semibold mt-5 mb-2">
          Your movies · {movies.length} / {limit}
        </Text>
        {!movies.length && (
          <Text className="text-muted mb-3">Search and add your first movie above.</Text>
        )}
        {movies.map((movie, index) => (
          <View key={movie.id} className="flex-row items-center border-b border-line py-2 gap-1">
            <Text className="text-ink flex-1">
              {index + 1}. {movie.title}
            </Text>
            {[-1, 1].map((offset) => (
              <Pressable
                key={offset}
                accessibilityRole="button"
                accessibilityLabel={`Move ${movie.title} ${offset === -1 ? "up" : "down"}`}
                disabled={index + offset < 0 || index + offset >= movies.length}
                onPress={() => move(index, offset)}
                className="p-3"
              >
                <Text
                  style={{
                    opacity: index + offset < 0 || index + offset >= movies.length ? 0.25 : 1,
                  }}
                >
                  {offset === -1 ? "↑" : "↓"}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${movie.title}`}
              onPress={() => onChange(movies.filter((_, i) => i !== index))}
              className="p-3"
            >
              <Text className="text-muted">×</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
