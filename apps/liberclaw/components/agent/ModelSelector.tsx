import { View, Text, Pressable, Platform } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const isWeb = Platform.OS === "web";

interface Model {
  id: string;
  brand: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  stat: { label: string; value: string };
  detail: string;
  recommended?: boolean;
  disabled?: boolean;
}

const MODELS: Model[] = [
  {
    id: "claw-flash",
    brand: "Claw-Flash",
    description: "Rapid execution for lightweight tasks. Optimized for speed over depth.",
    icon: "flash-on",
    stat: { label: "Speed", value: "High" },
    detail: "> LATENCY: 15ms",
    disabled: true,
  },
  {
    id: "qwen3-coder-next",
    brand: "Claw-Core",
    description: "Balanced performance for general autonomous tasks and coding.",
    icon: "balance",
    stat: { label: "Cost", value: "Medium" },
    detail: "> CONTEXT: 128k",
    recommended: true,
  },
  {
    id: "glm-4.7",
    brand: "Deep-Claw",
    description: "Advanced reasoning capabilities for research, strategy, and complex analysis.",
    icon: "psychology",
    stat: { label: "IQ", value: "Max" },
    detail: "> REASONING: L2",
  },
];

interface ModelSelectorProps {
  selected: string;
  onSelect: (modelId: string) => void;
}

export default function ModelSelector({ selected, onSelect }: ModelSelectorProps) {
  return (
    <View className={`gap-3 ${isWeb ? "md:flex-row" : ""}`}>
      {MODELS.map((model) => {
        const isSelected = selected === model.id;
        const isDisabled = model.disabled === true;

        return (
          <Pressable
            key={model.id}
            onPress={() => {
              if (!isDisabled) onSelect(model.id);
            }}
            disabled={isDisabled}
            className={[
              "rounded-xl border p-5",
              isWeb ? "flex-1" : "",
              isSelected
                ? "border-claw-orange bg-claw-orange/5"
                : "border-white/10 bg-surface-raised",
              isDisabled ? "opacity-50" : "",
            ].join(" ")}
            style={
              isSelected && isWeb
                ? { boxShadow: "0 0 20px rgba(255,94,0,0.1)" }
                : undefined
            }
          >
            {/* Recommended badge */}
            {model.recommended && (
              <View className="absolute top-0 right-0 bg-claw-orange px-2.5 py-1 rounded-bl-lg rounded-tr-xl">
                <Text className="text-[9px] font-bold text-white uppercase tracking-wider">
                  Recommended
                </Text>
              </View>
            )}

            {/* Coming Soon badge */}
            {isDisabled && (
              <View className="absolute top-0 right-0 bg-white/10 px-2.5 py-1 rounded-bl-lg rounded-tr-xl">
                <Text className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">
                  Coming Soon
                </Text>
              </View>
            )}

            {/* Top row: icon + stat */}
            <View className="flex-row items-start justify-between mb-3">
              <View className="w-10 h-10 rounded-lg bg-white/5 items-center justify-center">
                <MaterialIcons
                  name={model.icon}
                  size={22}
                  color={isSelected ? "#ff5e00" : "#8a8494"}
                />
              </View>
              <View className="items-end">
                <Text className="text-[10px] text-text-tertiary font-mono uppercase">
                  {model.stat.label}
                </Text>
                <Text className="text-sm font-bold text-text-primary">
                  {model.stat.value}
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text className="text-lg font-bold text-text-primary">
              {model.brand}
            </Text>

            {/* Model name */}
            <Text className="font-mono text-[10px] text-claw-orange mb-2">
              {isDisabled ? "model-tbd" : model.id}
            </Text>

            {/* Description */}
            <Text className="text-xs text-text-secondary leading-relaxed">
              {model.description}
            </Text>

            {/* Bottom detail line */}
            <Text className="text-[10px] font-mono text-claw-orange border-t border-white/5 pt-2 mt-2">
              {model.detail}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
