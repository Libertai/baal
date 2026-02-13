import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const isWeb = Platform.OS === "web";
const MAX_PROMPT_LENGTH = 2000;

export const PROMPT_TEMPLATES = [
  {
    label: "Expert Coder",
    icon: "code" as const,
    description: "Clean, efficient code with clear explanations and best practices.",
    prompt:
      "You are an expert software engineer. Write clean, efficient code. Explain your reasoning.",
  },
  {
    label: "Creative Writer",
    icon: "edit-note" as const,
    description: "Engaging, original content with vivid storytelling and imagery.",
    prompt:
      "You are a creative writer. Craft engaging, original content with vivid storytelling.",
  },
  {
    label: "Executive Assistant",
    icon: "calendar-month" as const,
    description: "Organized scheduling, task management, and professional communication.",
    prompt:
      "You are an executive assistant. Help with scheduling, task management, and professional communication.",
  },
  {
    label: "Socratic Tutor",
    icon: "school" as const,
    description: "Guide learning through thoughtful questions rather than direct answers.",
    prompt:
      "You are a Socratic tutor. Guide the learner through questions rather than giving direct answers.",
  },
  {
    label: "Data Analyst",
    icon: "analytics" as const,
    description: "Thorough, evidence-based analysis with data-driven insights and charts.",
    prompt:
      "You are a data analyst. Provide thorough, evidence-based analysis with clear data insights.",
  },
];

function getRiskLevel(prompt: string): { label: string; color: string; bgColor: string } {
  const length = prompt.length;
  if (length < 400) {
    return { label: "Low", color: "#00e676", bgColor: "rgba(0, 230, 118, 0.1)" };
  }
  if (length < 1200) {
    return { label: "Medium", color: "#ff5e00", bgColor: "rgba(255, 94, 0, 0.1)" };
  }
  return { label: "High", color: "#ff003c", bgColor: "rgba(255, 0, 60, 0.1)" };
}

function generateLineNumbers(text: string): string[] {
  const lineCount = Math.max(text.split("\n").length, 10);
  return Array.from({ length: lineCount }, (_, i) => String(i + 1));
}

interface SoulEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  maxLength?: number;
  /** Show line numbers on web (default: true) */
  showLineNumbers?: boolean;
  /** Minimum height for the editor area */
  minHeight?: number;
  /** Hide built-in prompt template pills (default: false) */
  hideTemplates?: boolean;
}

export default function SoulEditor({
  value,
  onChangeText,
  maxLength = MAX_PROMPT_LENGTH,
  showLineNumbers = true,
  minHeight = 200,
  hideTemplates = false,
}: SoulEditorProps): React.JSX.Element {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const lineNumbers = useMemo(() => generateLineNumbers(value), [value]);
  const risk = useMemo(() => getRiskLevel(value), [value]);

  function handleTemplateSelect(template: (typeof PROMPT_TEMPLATES)[number]): void {
    setSelectedTemplate(template.label);
    onChangeText(template.prompt);
  }

  return (
    <View>
      {/* Template pills (hidden when parent provides its own) */}
      {!hideTemplates && (
        <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
          {PROMPT_TEMPLATES.map((template) => {
            const isSelected = selectedTemplate === template.label;
            return (
              <Pressable
                key={template.label}
                onPress={() => handleTemplateSelect(template)}
                className={`rounded-full px-4 py-2 flex-row items-center gap-2 ${
                  isSelected
                    ? "bg-claw-orange/20 border border-claw-orange/40"
                    : "bg-surface-overlay border border-surface-border"
                }`}
              >
                <MaterialIcons
                  name={template.icon}
                  size={14}
                  color={isSelected ? "#ff5e00" : "#8a8494"}
                />
                <Text
                  className={`text-xs font-semibold ${
                    isSelected ? "text-claw-orange" : "text-text-secondary"
                  }`}
                >
                  {template.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Editor area with line numbers */}
      <View
        className="rounded-xl overflow-hidden border border-surface-border"
        style={{ backgroundColor: "#0d0d12", minHeight }}
      >
        <View className="relative flex-1" style={{ minHeight }}>
          {/* Line numbers (web only) */}
          {isWeb && showLineNumbers && (
            <View
              className="absolute top-0 bottom-0 left-0 border-r border-surface-border"
              style={{ width: 40, backgroundColor: "#08060e" }}
            >
              <View className="py-3 pr-2">
                {lineNumbers.map((num) => (
                  <Text
                    key={num}
                    className="font-mono text-right leading-6"
                    style={{ fontSize: 12, color: "#3a3444" }}
                  >
                    {num}
                  </Text>
                ))}
              </View>
            </View>
          )}

          <TextInput
            className="flex-1 font-mono text-sm text-slate-300"
            style={[
              {
                paddingTop: 12,
                paddingBottom: 12,
                paddingRight: 12,
                paddingLeft: isWeb && showLineNumbers ? 52 : 12,
                lineHeight: 24,
                textAlignVertical: "top",
                minHeight,
              },
              isWeb && {
                // @ts-expect-error -- web-only CSS property
                outline: "none",
              },
            ]}
            placeholderTextColor="#3a3444"
            placeholder="Define your agent's personality and behavior..."
            multiline
            textAlignVertical="top"
            value={value}
            onChangeText={(text) => {
              if (text.length <= maxLength) {
                onChangeText(text);
              }
            }}
          />
        </View>
      </View>

      {/* Footer: char counter + risk level */}
      <View className="flex-row items-center justify-between mt-3">
        <View className="flex-row items-center gap-3">
          <Text className="font-mono text-xs text-text-tertiary">
            {value.length}
            <Text className="text-text-tertiary/50"> / {maxLength}</Text>
          </Text>
          <View
            className="flex-row items-center gap-1.5 rounded px-2 py-0.5"
            style={{ backgroundColor: risk.bgColor }}
          >
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: risk.color }} />
            <Text className="text-[10px] font-mono font-medium" style={{ color: risk.color }}>
              {risk.label}
            </Text>
          </View>
        </View>
        {isWeb && (
          <Pressable className="flex-row items-center gap-1.5 bg-surface-overlay border border-surface-border rounded px-2 py-1">
            <MaterialIcons name="data-object" size={12} color="#8a8494" />
            <Text className="text-[10px] text-text-secondary font-medium">Insert Variable</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
