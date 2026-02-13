import { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { useTemplates } from "@/lib/hooks/useTemplates";
import type { TemplateSummary, CategoryGroup } from "@/lib/api/types";

const isWeb = Platform.OS === "web";

const MODEL_BRANDS: Record<string, string> = {
  "qwen3-coder-next": "Claw-Core",
  "glm-4.7": "Deep-Claw",
};

const CATEGORY_COLORS: Record<string, string> = {
  developer: "#00e676",
  productivity: "#ffab00",
  web3: "#e040fb",
  creative: "#00bcd4",
  research: "#ff8533",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? "#ff5e00";
}

// ---------------------------------------------------------------------------
// Template Card
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: TemplateSummary;
  onPress: () => void;
}

function TemplateCard({ template, onPress }: TemplateCardProps) {
  const brand = MODEL_BRANDS[template.model] ?? template.model;
  const catColor = getCategoryColor(template.category);

  const nativeCard =
    "bg-surface-raised border border-surface-border rounded-card";
  const webCard = "glass-card glass-card-hover rounded-2xl";
  const cardClass = isWeb ? webCard : nativeCard;

  return (
    <Pressable
      onPress={onPress}
      className={`${cardClass} p-4 mb-3 active:opacity-90`}
    >
      {/* Category accent bar */}
      <View
        className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full"
        style={{ backgroundColor: catColor }}
      />

      {/* Icon + Featured badge */}
      <View className="flex-row items-start justify-between mb-3 mt-1">
        <View
          className="w-12 h-12 rounded-lg items-center justify-center"
          style={{ backgroundColor: `${catColor}15` }}
        >
          <MaterialIcons
            name={template.icon as keyof typeof MaterialIcons.glyphMap}
            size={24}
            color={catColor}
          />
        </View>
        {template.featured && (
          <View className="bg-claw-orange/15 border border-claw-orange/25 rounded-full px-2.5 py-0.5">
            <Text className="font-mono text-[9px] uppercase tracking-wider font-semibold text-claw-orange">
              Featured
            </Text>
          </View>
        )}
      </View>

      {/* Name */}
      <Text
        className="text-lg font-bold text-text-primary mb-1"
        numberOfLines={1}
      >
        {template.name}
      </Text>

      {/* Description */}
      <Text
        className="text-xs text-text-tertiary mb-3 leading-4"
        numberOfLines={2}
      >
        {template.description}
      </Text>

      {/* Model badge + Skill count */}
      <View className="flex-row items-center justify-between">
        <View className="bg-surface-overlay border border-surface-border rounded-full px-2.5 py-0.5">
          <Text className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
            {brand}
          </Text>
        </View>
        {template.skills.length > 0 && (
          <View className="flex-row items-center">
            <MaterialIcons name="extension" size={12} color="#5a5464" />
            <Text className="text-[10px] text-text-tertiary ml-1">
              {template.skills.length} skill{template.skills.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Deploy action */}
      <View className="border-t border-surface-border mt-3 pt-3">
        <View className="flex-row items-center justify-center">
          <MaterialIcons name="rocket-launch" size={14} color="#8a8494" />
          <Text className="text-text-secondary text-xs font-medium ml-1.5">
            Deploy
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Create Custom Card
// ---------------------------------------------------------------------------

interface CreateCustomCardProps {
  onPress: () => void;
}

function CreateCustomCard({ onPress }: CreateCustomCardProps) {
  const nativeCard =
    "border-2 border-dashed border-white/10 rounded-card bg-transparent";
  const webCard =
    "border-2 border-dashed border-white/10 rounded-2xl bg-transparent";
  const cardClass = isWeb ? webCard : nativeCard;

  return (
    <Pressable
      onPress={onPress}
      className={`${cardClass} p-6 mb-3 items-center justify-center active:opacity-80`}
      style={
        isWeb
          ? ({
              transition: "border-color 0.2s, background-color 0.2s",
              minHeight: 220,
            } as any)
          : { minHeight: 220 }
      }
    >
      <View className="w-14 h-14 rounded-full bg-white/5 items-center justify-center mb-3">
        <MaterialIcons name="add" size={28} color="#5a5464" />
      </View>
      <Text className="text-base font-bold text-text-secondary mb-1">
        Create Custom Agent
      </Text>
      <Text className="text-xs text-text-tertiary text-center">
        Build your own agent from scratch with a custom prompt
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Category Filter Pill
// ---------------------------------------------------------------------------

interface CategoryPillProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function CategoryPill({ label, isActive, onPress }: CategoryPillProps) {
  const catColor = label === "All" ? "#ff5e00" : getCategoryColor(label);

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-4 py-1.5 rounded-full ${
        isActive ? "bg-claw-orange" : ""
      }`}
    >
      {!isActive && label !== "All" && (
        <View
          className="w-1.5 h-1.5 rounded-full mr-1.5"
          style={{ backgroundColor: catColor }}
        />
      )}
      <Text
        className={`text-sm font-medium ${
          isActive ? "text-white" : "text-text-secondary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Gallery Screen
// ---------------------------------------------------------------------------

export default function GalleryScreen(): React.JSX.Element {
  const router = useRouter();
  const { data, isLoading, isError, error } = useTemplates();
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = data?.categories ?? [];

  // Build flat list of category names for the filter
  const categoryNames = useMemo(() => {
    const names = categories.map((c: CategoryGroup) => c.name);
    return ["All", ...names];
  }, [categories]);

  // Flatten all templates, optionally filtering by category
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === "All") {
      // Show featured first, then the rest
      const all = categories.flatMap((c: CategoryGroup) => c.templates);
      const featured = all.filter((t: TemplateSummary) => t.featured);
      const rest = all.filter((t: TemplateSummary) => !t.featured);
      return [...featured, ...rest];
    }
    const group = categories.find(
      (c: CategoryGroup) => c.name === selectedCategory
    );
    return group?.templates ?? [];
  }, [categories, selectedCategory]);

  const handleCreateCustom = () => {
    router.push("/agent/create");
  };

  const handleTemplatePress = (template: TemplateSummary) => {
    router.push(`/agent/create?template_id=${template.id}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-base">
        <ActivityIndicator size="large" color="#ff5e00" />
      </View>
    );
  }

  // Error state
  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-base px-8">
        <View
          className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
            isWeb
              ? "glass-card"
              : "bg-surface-raised border border-surface-border"
          }`}
        >
          <MaterialIcons name="error-outline" size={28} color="#ff1744" />
        </View>
        <Text className="text-lg text-text-secondary mb-2">
          Failed to load templates
        </Text>
        <Text className="text-sm text-text-tertiary text-center mb-6">
          {error instanceof Error ? error.message : "Something went wrong"}
        </Text>
        <Pressable
          onPress={handleCreateCustom}
          className={`bg-claw-orange rounded-lg px-6 py-3 active:bg-claw-orange-dark ${
            isWeb ? "glow-orange" : ""
          }`}
        >
          <Text className="text-white font-semibold text-sm">
            Create Custom Agent
          </Text>
        </Pressable>
      </View>
    );
  }

  const filterContainerClass = isWeb
    ? "glass-card rounded-full"
    : "bg-surface-raised rounded-full border border-surface-border";

  // Build data for FlatList: templates + a sentinel for the "Create Custom" card
  const listData: (TemplateSummary | { __custom: true })[] = [
    ...filteredTemplates,
    { __custom: true as const },
  ];

  return (
    <View className="flex-1 bg-surface-base">
      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          "__custom" in item ? "create-custom" : item.id
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        numColumns={isWeb ? 2 : 1}
        key={isWeb ? "web-2col" : "mobile-1col"}
        columnWrapperStyle={isWeb ? { gap: 12 } : undefined}
        ListHeaderComponent={
          <View className="mb-2">
            {/* Header */}
            <View className="mb-6">
              <View className="flex-row items-center gap-3 mb-2">
                <Text className="text-2xl font-bold text-text-primary">
                  Agent Gallery
                </Text>
                <View className="bg-claw-orange/15 border border-claw-orange/25 rounded-full px-2.5 py-0.5">
                  <Text className="font-mono text-[9px] uppercase tracking-wider font-semibold text-claw-orange">
                    {filteredTemplates.length} templates
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-text-tertiary">
                Deploy pre-configured agents or create your own
              </Text>
            </View>

            {/* Category filter pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              <View className={`flex-row ${filterContainerClass} p-1`}>
                {categoryNames.map((name: string) => (
                  <CategoryPill
                    key={name}
                    label={name}
                    isActive={selectedCategory === name}
                    onPress={() => setSelectedCategory(name)}
                  />
                ))}
              </View>
            </ScrollView>

            {/* Category description (when a specific category is selected) */}
            {selectedCategory !== "All" && (
              <View className="mb-4">
                {categories
                  .filter((c: CategoryGroup) => c.name === selectedCategory)
                  .map((c: CategoryGroup) => (
                    <View
                      key={c.id}
                      className={`flex-row items-center p-3 rounded-xl ${
                        isWeb
                          ? "glass-card"
                          : "bg-surface-raised border border-surface-border"
                      }`}
                    >
                      <MaterialIcons
                        name={c.icon as keyof typeof MaterialIcons.glyphMap}
                        size={20}
                        color={getCategoryColor(c.name)}
                      />
                      <Text className="text-xs text-text-secondary ml-2 flex-1">
                        {c.description}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          if ("__custom" in item) {
            return (
              <View className={isWeb ? "flex-1" : ""}>
                <CreateCustomCard onPress={handleCreateCustom} />
              </View>
            );
          }
          return (
            <View className={isWeb ? "flex-1" : ""}>
              <TemplateCard
                template={item}
                onPress={() => handleTemplatePress(item)}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <View
              className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
                isWeb
                  ? "glass-card"
                  : "bg-surface-raised border border-surface-border"
              }`}
            >
              <MaterialIcons name="auto-awesome" size={28} color="#5a5464" />
            </View>
            <Text className="text-lg text-text-secondary mb-2">
              No templates available
            </Text>
            <Text className="text-sm text-text-tertiary mb-6">
              Create a custom agent instead
            </Text>
            <Pressable
              onPress={handleCreateCustom}
              className={`bg-claw-orange rounded-lg px-6 py-3 active:bg-claw-orange-dark ${
                isWeb ? "glow-orange" : ""
              }`}
            >
              <Text className="text-white font-semibold text-sm">
                Create Custom Agent
              </Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}
