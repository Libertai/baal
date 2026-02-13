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
import { requestMagicLink, verifyMagicLink, verifyMagicLinkCode } from "@/lib/api/auth";
import type { TokenPair } from "@/lib/api/types";

export default function MagicLinkScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let data: TokenPair;
      if (/^\d{6}$/.test(token.trim()) && email) {
        data = await verifyMagicLinkCode(email, token.trim());
      } else {
        data = await verifyMagicLink(token.trim());
      }
      await login(data);
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
      await requestMagicLink(email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  return (
    <View className="w-full max-w-sm">
      <Text className="text-2xl font-bold text-center mb-2 text-text-primary">
        Check your email
      </Text>
      <Text className="text-base text-center text-text-secondary mb-8">
        {email
          ? `We sent a code to ${email}`
          : "We sent you a code"}
      </Text>

      {error && (
        <View className="bg-claw-red/10 border border-claw-red/25 p-3 rounded-lg mb-4">
          <Text className="text-claw-red text-sm text-center">
            {error}
          </Text>
        </View>
      )}

      <Text className="text-sm text-text-secondary mb-2">
        Enter the 6-digit code from your email:
      </Text>
      <TextInput
        className="border border-surface-border rounded-lg px-4 py-3 mb-4 text-2xl tracking-[12px] font-mono text-center text-text-primary bg-surface-raised"
        placeholder="000000"
        placeholderTextColor="#5a5464"
        keyboardType="number-pad"
        maxLength={6}
        autoCapitalize="none"
        autoCorrect={false}
        value={token}
        onChangeText={setToken}
      />

      <TouchableOpacity
        className="bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3 mb-4 items-center"
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
        <Text className="text-claw-orange text-sm">
          {resending ? "Resending..." : "Resend code"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="items-center py-2 mt-2"
        onPress={() => router.back()}
      >
        <Text className="text-text-secondary text-sm">
          Back to login
        </Text>
      </TouchableOpacity>
    </View>
  );
}
