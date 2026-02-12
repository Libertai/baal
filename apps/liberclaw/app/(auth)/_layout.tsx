import { Slot } from "expo-router";
import { Platform, View } from "react-native";

const isWeb = Platform.OS === "web";

export default function AuthLayout(): React.JSX.Element {
  return (
    <View
      className="flex-1 items-center justify-center bg-surface-base px-6"
      style={[
        isWeb && {
          // @ts-expect-error -- web-only CSS
          backgroundImage: [
            "radial-gradient(circle at 50% 30%, rgba(255,94,0,0.12) 0%, transparent 60%)",
            "linear-gradient(0deg, transparent 24%, rgba(255,94,0,0.03) 25%, rgba(255,94,0,0.03) 26%, transparent 27%, transparent 74%, rgba(255,94,0,0.03) 75%, rgba(255,94,0,0.03) 76%, transparent 77%, transparent)",
            "linear-gradient(90deg, transparent 24%, rgba(255,94,0,0.03) 25%, rgba(255,94,0,0.03) 26%, transparent 27%, transparent 74%, rgba(255,94,0,0.03) 75%, rgba(255,94,0,0.03) 76%, transparent 77%, transparent)",
          ].join(", "),
          backgroundSize: "100% 100%, 60px 60px, 60px 60px",
        },
      ]}
    >
      <Slot />
    </View>
  );
}
