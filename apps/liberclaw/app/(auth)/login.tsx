import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import ClawLogo from "@/components/ui/ClawLogo";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";

import { useAuth } from "@/lib/auth/provider";
import {
  guestLogin,
  mobileGoogleLogin,
  mobileAppleLogin,
  requestMagicLink,
  getGoogleOAuthUrl,
  getGitHubOAuthUrl,
} from "@/lib/api/auth";

const isWeb = Platform.OS === "web";
const isIOS = Platform.OS === "ios";
const isAndroid = Platform.OS === "android";

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpoGo, setIsExpoGo] = useState(false);

  useEffect(() => {
    if (!isWeb) {
      import("expo-constants").then(({ default: Constants }) => {
        setIsExpoGo(Constants.appOwnership === "expo");
      });
    }
  }, []);

  async function handleMagicLink(): Promise<void> {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await requestMagicLink(email.trim());
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
      const url =
        provider === "google" ? getGoogleOAuthUrl() : getGitHubOAuthUrl();
      if (isWeb) {
        window.location.href = url;
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
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

  function renderError(): React.JSX.Element | null {
    if (!error) return null;
    return (
      <View className="bg-claw-red/10 border border-claw-red/25 p-3 rounded-lg mb-4">
        <Text className="text-claw-red text-sm text-center">{error}</Text>
      </View>
    );
  }

  // ── Web layout (unchanged) ─────────────────────────────────────────

  if (isWeb) {
    return (
      <View className="w-full max-w-sm">
        <View className="glass-card rounded-3xl p-8">
          {/* Logo */}
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
          <Text className="font-bold text-2xl tracking-tight text-white uppercase font-mono text-center mb-1">
            LIBERCLAW
          </Text>
          <View className="items-center mb-8">
            <View className="w-12 h-px bg-claw-red/50" />
          </View>

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

          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-px bg-surface-border" />
            <Text className="mx-4 text-text-tertiary text-sm">or</Text>
            <View className="flex-1 h-px bg-surface-border" />
          </View>

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

  // ── Mobile layout (matches mockup) ──────────────────────────────────

  const showNativeGoogle = isAndroid && !isExpoGo;
  const showNativeApple = isIOS && !isExpoGo;

  return (
    <KeyboardAvoidingView
      behavior={isIOS ? "padding" : "height"}
      className="flex-1 w-full"
    >
      {/* Background glow blobs */}
      <Svg
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <SvgRadialGradient id="blob1" cx="15%" cy="15%" r="35%">
            <Stop offset="0" stopColor="#3713ec" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#3713ec" stopOpacity="0" />
          </SvgRadialGradient>
          <SvgRadialGradient id="blob2" cx="85%" cy="90%" r="30%">
            <Stop offset="0" stopColor="#ff003c" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#ff003c" stopOpacity="0" />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#blob1)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#blob2)" />
      </Svg>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-8">
          {/* ── Logo ── */}
          <View className="items-center mb-10">
            <View className="flex-row items-center gap-3 mb-4">
              <LinearGradient
                colors={["#ff5e00", "#dc2626"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#ff5e00",
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <ClawLogo size={28} color="#fff" />
              </LinearGradient>
              <Text
                className="text-3xl tracking-tight text-white uppercase"
                style={{ fontFamily: "JetBrainsMono-Bold" }}
              >
                LIBERCLAW
              </Text>
            </View>
            <View className="w-12 h-px bg-claw-red/50" />
          </View>

          {/* ── Hero image ── */}
          <View className="mb-8 rounded-xl overflow-hidden border border-white/10">
            <Image
              source={require("@/assets/images/login-hero.png")}
              className="w-full h-40"
              style={{ resizeMode: "cover", opacity: 0.7 }}
            />
            <LinearGradient
              colors={["transparent", "#0a0810"]}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 60 }}
            />
          </View>

          {/* ── Hero text ── */}
          <View className="mb-10">
            <Text className="text-5xl font-extrabold leading-tight text-white mb-4 tracking-tight">
              Unstoppable AI{"\n"}at your{" "}
              <Text className="text-claw-orange">command.</Text>
            </Text>
            <Text className="text-gray-400 text-lg leading-relaxed">
              Harness the industrial-grade intelligence of LiberClaw. No limits,
              just raw processing power.
            </Text>
          </View>

          {renderError()}

          {/* ── Actions ── */}

          {/* Continue with Email — tap to expand */}
          {!showEmailInput ? (
            <TouchableOpacity
              className="h-14 bg-claw-orange active:bg-claw-orange-dark rounded-lg flex-row items-center justify-center gap-2 mb-5"
              style={{ shadowColor: "#ff5e00", shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 }}
              onPress={() => setShowEmailInput(true)}
            >
              <MaterialIcons name="mail-outline" size={22} color="#fff" />
              <Text className="text-white font-bold text-lg">
                Continue with Email
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="mb-5">
              <TextInput
                className="border border-surface-border rounded-lg px-4 h-14 text-lg text-text-primary bg-surface-raised mb-4"
                placeholder="Email address"
                placeholderTextColor="#5a5464"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={handleMagicLink}
              />
              <TouchableOpacity
                className="h-14 bg-claw-orange active:bg-claw-orange-dark rounded-lg items-center justify-center"
                style={{ shadowColor: "#ff5e00", shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 }}
                onPress={handleMagicLink}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-lg">
                    Send Code
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Social login buttons — side by side */}
          {(showNativeGoogle || showNativeApple) && (
            <View className="flex-row gap-3 mb-5">
              {showNativeGoogle && (
                <TouchableOpacity
                  className="flex-1 h-14 flex-row items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 active:bg-white/10"
                  onPress={handleGoogleSignIn}
                  disabled={loading}
                >
                  <MaterialIcons name="g-mobiledata" size={24} color="#fff" />
                  <Text className="text-white text-base font-semibold">
                    Google
                  </Text>
                </TouchableOpacity>
              )}
              {showNativeApple && (
                <TouchableOpacity
                  className="flex-1 h-14 flex-row items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 active:bg-white/10"
                  onPress={handleAppleSignIn}
                  disabled={loading}
                >
                  <MaterialIcons name="apple" size={24} color="#fff" />
                  <Text className="text-white text-base font-semibold">
                    Apple
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Guest login */}
          <View className="pt-4">
            <TouchableOpacity
              className="py-3 flex-row items-center justify-center gap-1"
              onPress={handleGuestLogin}
              disabled={loading}
            >
              <Text className="text-gray-400 text-base font-medium">
                Start as Guest
              </Text>
              <MaterialIcons name="arrow-forward" size={16} color="#8a8494" />
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="mt-8 pt-5 border-t border-white/5">
            <Text className="text-xs text-gray-500 text-center leading-relaxed">
              Guest accounts have limited memory and session limits.{"\n"}
              By continuing, you agree to our Terms & Privacy Policy.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
