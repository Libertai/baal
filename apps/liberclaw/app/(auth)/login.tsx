import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/lib/auth/provider";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMagicLink = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? "Failed to send magic link");
      }
      router.push({ pathname: "/(auth)/magic-link", params: { email: email.trim() } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    try {
      await WebBrowser.openBrowserAsync(
        `${API_URL}/api/v1/auth/oauth/${provider}`
      );
    } catch {
      setError(`Failed to open ${provider} sign-in`);
    }
  };

  return (
    <View className="w-full max-w-sm">
      <Text className="text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">
        LiberClaw
      </Text>
      <Text className="text-base text-center text-gray-500 dark:text-gray-400 mb-10">
        Deploy and chat with AI agents
      </Text>

      {error && (
        <View className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg mb-4">
          <Text className="text-red-600 dark:text-red-400 text-sm text-center">
            {error}
          </Text>
        </View>
      )}

      {/* Email magic link */}
      <TextInput
        className="border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 mb-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900"
        placeholder="Email address"
        placeholderTextColor="#9ca3af"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
      />
      <TouchableOpacity
        className="bg-blue-600 rounded-lg py-3 mb-6 items-center"
        onPress={handleMagicLink}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">
            Send Magic Link
          </Text>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View className="flex-row items-center mb-6">
        <View className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
        <Text className="mx-4 text-gray-500 dark:text-gray-400 text-sm">or</Text>
        <View className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
      </View>

      {/* OAuth buttons */}
      <TouchableOpacity
        className="border border-gray-300 dark:border-gray-700 rounded-lg py-3 mb-3 items-center flex-row justify-center"
        onPress={() => handleOAuth("google")}
      >
        <Text className="text-base text-gray-900 dark:text-white">
          Continue with Google
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-gray-300 dark:border-gray-700 rounded-lg py-3 mb-3 items-center flex-row justify-center"
        onPress={() => handleOAuth("github")}
      >
        <Text className="text-base text-gray-900 dark:text-white">
          Continue with GitHub
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-gray-300 dark:border-gray-700 rounded-lg py-3 items-center opacity-50"
        disabled
      >
        <Text className="text-base text-gray-400 dark:text-gray-500">
          Connect Wallet (coming soon)
        </Text>
      </TouchableOpacity>
    </View>
  );
}
