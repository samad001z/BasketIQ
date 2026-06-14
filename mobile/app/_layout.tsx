import "../global.css";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Toaster } from "@/components/Toaster";
import { AuthProvider } from "@/lib/auth";
import { useCartSync } from "@/lib/hooks/useCartSync";
import { usePriceWatch } from "@/lib/hooks/usePriceWatch";
import { queryClient } from "@/lib/queryClient";

SplashScreen.preventAutoHideAsync();

/** Runs cross-cutting hooks (cart sync, realtime) and renders the nav + toaster. */
function AppShell() {
  useCartSync();
  usePriceWatch();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#F4F6F4" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="assistant" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="history/[id]" />
      </Stack>
      <Toaster />
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <AppShell />
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
