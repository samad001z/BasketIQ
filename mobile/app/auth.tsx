import { router } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "@/components/PressableScale";
import { useAuth } from "@/lib/auth";
import { cardShadow } from "@/lib/theme";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { session, configured, signInEmail, signUpEmail, signInGoogle, signOut } =
    useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-surface-sunken">
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="flex-row items-center gap-3 px-5 pb-3"
      >
        <PressableScale onPress={() => router.back()}>
          <View
            style={cardShadow}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <Text className="text-[18px] text-ink">‹</Text>
          </View>
        </PressableScale>
        <Text className="font-sans-semibold text-[16px] text-ink">Account</Text>
      </View>

      <View className="px-5 pt-4">
        {!configured ? (
          <View style={cardShadow} className="rounded-4xl bg-surface p-5">
            <Text className="font-sans-semibold text-[15px] text-ink">
              Auth not configured
            </Text>
            <Text className="mt-2 font-sans text-[13px] text-ink-muted">
              Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in
              mobile/.env, then restart. You can still use BasketIQ as a guest.
            </Text>
          </View>
        ) : session ? (
          <View style={cardShadow} className="rounded-4xl bg-surface p-5">
            <Text className="font-sans text-[13px] text-ink-muted">Signed in as</Text>
            <Text className="mt-1 font-sans-semibold text-[16px] text-ink">
              {session.user.email}
            </Text>
            <PressableScale onPress={() => router.push("/analytics")}>
              <View className="mt-5 items-center rounded-2xl bg-accent-light py-3.5">
                <Text className="font-sans-semibold text-[14px] text-accent-dark">
                  View spending analytics
                </Text>
              </View>
            </PressableScale>
            <PressableScale onPress={() => run(signOut)}>
              <View className="mt-3 items-center rounded-2xl bg-surface-sunken py-3.5">
                <Text className="font-sans-semibold text-[14px] text-ink-soft">
                  Sign out
                </Text>
              </View>
            </PressableScale>
          </View>
        ) : (
          <View style={cardShadow} className="rounded-4xl bg-surface p-5">
            <Text className="font-sans-bold text-[18px] text-ink">
              {mode === "in" ? "Welcome back" : "Create account"}
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#8B948D"
              autoCapitalize="none"
              keyboardType="email-address"
              className="mt-4 rounded-2xl bg-surface-sunken px-4 py-3 font-sans text-[15px] text-ink"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#8B948D"
              secureTextEntry
              className="mt-3 rounded-2xl bg-surface-sunken px-4 py-3 font-sans text-[15px] text-ink"
            />
            {error && (
              <Text className="mt-3 font-sans text-[12px] text-red-600">{error}</Text>
            )}
            <PressableScale
              onPress={() =>
                run(() =>
                  mode === "in"
                    ? signInEmail(email.trim(), password)
                    : signUpEmail(email.trim(), password),
                )
              }
            >
              <View className="mt-4 items-center rounded-2xl bg-accent py-4">
                <Text className="font-sans-semibold text-[15px] text-white">
                  {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
                </Text>
              </View>
            </PressableScale>
            <PressableScale onPress={() => run(signInGoogle)}>
              <View className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3.5">
                <Text className="text-[15px]">🔵</Text>
                <Text className="font-sans-semibold text-[14px] text-ink">
                  Continue with Google
                </Text>
              </View>
            </PressableScale>
            <PressableScale onPress={() => setMode(mode === "in" ? "up" : "in")}>
              <Text className="mt-4 text-center font-sans-medium text-[13px] text-accent-dark">
                {mode === "in"
                  ? "New here? Create an account"
                  : "Have an account? Sign in"}
              </Text>
            </PressableScale>
          </View>
        )}
      </View>
    </View>
  );
}
