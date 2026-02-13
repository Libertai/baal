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
import {
  guestLogin,
  mobileGoogleLogin,
  mobileAppleLogin,
} from "@/lib/api/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const isWeb = Platform.OS === "web";
const isIOS = Platform.OS === "ios";
const isAndroid = Platform.OS === "android";

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

  async function handleGoogleSignIn(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const { GoogleOneTapSignIn } = await import(
        "@react-native-google-signin/google-signin"
      );
      const response = await GoogleOneTapSignIn.signIn();
      if (response.type === "success" && response.data.idToken) {
        const tokens = await mobileGoogleLogin(response.data.idToken);
        await login(tokens);
        router.replace("/(tabs)");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const AppleAuth = await import("expo-apple-authentication");
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const fullName = credential.fullName
          ? `${credential.fullName.givenName ?? ""} ${credential.fullName.familyName ?? ""}`.trim()
          : undefined;
        const tokens = await mobileAppleLogin(
          credential.identityToken,
          fullName || undefined,
        );
        await login(tokens);
        router.replace("/(tabs)");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Apple sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuestLogin(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const Application = await import("expo-application");
      let deviceId: string;
      if (isAndroid) {
        deviceId = Application.androidId ?? `android-${Date.now()}`;
      } else {
        deviceId =
          (await Application.getIosIdForVendorsAsync()) ?? `ios-${Date.now()}`;
      }
      const tokens = await guestLogin(deviceId);
      await login(tokens);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Guest login failed");
    } finally {
      setLoading(false);
    }
  }

  // ── Shared UI fragments ────────────────────────────────────────────

  function renderLogo(): React.JSX.Element {
    return (
      <>
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

        <Text
          className={`text-3xl font-bold text-center mb-1 text-text-primary ${isWeb ? "glow-text-orange" : ""}`}
        >
          Liber<Text className="text-claw-orange">Claw</Text>
        </Text>
        <Text className="font-mono text-xs uppercase tracking-widest text-claw-orange/70 text-center mb-8">
          Autonomous AI Agents
        </Text>
      </>
    );
  }

  function renderError(): React.JSX.Element | null {
    if (!error) return null;
    return (
      <View className="bg-claw-red/10 border border-claw-red/25 p-3 rounded-lg mb-4">
        <Text className="text-claw-red text-sm text-center">{error}</Text>
      </View>
    );
  }

  function renderDivider(): React.JSX.Element {
    return (
      <View className="flex-row items-center mb-6">
        <View className="flex-1 h-px bg-surface-border" />
        <Text className="mx-4 text-text-tertiary text-sm">or</Text>
        <View className="flex-1 h-px bg-surface-border" />
      </View>
    );
  }

  // ── Web layout (unchanged) ─────────────────────────────────────────

  if (isWeb) {
    return (
      <View className="w-full max-w-sm">
        <View className="glass-card rounded-3xl p-8">
          {renderLogo()}
          {renderError()}

          {/* Email input */}
          <TextInput
            className="border rounded-lg px-4 py-3 mb-3 text-base text-text-primary bg-surface-raised border-surface-border/50 focus:border-claw-orange/50"
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
            className="bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3 mb-6 items-center glow-orange"
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

          {renderDivider()}

          {/* OAuth buttons */}
          <TouchableOpacity
            className="bg-white border border-white/20 active:bg-gray-100 rounded-lg py-3 mb-3 items-center flex-row justify-center glass-card-hover"
            onPress={() => handleOAuth("google")}
          >
            <Text className="text-base text-gray-900 font-semibold">
              Continue with Google
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-surface-raised border border-surface-border active:bg-surface-overlay rounded-lg py-3 mb-3 items-center flex-row justify-center glass-card-hover"
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

  // ── Mobile layout (iOS / Android) ──────────────────────────────────

  return (
    <View className="w-full max-w-sm">
      {renderLogo()}
      {renderError()}

      {/* Platform-specific native sign-in button */}
      {isIOS && (
        <TouchableOpacity
          className="bg-white rounded-lg py-3 mb-4 items-center flex-row justify-center active:bg-gray-100"
          onPress={handleAppleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-base text-black font-semibold">
              Sign in with Apple
            </Text>
          )}
        </TouchableOpacity>
      )}

      {isAndroid && (
        <TouchableOpacity
          className="bg-white rounded-lg py-3 mb-4 items-center flex-row justify-center active:bg-gray-100"
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-base text-gray-900 font-semibold">
              Continue with Google
            </Text>
          )}
        </TouchableOpacity>
      )}

      {renderDivider()}

      {/* Email input */}
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

      {/* Send Code button */}
      <TouchableOpacity
        className="bg-claw-orange active:bg-claw-orange-dark rounded-lg py-3 mb-6 items-center"
        onPress={handleMagicLink}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Send Code</Text>
        )}
      </TouchableOpacity>

      {renderDivider()}

      {/* Guest login */}
      <TouchableOpacity
        className="items-center py-2"
        onPress={handleGuestLogin}
        disabled={loading}
      >
        <Text className="text-text-tertiary text-sm">Start as guest</Text>
      </TouchableOpacity>
    </View>
  );
}
