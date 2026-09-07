import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import logo from "./tmdb-logo";
export function Credits() {
  const [error, setError] = useState(false);
  const open = (url: string) =>
    Linking.openURL(url).catch(() => setError(true));
  return (
    <View className="mt-5 border-t border-line pt-4">
      <Text className="text-ink font-semibold mb-3">About & credits</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="The Movie Database"
        onPress={() => open("https://www.themoviedb.org")}
      >
        <SvgXml xml={logo} width={90} height={18} />
      </Pressable>
      <Text className="text-muted text-xs leading-5 mt-2">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => open("https://www.justwatch.com")}
      >
        <Text className="text-moss text-xs underline mt-2">
          Watch availability powered by JustWatch
        </Text>
      </Pressable>
      {error && (
        <Text className="text-muted text-xs">Could not open the website.</Text>
      )}
    </View>
  );
}
