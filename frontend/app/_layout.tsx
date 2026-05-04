import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { theme } from "../src/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: { fontWeight: "800", letterSpacing: 1 },
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="history" options={{ title: "HISTORY", presentation: "card" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
