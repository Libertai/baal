import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/auth/provider";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export default function MagicLinkScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { signIn } = useAuth();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/verify-magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? "Verification failed");
      }
      const data = await res.json();
      await signIn(data.access_token, data.refresh_token);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        throw new Error("Failed to resend");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  return (
    <View className="w-full max-w-sm">
      <Text className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-white">
        Check your email
      </Text>
      <Text className="text-base text-center text-gray-500 dark:text-gray-400 mb-8">
        {email
          ? `We sent a magic link to ${email}`
          : "We sent you a magic link"}
      </Text>

      {error && (
        <View className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg mb-4">
          <Text className="text-red-600 dark:text-red-400 text-sm text-center">
            {error}
          </Text>
        </View>
      )}

      <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        Or enter the code from your email:
      </Text>
      <TextInput
        className="border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 mb-4 text-base text-center tracking-widest text-gray-900 dark:text-white bg-white dark:bg-gray-900"
        placeholder="Enter code"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        autoCorrect={false}
        value={token}
        onChangeText={setToken}
      />

      <TouchableOpacity
        className="bg-blue-600 rounded-lg py-3 mb-4 items-center"
        onPress={handleVerify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Verify</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="items-center py-2"
        onPress={handleResend}
        disabled={resending || !email}
      >
        <Text className="text-blue-600 dark:text-blue-400 text-sm">
          {resending ? "Resending..." : "Resend magic link"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="items-center py-2 mt-2"
        onPress={() => router.back()}
      >
        <Text className="text-gray-500 dark:text-gray-400 text-sm">
          Back to login
        </Text>
      </TouchableOpacity>
    </View>
  );
}
