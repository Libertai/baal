import React from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface Model {
  id: string;
  brand: string;
  label: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  stat: { label: string; value: string };
  recommended?: boolean;
}

const models: Model[] = [
  {
    id: 'qwen3-coder-next',
    brand: 'Claw-Core',
    label: 'qwen3-coder-next',
    description: 'Balanced performance for general autonomous tasks and coding.',
    icon: 'balance',
    stat: { label: 'Context', value: '98K' },
    recommended: true,
  },
  {
    id: 'glm-4.7',
    brand: 'Deep-Claw',
    label: 'glm-4.7',
    description: 'Complex reasoning capabilities for research and strategy.',
    icon: 'psychology',
    stat: { label: 'Context', value: '128K' },
  },
];

interface ModelSelectorProps {
  selected: string;
  onSelect: (modelId: string) => void;
}

export default function ModelSelector({ selected, onSelect }: ModelSelectorProps) {
  return (
    <View className="gap-3">
      {models.map((model) => {
        const isSelected = selected === model.id;
        return (
          <Pressable
            key={model.id}
            onPress={() => onSelect(model.id)}
            className={`rounded-card border-2 p-5 ${
              isSelected
                ? 'border-claw-orange bg-claw-orange/5'
                : 'border-surface-border bg-surface-raised'
            }`}
          >
            {model.recommended && (
              <View className="absolute top-0 right-0 bg-claw-orange px-2 py-0.5 rounded-bl-lg rounded-tr-card">
                <Text className="text-[10px] font-bold text-white uppercase">Recommended</Text>
              </View>
            )}

            <View className="flex-row items-start justify-between mb-3">
              <View className="w-10 h-10 rounded-lg bg-surface-overlay items-center justify-center">
                <MaterialIcons
                  name={model.icon}
                  size={22}
                  color={isSelected ? '#ff5e00' : '#8a8494'}
                />
              </View>
              <View className="items-end">
                <Text className="text-[10px] text-text-tertiary font-mono uppercase">
                  {model.stat.label}
                </Text>
                <Text className="text-sm font-bold text-text-primary">{model.stat.value}</Text>
              </View>
            </View>

            <Text className="text-lg font-bold text-text-primary mb-0.5">
              {model.brand}
            </Text>
            <Text className="font-mono text-[10px] text-claw-orange mb-2">
              {model.label}
            </Text>
            <Text className="text-xs text-text-secondary leading-relaxed">
              {model.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
