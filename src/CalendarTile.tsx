import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { Movie } from "./calendar";
import { movieDetailsOptions } from "./movieQueries";

export function CalendarTile({
  movie,
  day,
  locked,
  revealed,
  watched,
  wide,
  fontFamily,
  onPress,
}: {
  movie: Movie;
  day: number;
  locked: boolean;
  revealed: boolean;
  watched: boolean;
  wide: boolean;
  fontFamily: string | undefined;
  onPress: () => void;
}) {
  const visibleMovie = revealed && !locked ? movie : undefined;
  const details = useQuery(movieDetailsOptions(visibleMovie));
  const [failedPoster, setFailedPoster] = useState<string | null>(null);
  const posterUrl = visibleMovie ? details.data?.posterUrl : null;
  const showPoster = !!posterUrl && failedPoster !== posterUrl;
  const hidden = !visibleMovie;
  const showWatched = watched && !hidden;
  const textColor = showPoster ? "#fffefb" : locked ? "#aaa99d" : "#496347";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Day ${day}, ${locked ? "locked" : revealed ? movie.title : "reveal movie"}${watched ? ", watched" : ""}`}
      disabled={locked}
      onPress={onPress}
      style={{
        width: wide ? "13.4%" : "30.9%",
        aspectRatio: 2 / 3,
        backgroundColor: hidden ? "#e8e9e6" : showWatched ? "#c5debb" : "#e7ecdf",
        borderColor: hidden ? "#d4d6d1" : showWatched ? "#789b6b" : "#cad4bf",
        borderWidth: 1,
        borderRadius: 12,
        overflow: "hidden",
        padding: 13,
        justifyContent: "space-between",
      }}
    >
      {showPoster && (
        <>
          <Image
            source={{ uri: posterUrl }}
            resizeMode="cover"
            accessible={false}
            style={StyleSheet.absoluteFill}
            onError={() => setFailedPoster(posterUrl)}
          />
          {showWatched && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(65,145,50,0.36)" }]}
            />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      )}
      {hidden && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
        >
          <Text
            accessible={false}
            style={{ fontFamily, fontSize: 46, color: locked ? "#b5b8b1" : "#9c9f97" }}
          >
            ?
          </Text>
        </View>
      )}
      <View className="flex-row justify-between items-center">
        <Text style={{ fontFamily, fontSize: 28, color: textColor }}>
          {String(day).padStart(2, "0")}
        </Text>
        <Ionicons
          name={
            watched
              ? "checkmark-circle"
              : locked
                ? "lock-closed-outline"
                : revealed
                  ? "film-outline"
                  : "sparkles-outline"
          }
          size={17}
          color={showPoster ? "#fffefb" : locked ? "#b9b9ae" : "#496347"}
        />
      </View>
      <Text
        numberOfLines={2}
        className="text-xs"
        style={{ color: textColor, fontWeight: showPoster ? "600" : "400" }}
      >
        {revealed && !locked ? movie.title : locked ? "A story awaits" : "Tap to reveal"}
      </Text>
    </Pressable>
  );
}
