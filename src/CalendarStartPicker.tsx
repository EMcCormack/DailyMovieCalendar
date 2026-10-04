import { Pressable, Text, View } from "react-native";
import { type Season, seasonInfo, suggestedStartDay } from "./calendar";

export function CalendarStartPicker({
  season,
  year,
  startDay,
  now,
  onChange,
  showDescription = true,
}: {
  season: Season;
  year: number;
  startDay: number;
  now: Date;
  onChange: (day: number) => void;
  showDescription?: boolean;
}) {
  const info = seasonInfo[season];
  const month = season === "halloween" ? "October" : "December";
  const today = suggestedStartDay(season, year, now);
  return (
    <View className="mb-5">
      <Text className="text-ink font-semibold mb-2">Start date</Text>
      <View className="flex-row items-center justify-between bg-white border border-line rounded-xl">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start one day earlier"
          disabled={startDay === 1}
          onPress={() => onChange(startDay - 1)}
          className="p-4"
          style={{ opacity: startDay === 1 ? 0.4 : 1 }}
        >
          <Text className="text-moss text-xl">−</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" className="text-ink font-semibold">
          {month} {startDay}, {year}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start one day later"
          disabled={startDay === info.days}
          onPress={() => onChange(startDay + 1)}
          className="p-4"
          style={{ opacity: startDay === info.days ? 0.4 : 1 }}
        >
          <Text className="text-moss text-xl">+</Text>
        </Pressable>
      </View>
      <View className="flex-row flex-wrap gap-3 mt-2">
        {[
          { day: 1, label: "Start on the 1st" },
          ...(today > 1 ? [{ day: today, label: "Start today" }] : []),
        ].map(({ day, label }) => (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: startDay === day }}
            onPress={() => onChange(day)}
            className="py-2"
          >
            <Text className="text-moss underline">{label}</Text>
          </Pressable>
        ))}
      </View>
      {showDescription && (
        <Text className="text-muted text-sm mt-1">
          {info.days - startDay + 1} movie slots through {month} {info.days}. Each day opens at
          midnight in your local time.
        </Text>
      )}
    </View>
  );
}
