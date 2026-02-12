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
  const { login } = useAuth();
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
      <Text className="text-3xl font-bold text-center mb-1 text-text-primary">
        Liber<Text className="text-claw-orange">Claw</Text>
      </Text>
      <Text className="font-mono text-xs uppercase tracking-widest text-claw-orange/70 text-center mb-8">
        Autonomous AI Agents
      </Text>

      {error && (
        <View className="bg-claw-red/10 border border-claw-red/25 p-3 rounded-lg mb-4">
          <Text className="text-claw-red text-sm text-center">
            {error}
          </Text>
        </View>
      )}

      <TextInput
        className="border border-surface-border rounded-lg px-4 py-3 mb-3 text-base text-text-primary bg-surface-raised"
        placeholder="Email address"
        placeholderTextColor="#5a5464"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
      />
      <TouchableOpacity
        className="bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3 mb-6 items-center"
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

      <View className="flex-row items-center mb-6">
        <View className="flex-1 h-px bg-surface-border" />
        <Text className="mx-4 text-text-tertiary text-sm">or</Text>
        <View className="flex-1 h-px bg-surface-border" />
      </View>

      <TouchableOpacity
        className="bg-white border border-white/20 active:bg-gray-100 rounded-lg py-3 mb-3 items-center flex-row justify-center"
        onPress={() => handleOAuth("google")}
      >
        <Text className="text-base text-gray-900 font-semibold">
          Continue with Google
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="bg-surface-raised border border-surface-border active:bg-surface-overlay rounded-lg py-3 mb-3 items-center flex-row justify-center"
        onPress={() => handleOAuth("github")}
      >
        <Text className="text-base text-text-primary font-semibold">
          Continue with GitHub
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-surface-border rounded-lg py-3 items-center opacity-50"
        disabled
      >
        <Text className="text-base text-text-tertiary">
          Connect Wallet (coming soon)
        </Text>
      </TouchableOpacity>
    </View>
  );
}
