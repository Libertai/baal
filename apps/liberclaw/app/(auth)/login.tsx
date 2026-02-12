import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import ClawLogo from "@/components/ui/ClawLogo";
import * as WebBrowser from "expo-web-browser";

import { useAuth } from "@/lib/auth/provider";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const isWeb = Platform.OS === "web";

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(): Promise<void> {
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
      router.push({
        pathname: "/(auth)/magic-link",
        params: { email: email.trim() },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github"): Promise<void> {
    try {
      await WebBrowser.openBrowserAsync(
        `${API_URL}/api/v1/auth/oauth/${provider}`,
      );
    } catch {
      setError(`Failed to open ${provider} sign-in`);
    }
  }

  return (
    <View className="w-full max-w-sm">
      <View className={isWeb ? "glass-card rounded-3xl p-8" : ""}>
        {/* Logo icon (web only) */}
        {isWeb && (
          <View className="items-center mb-4">
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, #ff5e00, #dc2626)",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(255,94,0,0.4)",
              } as any}
            >
              <ClawLogo size={28} color="#fff" />
            </View>
          </View>
        )}

        {/* Title */}
        <Text
          className={`text-3xl font-bold text-center mb-1 text-text-primary ${isWeb ? "glow-text-orange" : ""}`}
        >
          Liber<Text className="text-claw-orange">Claw</Text>
        </Text>
        <Text className="font-mono text-xs uppercase tracking-widest text-claw-orange/70 text-center mb-8">
          Autonomous AI Agents
        </Text>

        {/* Error banner */}
        {error && (
          <View className="bg-claw-red/10 border border-claw-red/25 p-3 rounded-lg mb-4">
            <Text className="text-claw-red text-sm text-center">{error}</Text>
          </View>
        )}

        {/* Email input */}
        <TextInput
          className={`border rounded-lg px-4 py-3 mb-3 text-base text-text-primary bg-surface-raised ${
            isWeb
              ? "border-surface-border/50 focus:border-claw-orange/50"
              : "border-surface-border"
          }`}
          placeholder="Email address"
          placeholderTextColor="#5a5464"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        {/* Magic link button */}
        <TouchableOpacity
          className={`bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3 mb-6 items-center ${isWeb ? "glow-orange" : ""}`}
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
          <View className="flex-1 h-px bg-surface-border" />
          <Text className="mx-4 text-text-tertiary text-sm">or</Text>
          <View className="flex-1 h-px bg-surface-border" />
        </View>

        {/* OAuth buttons */}
        <TouchableOpacity
          className={`bg-white border border-white/20 active:bg-gray-100 rounded-lg py-3 mb-3 items-center flex-row justify-center ${isWeb ? "glass-card-hover" : ""}`}
          onPress={() => handleOAuth("google")}
        >
          <Text className="text-base text-gray-900 font-semibold">
            Continue with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`bg-surface-raised border border-surface-border active:bg-surface-overlay rounded-lg py-3 mb-3 items-center flex-row justify-center ${isWeb ? "glass-card-hover" : ""}`}
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
    </View>
  );
}
