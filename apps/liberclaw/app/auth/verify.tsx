import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/auth/provider";
import type { TokenPair } from "@/lib/api/types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export default function VerifyMagicLinkScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No token provided");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/verify-magic-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.detail ?? "Verification failed");
        }
        const data = await res.json();
        if (!cancelled) {
          await login(data as TokenPair);
          router.replace("/(tabs)");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Verification failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, login, router]);

  return (
    <View className="flex-1 bg-surface-base items-center justify-center px-6">
      {error ? (
        <View className="items-center">
          <Text className="text-xl font-bold text-text-primary mb-2">
            Verification Failed
          </Text>
          <Text className="text-sm text-text-secondary text-center mb-6">
            {error}
          </Text>
          <TouchableOpacity
            className="bg-claw-orange rounded-lg px-6 py-3"
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text className="text-white font-semibold">Back to Login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="items-center">
          <ActivityIndicator size="large" color="#ff5e00" />
          <Text className="text-text-secondary mt-4">Verifying...</Text>
        </View>
      )}
    </View>
  );
}
