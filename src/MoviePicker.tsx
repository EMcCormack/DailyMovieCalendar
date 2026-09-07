import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";
import { Movie } from "./calendar";
import { searchMovies } from "./providers";
export function MoviePicker({
  movies,
  onChange,
  limit,
}: {
  movies: Movie[];
  onChange: (movies: Movie[]) => void;
  limit: number;
}) {
  const [request, setRequest] = useState({ query: "", page: 1, reload: 0 });
  const { query, page } = request;
  const [totalPages, setTotalPages] = useState(0);
  const [results, setResults] = useState<Movie[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reload = () => setRequest((current) => ({ ...current, reload: current.reload + 1 }));
  useEffect(() => {
    const { query, page } = request;
    const controller = new AbortController();
    setResults([]);
    setError("");
    setTotalPages(0);
    if (query.trim().length < 2) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const timer = setTimeout(() => {
      searchMovies(query.trim(), page, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data.movies);
            setTotalPages(data.totalPages);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [request]);
  const move = (index: number, offset: number) => {
    const next = [...movies];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  return (
    <View>
      <TextInput
        accessibilityLabel="Search movies"
        placeholder="Search TMDB for a movie…"
        value={query}
        onChangeText={(text) => {
          setRequest((current) => ({ ...current, query: text, page: 1 }));
        }}
        maxLength={200}
        className="bg-white border border-line rounded-xl p-4 text-ink"
      />
      {busy && (
        <ActivityIndicator accessibilityLabel="Searching movies" className="my-4" color="#496347" />
      )}
      {!!error && (
        <View className="my-3">
          <Text className="text-red-700">{error}</Text>
          <Pressable accessibilityRole="button" onPress={reload}>
            <Text className="text-moss underline py-3">Retry search</Text>
          </Pressable>
        </View>
      )}
      {!busy && !error && query.trim().length >= 2 && !results.length && (
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
          <Pressable
            disabled={page === 1}
            onPress={() => setRequest((current) => ({ ...current, page: page - 1 }))}
          >
            <Text className={page === 1 ? "text-muted" : "text-moss"}>Previous</Text>
          </Pressable>
          <Text className="text-muted text-xs">
            Page {page} of {totalPages}
          </Text>
          <Pressable
            disabled={page === totalPages}
            onPress={() => setRequest((current) => ({ ...current, page: page + 1 }))}
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
  );
}
