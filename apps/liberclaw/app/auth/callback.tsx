import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/auth/provider";

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const { access_token, refresh_token } = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
  }>();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!access_token || !refresh_token) {
      setError("Missing tokens from OAuth callback");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await login({ access_token, refresh_token });
        if (!cancelled) {
          router.replace("/(tabs)");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Login failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [access_token, refresh_token, login, router]);

  return (
    <View className="flex-1 bg-surface-base items-center justify-center px-6">
      {error ? (
        <View className="items-center">
          <Text className="text-xl font-bold text-text-primary mb-2">
            Login Failed
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
          <Text className="text-text-secondary mt-4">Signing you in...</Text>
        </View>
      )}
    </View>
  );
}
