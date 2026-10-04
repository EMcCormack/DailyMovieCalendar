import "./global.css";
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
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
  Season,
  currentDayMovie,
  editCalendar,
  isCalendar,
  seasonInfo,
  startCalendar,
  suggestedStartDay,
  unlockedDays,
} from "./src/calendar";
import { MoviePicker } from "./src/MoviePicker";
import { CalendarTile } from "./src/CalendarTile";
import { CalendarStartPicker } from "./src/CalendarStartPicker";
import { CalendarEditor } from "./src/CalendarEditor";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useCollections } from "./src/useCollections";
import { Credits } from "./src/Credits";
import { watchSearch } from "./src/providers";
import { createMovieQueryClient, movieCacheOptions } from "./src/queryCache";
import { movieAvailabilityOptions, movieDetailsOptions } from "./src/movieQueries";

type CalendarEditorState = { mode: "create" | "edit"; calendar: Calendar };
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
      accessibilityLabel={title}
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
  const [queryClient] = useState(createMovieQueryClient);
  const [persistOptions] = useState(() =>
    movieCacheOptions(AsyncStorage, process.env.EXPO_PUBLIC_MOVIE_API_URL),
  );
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <MovieApp />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
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
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [region, setRegion] = useState("US");
  const [now, setNow] = useState(new Date());
  const [selected, setSelected] = useState<number | null>(null);
  const [replacingDay, setReplacingDay] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  const [choosingCalendar, setChoosingCalendar] = useState(false);
  const [editor, setEditor] = useState<CalendarEditorState | null>(null);
  const [pending, setPending] = useState<Calendar | null>(null);
  const [posterFailedFor, setPosterFailedFor] = useState<string | null>(null);
  const [providerError, setProviderError] = useState("");
  const calendar = calendars[season];
  const catalog = useCollections(
    season,
    loaded && (calendar.movies.length === 0 || choosingCalendar),
  );
  const info = seasonInfo[season];
  const startDay = calendar.startDay ?? 1;
  const pendingMovieCount = pending
    ? Math.min(pending.movies.length, seasonInfo[pending.season].days - (pending.startDay ?? 1) + 1)
    : 0;
  const unlocked = preview ? calendar.movies.length : unlockedDays(calendar, now);
  const movie = selected ? calendar.movies[selected - startDay] : undefined;
  const movieKey = movie ? String(movie.tmdbId ?? `${movie.title}:${movie.year}`) : null;
  const detailsQuery = useQuery(movieDetailsOptions(movie));
  const availabilityQuery = useQuery(movieAvailabilityOptions(movie, region));
  const todayMovie = loaded ? currentDayMovie(calendar, now) : undefined;
  // These queries share the modal's cache and wait for device-cache restoration.
  const todayDetailsQuery = useQuery(movieDetailsOptions(todayMovie));
  useQuery(movieAvailabilityOptions(todayMovie, region));
  const todayPosterUrl = todayDetailsQuery.data?.posterUrl;
  useEffect(() => {
    if (todayPosterUrl) Image.prefetch(todayPosterUrl).catch(() => {});
  }, [todayPosterUrl]);
  const details = detailsQuery.data;
  const availability = availabilityQuery.data;
  const detailsBusy = detailsQuery.isPending;
  const busy = availabilityQuery.isPending;
  const providerQueryError =
    availabilityQuery.error instanceof Error ? availabilityQuery.error.message : "";
  const revealed = preview ? [] : calendar.revealed;
  const watched = preview ? [] : calendar.watched;
  useEffect(() => {
    AsyncStorage.getItem("dailymoviecalendar:v1")
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
      AsyncStorage.setItem(
        "dailymoviecalendar:v1",
        JSON.stringify({ calendars, season, region }),
      ).catch(() => setError("Changes could not be saved on this device."));
  }, [calendars, season, region, loaded]);
  useEffect(() => {
    setProviderError(providerQueryError);
  }, [providerQueryError]);
  const update = (c: Calendar) => setCalendars((previous) => ({ ...previous, [c.season]: c }));
  const openCalendarPicker = () => {
    setChoosingCalendar(true);
  };
  const openCustomCalendar = (mode: "create" | "edit") => {
    setChoosingCalendar(false);
    setEditor({
      mode,
      calendar:
        mode === "edit"
          ? calendar
          : {
              ...emptyCalendar(season),
              year: calendar.year,
              name: "My movie tradition",
              startDay: suggestedStartDay(season, calendar.year, now),
            },
    });
  };
  const openDay = (day: number) => {
    if (day < startDay || day >= startDay + unlocked) return;
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
  if (editor)
    return (
      <CalendarEditor
        calendar={editor.calendar}
        mode={editor.mode}
        now={now}
        onBack={() => setEditor(null)}
        onSave={(draft) => {
          update(
            editor.mode === "edit"
              ? editCalendar(calendars[draft.season], draft.name, draft.movies, draft.startDay)
              : startCalendar(draft),
          );
          setEditor(null);
          setSelected(null);
          setPreview(false);
        }}
      />
    );
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <StatusBar style="dark" />
      <View
        className="border-b border-line bg-paper px-6"
        style={{ paddingHorizontal: wide ? 48 : 22 }}
      >
        <View className="w-full max-w-7xl self-center flex-row items-center justify-between py-5">
          <View className="flex-1 flex-row items-center gap-2 mr-3" style={{ minWidth: 0 }}>
            <View className="bg-moss rounded-lg p-2" style={{ flexShrink: 0 }}>
              <Ionicons name="film-outline" size={21} color="white" />
            </View>
            <Text className="text-ink text-xl font-bold" style={{ flexShrink: 1 }}>
              Daily Movie Calendar
            </Text>
          </View>
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
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: wide ? 48 : 22,
          paddingTop: wide ? 20 : 14,
          paddingBottom: 40,
        }}
      >
        <View className="w-full max-w-7xl self-center">
          {!!error && (
            <Pressable onPress={() => setError("")} className="bg-orange-100 p-4 rounded-xl mb-4">
              <Text>{error} ×</Text>
            </Pressable>
          )}
          <>
            {calendar.movies.length === 0 && (
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
                    {`${info.subtitle}\nOpen a day. Find a film. Make it a tradition.`}
                  </Text>
                  <View className="flex-row mt-6">
                    <Button title="Choose calendar ↗" onPress={openCalendarPicker} />
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
                        A season of movie magic
                      </Text>
                    </View>
                  </View>
                )}
              </LinearGradient>
            )}
            <View
              className={`flex-row items-center justify-between ${calendar.movies.length ? "mt-0" : "mt-9"} mb-2 gap-3`}
            >
              <View className="flex-1">
                <Heading>
                  {calendar.movies.length
                    ? calendar.name || `Your ${info.label} calendar`
                    : `Your ${info.label.toLowerCase()} countdown`}
                </Heading>
              </View>
              {calendar.movies.length > 0 && (
                <Button
                  secondary
                  title="Edit calendar"
                  onPress={() => openCustomCalendar("edit")}
                />
              )}
            </View>
            <View className="mb-5">
              <Text className="text-muted text-sm">
                {calendar.movies.length
                  ? `${info.label} ${calendar.year} · ${season === "halloween" ? "Oct" : "Dec"} ${startDay}–${startDay + calendar.movies.length - 1}`
                  : "Choose a calendar or add your own movies to start."}
              </Text>
              {calendar.movies.length > 0 && (
                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-muted text-xs">
                    {watched.length}/{calendar.movies.length} watched
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Choose a different calendar"
                    onPress={openCalendarPicker}
                    className="py-2 pl-3"
                  >
                    <Text className="text-moss text-sm underline">Change collection</Text>
                  </Pressable>
                </View>
              )}
            </View>
            {preview && (
              <Text className="text-moss bg-white p-3 rounded-lg mb-4 text-sm">
                Preview mode · All days are open. Your real progress stays saved.
              </Text>
            )}
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {calendar.movies.map((m, i) => {
                const day = i + startDay,
                  locked = i >= unlocked,
                  seen = revealed.includes(day),
                  done = watched.includes(day);
                return (
                  <CalendarTile
                    key={`${season}:${calendar.year}:${day}:${m.id}`}
                    movie={m}
                    day={day}
                    locked={locked}
                    revealed={seen}
                    watched={done}
                    wide={wide}
                    fontFamily={serif}
                    onPress={() => openDay(day)}
                  />
                );
              })}
            </View>
          </>
        </View>
      </ScrollView>
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
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 28 }}>
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
            </ScrollView>
            <View
              className="border-t border-line bg-paper px-7 py-5 gap-3"
              style={{ flexShrink: 0 }}
            >
              <Button
                secondary
                title="Change this movie"
                onPress={() => {
                  setReplacingDay(selected);
                  setSelected(null);
                }}
              />
              <Button
                secondary={watched.includes(selected!)}
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
          </View>
        </View>
      </Modal>
      <Modal
        visible={replacingDay !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSelected(replacingDay);
          setReplacingDay(null);
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View
            className="bg-paper rounded-3xl w-full max-w-lg overflow-hidden"
            style={{ height: "90%" }}
          >
            {replacingDay !== null && (
              <GestureHandlerRootView style={{ flex: 1 }}>
                <MoviePicker
                  key={`${season}:${replacingDay}`}
                  movies={calendar.movies}
                  limit={info.days - startDay + 1}
                  startDay={startDay}
                  onChange={() => {}}
                  onSelect={(replacement) => {
                    const movies = calendar.movies.map((current, index) =>
                      index === replacingDay - startDay ? replacement : current,
                    );
                    const edited = editCalendar(calendar, calendar.name, movies);
                    if (!preview) edited.revealed.push(replacingDay);
                    update(edited);
                    setSelected(replacingDay);
                    setReplacingDay(null);
                  }}
                  header={
                    <View>
                      <Heading>Change day {replacingDay}</Heading>
                      <Text className="text-muted mt-3 leading-6">
                        Replace {calendar.movies[replacingDay - startDay]?.title} with a movie of
                        your choice. The new movie starts unwatched. Other days keep their progress.
                      </Text>
                    </View>
                  }
                />
              </GestureHandlerRootView>
            )}
            <View className="border-t border-line px-7 py-5" style={{ flexShrink: 0 }}>
              <Button
                secondary
                title="Cancel"
                onPress={() => {
                  setSelected(replacingDay);
                  setReplacingDay(null);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={choosingCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setChoosingCalendar(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View
            className="bg-paper rounded-3xl w-full max-w-lg overflow-hidden"
            style={{ maxHeight: "90%" }}
          >
            <View className="flex-row justify-between items-center border-b border-line px-7 py-5">
              <Text className="text-moss text-xs tracking-widest">CHOOSE CALENDAR</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close calendar picker"
                onPress={() => setChoosingCalendar(false)}
              >
                <Ionicons name="close" size={25} color="#496347" />
              </Pressable>
            </View>
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ padding: 28 }}
              keyboardShouldPersistTaps="handled"
            >
              <Heading>Change collection</Heading>
              {catalog.busy && (
                <ActivityIndicator accessibilityLabel="Loading calendars" color="#496347" />
              )}
              {!!catalog.message && <Text className="text-muted mt-3">{catalog.message}</Text>}
              {!catalog.busy && (
                <Pressable accessibilityRole="button" onPress={catalog.retry}>
                  <Text className="text-moss underline py-3">Refresh calendars</Text>
                </Pressable>
              )}
              <Text className="text-muted mt-3 mb-7">
                Pick a ready-made calendar, or choose your own movies.
              </Text>
              <View className="flex-row flex-wrap gap-5">
                {catalog.collections.map((c) => (
                  <View
                    key={c.id}
                    className="bg-white rounded-2xl border border-line overflow-hidden"
                    style={{ width: "100%" }}
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
                        title="Use this calendar"
                        onPress={() => {
                          setChoosingCalendar(false);
                          setEditor({
                            mode: "create",
                            calendar: {
                              season,
                              year: calendar.year,
                              name: c.name,
                              startDay: suggestedStartDay(season, calendar.year, now),
                              movies: c.movies,
                              revealed: [],
                              watched: [],
                            },
                          });
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
              <Text className="text-muted text-xs mt-6">
                Collections are editorial suggestions. Check individual movie ratings for your
                household.
              </Text>
            </ScrollView>
            <View className="border-t border-line px-7 py-5 gap-3" style={{ flexShrink: 0 }}>
              <Button
                secondary
                title="Create your own"
                onPress={() => openCustomCalendar("create")}
              />
              {calendar.movies.length > 0 && (
                <Button
                  secondary
                  title="Edit calendar"
                  onPress={() => openCustomCalendar("edit")}
                />
              )}
            </View>
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
              <Text className="text-ink font-semibold mt-6 mb-3">Holiday calendar</Text>
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
          <ScrollView
            className="bg-paper rounded-3xl w-full max-w-lg"
            style={{ maxHeight: "90%", flexGrow: 0 }}
            contentContainerStyle={{ padding: 28 }}
          >
            <Heading>Make it a movie season.</Heading>
            {pending && (
              <View className="mt-5">
                <CalendarStartPicker
                  season={pending.season}
                  year={pending.year}
                  startDay={pending.startDay ?? 1}
                  now={now}
                  onChange={(day) => setPending({ ...pending, startDay: day })}
                />
              </View>
            )}
            <Text className="text-muted leading-6 mt-4 mb-6">
              {pending?.name} · {pendingMovieCount} movies · {pending?.year}
              {pending && pending.movies.length > pendingMovieCount
                ? `\n\nThere are ${pendingMovieCount} slots left. Listed order uses the first ${pendingMovieCount} picks; shuffle randomly chooses that many from all ${pending.movies.length} movies.`
                : "\n\nKeep the listed order or shuffle for a surprise."}
              {"\n\n"}This replaces your {info.label} calendar and resets its watch progress.
            </Text>
            <Button
              title="Start in listed order"
              onPress={() => {
                if (pending) update(startCalendar(pending));
                setPending(null);
                setPreview(false);
              }}
            />
            <View className="mt-3">
              <Button
                secondary
                title="Shuffle & start"
                onPress={() => {
                  if (pending) update(startCalendar(pending, true));
                  setPending(null);
                  setPreview(false);
                }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel starting calendar"
              onPress={() => setPending(null)}
              className="p-4 items-center"
            >
              <Text className="text-muted">Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
