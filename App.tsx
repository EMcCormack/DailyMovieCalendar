import "./global.css";
import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  Calendar,
  Movie,
  Season,
  isCalendar,
  seasonInfo,
  shuffled,
  unlockedDays,
} from "./src/calendar";
import { MoviePicker } from "./src/MoviePicker";
import { useCollections } from "./src/useCollections";
import { Credits } from "./src/Credits";
import { getMovieDetails, getAvailability, watchSearch } from "./src/providers";

type Tab = "Calendar" | "Collections" | "My list";
const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
});
const defaultSeason: Season = new Date().getMonth() >= 10 ? "christmas" : "halloween";
const emptyCalendar = (season: Season): Calendar => ({
  season,
  year: new Date().getFullYear(),
  name: "",
  movies: [],
  revealed: [],
  watched: [],
});
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`rounded-xl px-5 py-3.5 items-center ${secondary ? "border border-line bg-white" : "bg-moss"}`}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Text className={`font-semibold ${secondary ? "text-ink" : "text-white"}`}>{title}</Text>
    </Pressable>
  );
}
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-ink text-3xl" style={{ fontFamily: serif }}>
      {children}
    </Text>
  );
}
export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <MovieApp />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
function MovieApp() {
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const [calendars, setCalendars] = useState<Record<Season, Calendar>>({
    halloween: emptyCalendar("halloween"),
    christmas: emptyCalendar("christmas"),
  });
  const [season, setSeason] = useState<Season>(defaultSeason);
  const [tab, setTab] = useState<Tab>("Calendar");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [region, setRegion] = useState("US");
  const [now, setNow] = useState(new Date());
  const [selected, setSelected] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  const [pending, setPending] = useState<Calendar | null>(null);
  const [proposedMovies, setProposedMovies] = useState<Movie[]>([]);
  const [listName, setListName] = useState("My movie tradition");
  const [posterFailedFor, setPosterFailedFor] = useState<string | null>(null);
  const [providerError, setProviderError] = useState("");
  const catalog = useCollections(season);
  const calendar = calendars[season];
  const info = seasonInfo[season];
  const unlocked = preview ? calendar.movies.length : unlockedDays(calendar, now);
  const movie = selected ? calendar.movies[selected - 1] : undefined;
  const movieKey = movie ? String(movie.tmdbId ?? `${movie.title}:${movie.year}`) : null;
  const detailsQuery = useQuery({
    queryKey: ["movie-details", movieKey],
    queryFn: ({ signal }) => getMovieDetails(movie!, signal),
    enabled: !!movie,
    retry: 1,
  });
  const availabilityQuery = useQuery({
    queryKey: ["availability", movieKey, region],
    queryFn: ({ signal }) => getAvailability(movie!, region, signal),
    enabled: !!movie,
    retry: 1,
  });
  const details = detailsQuery.data;
  const availability = availabilityQuery.data;
  const detailsBusy = detailsQuery.isPending || detailsQuery.isFetching;
  const busy = availabilityQuery.isPending || availabilityQuery.isFetching;
  const providerQueryError =
    availabilityQuery.error instanceof Error ? availabilityQuery.error.message : "";
  const revealed = preview ? [] : calendar.revealed;
  const watched = preview ? [] : calendar.watched;
  const nextDay = Array.from({ length: unlocked }, (_, i) => i + 1).find(
    (day) => !revealed.includes(day),
  );
  useEffect(() => {
    AsyncStorage.getItem("reelritual:v1")
      .then((raw) => {
        if (!raw) return;
        const value = JSON.parse(raw);
        if (!isCalendar(value.calendars?.halloween) || !isCalendar(value.calendars?.christmas))
          throw new Error("Invalid saved calendars");
        setCalendars(value.calendars);
        if (value.season === "halloween" || value.season === "christmas") setSeason(value.season);
        if (["US", "GB", "CA", "AU"].includes(value.region)) setRegion(value.region);
      })
      .catch(() =>
        setError("Your saved calendar could not be loaded. Please create a new calendar."),
      )
      .finally(() => setLoaded(true));
    const timer = setInterval(() => setNow(new Date()), 30000);
    const listener = AppState.addEventListener("change", () => setNow(new Date()));
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (loaded)
      AsyncStorage.setItem("reelritual:v1", JSON.stringify({ calendars, season, region })).catch(
        () => setError("Changes could not be saved on this device."),
      );
  }, [calendars, season, region, loaded]);
  useEffect(() => {
    setProviderError(providerQueryError);
  }, [providerQueryError]);
  const update = (c: Calendar) => setCalendars((previous) => ({ ...previous, [c.season]: c }));
  const openDay = (day: number) => {
    if (day > unlocked) return;
    if (!preview && !revealed.includes(day)) update({ ...calendar, revealed: [...revealed, day] });
    setSelected(day);
  };
  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setProviderError("Could not open the link. Please try again.");
    }
  };
  if (!loaded)
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color="#496347" />
      </SafeAreaView>
    );
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <StatusBar style="dark" />
      <View
        className="border-b border-line bg-paper px-6"
        style={{ paddingHorizontal: wide ? 48 : 22 }}
      >
        <View className="w-full max-w-7xl self-center flex-row items-center justify-between py-5">
          <View className="flex-row items-center gap-2">
            <View className="bg-moss rounded-lg p-2">
              <Ionicons name="film-outline" size={21} color="white" />
            </View>
            <Text className="text-ink text-xl font-bold">
              reel<Text className="font-normal">ritual</Text>
              <Text className="text-moss">.</Text>
            </Text>
          </View>
          {wide && (
            <View className="flex-row gap-8">
              {(["Calendar", "Collections", "My list"] as Tab[]).map((t) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t }}
                  onPress={() => setTab(t)}
                  key={t}
                >
                  <Text className={tab === t ? "text-moss font-bold" : "text-muted"}>
                    {t === "Calendar" ? "My calendar" : t}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => setSettings(true)}
            className="border border-line rounded-full p-2.5"
          >
            <Ionicons name="options-outline" size={20} color="#496347" />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: wide ? 48 : 22, paddingBottom: 40 }}>
        <View className="w-full max-w-7xl self-center">
          {!!error && (
            <Pressable onPress={() => setError("")} className="bg-orange-100 p-4 rounded-xl mb-4">
              <Text>{error} ×</Text>
            </Pressable>
          )}
          <View className="flex-row items-center justify-between mb-7 flex-wrap gap-3">
            <Text className="text-muted text-xs tracking-widest font-semibold">
              A SEASON OF GOOD STORIES
            </Text>
            <View className="flex-row bg-white border border-line rounded-full p-1">
              {(["halloween", "christmas"] as Season[]).map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityState={{ selected: season === s }}
                  onPress={() => {
                    setSeason(s);
                    setSelected(null);
                  }}
                  className={`px-4 py-2 rounded-full ${season === s ? "bg-moss" : ""}`}
                >
                  <Text
                    className={
                      season === s ? "text-white text-xs font-semibold" : "text-muted text-xs"
                    }
                  >
                    {seasonInfo[s].emoji} {seasonInfo[s].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {tab === "Calendar" && (
            <>
              <LinearGradient
                colors={season === "halloween" ? ["#ece8dc", "#e4e9db"] : ["#e5ebdf", "#f0ebe0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 24,
                  padding: wide ? 40 : 26,
                  overflow: "hidden",
                }}
              >
                <View style={{ maxWidth: wide ? "65%" : "100%" }}>
                  <Text className="text-moss text-xs tracking-widest font-bold mb-4">
                    {info.label.toUpperCase()} {calendar.year} · ONE MOVIE A DAY
                  </Text>
                  <Text
                    className="text-ink"
                    style={{
                      fontFamily: serif,
                      fontSize: wide ? 52 : 38,
                      lineHeight: wide ? 59 : 45,
                    }}
                  >
                    {season === "halloween"
                      ? "Good nights.\nA little goosebumps."
                      : "Cozy nights.\nChristmas lights."}
                  </Text>
                  <Text className="text-muted mt-4 text-base leading-6">
                    {info.subtitle}
                    {"\n"}Open a day. Find a film. Make it a tradition.
                  </Text>
                  <View className="flex-row mt-6">
                    <Button
                      title={
                        nextDay
                          ? `${preview ? "Preview" : "Reveal"} day ${nextDay}  ↗`
                          : unlocked === 0
                            ? `Starts ${season === "halloween" ? "October" : "December"} 1`
                            : "Revisit your movies ↓"
                      }
                      disabled={unlocked === 0}
                      onPress={() => openDay(nextDay ?? unlocked)}
                    />
                  </View>
                </View>
                {wide && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      right: 55,
                      top: 30,
                      transform: [{ rotate: "8deg" }],
                    }}
                  >
                    <Text style={{ fontSize: 145 }}>{info.emoji}</Text>
                    <View className="bg-paper rounded-xl p-4 border border-white">
                      <Text className="text-center text-moss tracking-widest text-xs">
                        THE NIGHTLY MOVIE CLUB
                      </Text>
                      <Text
                        className="text-center text-ink mt-1"
                        style={{ fontFamily: serif, fontSize: 24 }}
                      >
                        {calendar.movies.length} nights of magic
                      </Text>
                    </View>
                  </View>
                )}
              </LinearGradient>
              <View className="flex-row items-center justify-between mt-9 mb-2 flex-wrap gap-3">
                <Heading>Your {info.label.toLowerCase()} countdown</Heading>
                <Text className="text-muted text-xs">
                  {watched.length} / {calendar.movies.length} watched
                </Text>
              </View>
              <View className="flex-row items-center justify-between mb-5 flex-wrap gap-2">
                <Text className="text-muted text-sm">
                  {calendar.name} · {season === "halloween" ? "Oct" : "Dec"} 1–
                  {calendar.movies.length}
                </Text>
                <Pressable
                  onPress={() => setPreview(!preview)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: preview }}
                >
                  <Text className="text-moss text-sm underline">
                    {preview ? "Exit preview mode" : "Try preview mode"}
                  </Text>
                </Pressable>
              </View>
              {preview && (
                <Text className="text-moss bg-white p-3 rounded-lg mb-4 text-sm">
                  Preview mode · All days are open. Your real progress stays saved.
                </Text>
              )}
              <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                {calendar.movies.map((m, i) => {
                  const day = i + 1,
                    locked = day > unlocked,
                    seen = revealed.includes(day),
                    done = watched.includes(day);
                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="button"
                      accessibilityLabel={`Day ${day}, ${locked ? "locked" : seen ? m.title : "reveal movie"}`}
                      disabled={locked}
                      onPress={() => openDay(day)}
                      style={{
                        width: wide ? "13.4%" : "30.9%",
                        minHeight: wide ? 132 : 119,
                        backgroundColor: seen ? "#e7ecdf" : "#fffefb",
                        borderColor: seen ? "#cad4bf" : "#e5e5dc",
                        borderWidth: 1,
                        borderRadius: 12,
                        padding: 13,
                        justifyContent: "space-between",
                      }}
                    >
                      <View className="flex-row justify-between items-center">
                        <Text
                          style={{
                            fontFamily: serif,
                            fontSize: 28,
                            color: locked ? "#aaa99d" : "#496347",
                          }}
                        >
                          {String(day).padStart(2, "0")}
                        </Text>
                        <Ionicons
                          name={
                            done
                              ? "checkmark-circle"
                              : locked
                                ? "lock-closed-outline"
                                : seen
                                  ? "film-outline"
                                  : "sparkles-outline"
                          }
                          size={15}
                          color={locked ? "#b9b9ae" : "#496347"}
                        />
                      </View>
                      <Text
                        numberOfLines={2}
                        className="text-xs"
                        style={{ color: locked ? "#aaa99d" : "#496347" }}
                      >
                        {seen ? m.title : locked ? "A story awaits" : "Tap to unwrap"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View className="bg-white border border-line rounded-2xl p-5 mt-7 flex-row items-center gap-4">
                <Ionicons name="sparkles-outline" size={26} color="#496347" />
                <View className="flex-1">
                  <Text className="font-semibold text-ink">Your season, your kind of cinema.</Text>
                  <Text className="text-muted text-sm mt-1">
                    Pick a curated collection or bring your own favorites.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Browse collections"
                  onPress={() => setTab("Collections")}
                >
                  <Ionicons name="arrow-forward" size={23} color="#496347" />
                </Pressable>
              </View>
            </>
          )}
          {tab === "Collections" && (
            <>
              <Heading>Find your seasonal mood.</Heading>
              {catalog.busy && (
                <ActivityIndicator accessibilityLabel="Loading collections" color="#496347" />
              )}
              {!!catalog.message && <Text className="text-muted mt-3">{catalog.message}</Text>}
              {!catalog.busy && (
                <Pressable accessibilityRole="button" onPress={catalog.retry}>
                  <Text className="text-moss underline py-3">Refresh collections</Text>
                </Pressable>
              )}
              <Text className="text-muted mt-3 mb-7">
                Handpicked movie nights. Choose a collection to fill your calendar.
              </Text>
              <View className="flex-row flex-wrap gap-5">
                {catalog.collections.map((c) => (
                  <View
                    key={c.id}
                    className="bg-white rounded-2xl border border-line overflow-hidden"
                    style={{ width: wide ? "48%" : "100%" }}
                  >
                    <View
                      style={{
                        backgroundColor: c.color,
                        padding: 30,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 78 }}>{c.emoji}</Text>
                    </View>
                    <View className="p-6">
                      <Text className="text-moss text-xs tracking-widest mb-3">
                        {c.badge} · {c.movies.length} MOVIES
                      </Text>
                      <Heading>{c.name}</Heading>
                      <Text className="text-muted leading-6 mt-3 mb-5">{c.description}</Text>
                      <Button
                        title="Use this collection"
                        onPress={() =>
                          setPending({
                            season,
                            year: calendar.year,
                            name: c.name,
                            movies: c.movies,
                            revealed: [],
                            watched: [],
                          })
                        }
                      />
                    </View>
                  </View>
                ))}
              </View>
              <Text className="text-muted text-xs mt-6">
                Collections are editorial suggestions. Check individual movie ratings for your
                household.
              </Text>
            </>
          )}
          {tab === "My list" && (
            <View style={{ maxWidth: 720 }}>
              <Heading>A calendar made by you.</Heading>
              <Text className="text-muted mt-3 mb-7 leading-6">
                Search TMDB and choose up to {info.days} movies. Reorder your picks below, or
                shuffle them when you start your calendar.
              </Text>
              <Text className="text-ink font-semibold mb-2">Collection name</Text>
              <TextInput
                accessibilityLabel="Collection name"
                value={listName}
                onChangeText={setListName}
                maxLength={70}
                className="bg-white border border-line rounded-xl p-4 text-ink mb-5"
              />
              <MoviePicker movies={proposedMovies} onChange={setProposedMovies} limit={info.days} />
              <View className="h-5" />
              <Button
                title="Create my calendar"
                disabled={
                  !listName.trim() || !proposedMovies.length || proposedMovies.length > info.days
                }
                onPress={() =>
                  setPending({
                    season,
                    year: calendar.year,
                    name: listName.trim(),
                    movies: proposedMovies,
                    revealed: [],
                    watched: [],
                  })
                }
              />
              <View className="mt-3">
                <Button
                  secondary
                  title="Edit current collection"
                  onPress={() => {
                    setListName(calendar.name);
                    setProposedMovies(calendar.movies);
                  }}
                />
              </View>
            </View>
          )}
          <Text className="text-center text-muted text-xs mt-10">
            A little anticipation. A really good movie. ✳ reelritual
          </Text>
        </View>
      </ScrollView>
      {!wide && (
        <View className="flex-row border-t border-line bg-paper py-3">
          {(["Calendar", "Collections", "My list"] as Tab[]).map((t, i) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              onPress={() => setTab(t)}
              className="flex-1 items-center gap-1"
            >
              <Ionicons
                name={(["calendar-outline", "albums-outline", "list-outline"] as const)[i]}
                size={21}
                color={tab === t ? "#496347" : "#92948a"}
              />
              <Text
                className={tab === t ? "text-moss text-xs font-semibold" : "text-muted text-xs"}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Modal
        visible={!!movie}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View
            className="bg-paper rounded-3xl w-full max-w-lg overflow-hidden"
            style={{ maxHeight: "90%" }}
          >
            <ScrollView contentContainerStyle={{ padding: 28 }}>
              <View className="flex-row justify-between items-center">
                <Text className="text-moss text-xs tracking-widest">
                  {preview ? "PREVIEW" : "TONIGHT’S FEATURE"} · DAY {selected}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close movie"
                  onPress={() => setSelected(null)}
                >
                  <Ionicons name="close" size={25} color="#496347" />
                </Pressable>
              </View>
              <View className="items-center my-6">
                {detailsBusy ? (
                  <View style={{ height: 240, justifyContent: "center" }}>
                    <ActivityIndicator accessibilityLabel="Loading movie details" color="#496347" />
                  </View>
                ) : details?.posterUrl && posterFailedFor !== movieKey ? (
                  <Image
                    source={{ uri: details.posterUrl }}
                    accessibilityLabel={`${movie?.title} movie poster`}
                    resizeMode="contain"
                    style={{ width: 180, height: 270, borderRadius: 12 }}
                    onError={() => setPosterFailedFor(movieKey)}
                  />
                ) : (
                  <View className="items-center">
                    <Text style={{ fontSize: 65 }}>🎬</Text>
                    <Text className="text-muted text-xs mt-2">Poster unavailable</Text>
                  </View>
                )}
              </View>
              <Heading>{movie?.title}</Heading>
              <Text className="text-muted mt-2 mb-6">
                {movie?.year || "Your selection"} · {movie?.genre}
              </Text>
              <Text className="text-ink leading-6 mb-6" numberOfLines={5}>
                {detailsBusy
                  ? "Finding the story…"
                  : details?.overview ||
                    movie?.description ||
                    "A synopsis isn’t available for this movie yet."}
              </Text>
              <Text className="font-semibold text-ink mb-3">Where to watch · {region}</Text>
              {busy && <ActivityIndicator color="#496347" />}
              {!!providerError && <Text className="text-red-700 mb-3">{providerError}</Text>}
              {availability && (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => openLink("https://www.justwatch.com")}
                >
                  <Text className="text-moss text-xs underline mb-3">
                    Availability powered by JustWatch
                  </Text>
                </Pressable>
              )}
              {availability?.groups.map((g) => (
                <View key={g.label} className="mb-3">
                  <Text className="text-muted text-xs mb-1">{g.label}</Text>
                  <Text className="text-ink">{g.names.join(" · ")}</Text>
                </View>
              ))}
              {!availability && !busy && (
                <Text className="text-muted text-sm mb-4 leading-5">
                  Check current streaming, rental, and purchase options. Availability depends on
                  your country.
                </Text>
              )}
              <Button
                title={availability ? "View watch options ↗" : "Find on JustWatch ↗"}
                onPress={() => movie && openLink(availability?.link ?? watchSearch(movie, region))}
              />
              <View className="mt-3">
                <Button
                  secondary
                  title="Search Google watch options ↗"
                  onPress={() =>
                    movie &&
                    openLink(
                      `https://www.google.com/search?q=${encodeURIComponent(`${movie.title} ${movie.year || ""} watch stream rent buy ${region}`)}`,
                    )
                  }
                />
              </View>
              {(availability || details) && (
                <Text className="text-muted text-xs mt-3">
                  {availability ? "Availability by JustWatch via TMDB. " : ""}
                  Movie information and images from TMDB. This product uses the TMDB API but is not
                  endorsed or certified by TMDB.
                </Text>
              )}
              <View className="border-t border-line mt-6 pt-5">
                <Button
                  secondary
                  title={
                    watched.includes(selected!)
                      ? "✓ Watched — mark unwatched"
                      : preview
                        ? "Exit preview to track your watch"
                        : "Mark as watched"
                  }
                  disabled={preview}
                  onPress={() =>
                    update({
                      ...calendar,
                      watched: watched.includes(selected!)
                        ? watched.filter((d) => d !== selected)
                        : [...watched, selected!],
                    })
                  }
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={settings}
        transparent
        animationType="fade"
        onRequestClose={() => setSettings(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View className="bg-paper rounded-3xl w-full max-w-lg" style={{ maxHeight: "90%" }}>
            <ScrollView contentContainerStyle={{ padding: 28 }}>
              <Heading>Your preferences</Heading>
              <Text className="font-semibold text-ink mt-6 mb-3">Watch region</Text>
              <View className="flex-row gap-2">
                {["US", "GB", "CA", "AU"].map((r) => (
                  <Pressable
                    accessibilityRole="button"
                    key={r}
                    onPress={() => setRegion(r)}
                    className={`p-3 rounded-xl ${r === region ? "bg-moss" : "bg-white"}`}
                  >
                    <Text className={r === region ? "text-white" : "text-ink"}>{r}</Text>
                  </Pressable>
                ))}
              </View>
              <Text className="font-semibold text-ink mt-6 mb-3">Season year</Text>
              <View className="flex-row gap-2">
                {[now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <Button
                    key={y}
                    title={String(y)}
                    secondary={calendar.year !== y}
                    onPress={() => {
                      if (calendar.year !== y) {
                        setSettings(false);
                        setPending({
                          ...calendar,
                          year: y,
                          revealed: [],
                          watched: [],
                        });
                      }
                    }}
                  />
                ))}
              </View>
              <View className="flex-row justify-between items-center my-6">
                <Text className="text-ink">Preview all days</Text>
                <Switch
                  accessibilityLabel="Preview all days"
                  value={preview}
                  onValueChange={setPreview}
                  trackColor={{ true: "#496347" }}
                />
              </View>
              <Text className="text-muted text-sm mb-6">
                Calendars and watch progress are saved on this device. Days unlock at midnight in
                your local time.
              </Text>
              <Button title="Done" onPress={() => setSettings(false)} />
              <Credits />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        onRequestClose={() => setPending(null)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View className="bg-paper rounded-3xl p-7 w-full max-w-lg">
            <Heading>Make it a movie season.</Heading>
            <Text className="text-muted leading-6 mt-4 mb-6">
              {pending?.name} · {pending?.movies.length} movies · {pending?.year}
              {"\n\n"}This replaces your {info.label} calendar and resets its watch progress. Keep
              the listed order or shuffle for a surprise.
            </Text>
            <Button
              title="Start in listed order"
              onPress={() => {
                if (pending) update(pending);
                setPending(null);
                setPreview(false);
                setTab("Calendar");
              }}
            />
            <View className="mt-3">
              <Button
                secondary
                title="Shuffle & start"
                onPress={() => {
                  if (pending) update({ ...pending, movies: shuffled(pending.movies) });
                  setPending(null);
                  setPreview(false);
                  setTab("Calendar");
                }}
              />
            </View>
            <Pressable onPress={() => setPending(null)} className="p-4 items-center">
              <Text className="text-muted">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
