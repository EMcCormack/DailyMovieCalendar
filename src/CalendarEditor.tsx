import { useEffect, useState } from "react";
import { BackHandler, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { type Calendar, seasonInfo } from "./calendar";
import { CalendarStartPicker } from "./CalendarStartPicker";
import { MoviePicker } from "./MoviePicker";

export function CalendarEditor({
  calendar,
  mode,
  now,
  onBack,
  onSave,
}: {
  calendar: Calendar;
  mode: "create" | "edit";
  now: Date;
  onBack: () => void;
  onSave: (calendar: Calendar) => void;
}) {
  const [name, setName] = useState(calendar.name);
  const [movies, setMovies] = useState(calendar.movies);
  const [startDay, setStartDay] = useState(calendar.startDay ?? 1);
  const [dragging, setDragging] = useState(false);
  const limit = seasonInfo[calendar.season].days - startDay + 1;
  const excess = movies.length - limit;
  const disabled = dragging || !name.trim() || !movies.length || excess > 0;
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => listener.remove();
  }, [onBack]);
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <StatusBar style="dark" />
      <View className="border-b border-line px-5 py-4">
        <View className="w-full max-w-3xl self-center flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel calendar changes and go back"
            onPress={onBack}
            className="flex-row items-center gap-2 py-2 pr-4"
          >
            <Ionicons name="chevron-back" size={22} color="#496347" />
            <Text className="text-moss font-semibold">Back</Text>
          </Pressable>
          <Text className="text-muted text-sm">
            {seasonInfo[calendar.season].emoji} {calendar.year}
          </Text>
        </View>
      </View>
      <View className="flex-1 w-full max-w-3xl self-center">
        <MoviePicker
          movies={movies}
          onChange={setMovies}
          limit={limit}
          startDay={startDay}
          season={calendar.season}
          onDragStateChange={setDragging}
          header={
            <View>
              <Text className="text-ink font-semibold mb-2">Calendar name</Text>
              <TextInput
                accessibilityLabel="Calendar name"
                value={name}
                onChangeText={setName}
                maxLength={70}
                className="bg-white border border-line rounded-xl p-4 text-ink mb-5"
              />
              <CalendarStartPicker
                season={calendar.season}
                year={calendar.year}
                startDay={startDay}
                now={now}
                onChange={setStartDay}
                showDescription={false}
              />
              {excess > 0 && (
                <View className="mb-4">
                  <Text accessibilityLiveRegion="polite" className="text-red-700">
                    {excess} {excess === 1 ? "movie exceeds" : "movies exceed"} the remaining dates.
                    Remove picks or start earlier.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove the last ${excess} movies`}
                    onPress={() => setMovies((current) => current.slice(0, limit))}
                    className="self-start py-3"
                  >
                    <Text className="text-moss underline">Keep first {limit} movies</Text>
                  </Pressable>
                </View>
              )}
            </View>
          }
        />
      </View>
      <View className="border-t border-line px-5 py-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === "edit" ? "Save calendar changes" : "Start calendar"}
          disabled={disabled}
          onPress={() => onSave({ ...calendar, name: name.trim(), movies, startDay })}
          className="w-full max-w-3xl self-center rounded-xl bg-moss px-5 py-4 items-center"
          style={{ opacity: disabled ? 0.4 : 1 }}
        >
          <Text className="text-white font-semibold">
            {mode === "edit" ? "Save changes" : "Start calendar"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
