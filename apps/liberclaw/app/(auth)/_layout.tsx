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
          backgroundImage:
            "radial-gradient(circle at 50% 30%, rgba(255,94,0,0.12) 0%, transparent 60%)",
        },
      ]}
    >
      {isWeb && <View className="absolute inset-0 carbon-fiber pointer-events-none" />}
      <Slot />
    </View>
  );
}
