import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface Model {
  id: string;
  label: string;
  description: string;
}

const models: Model[] = [
  {
    id: 'qwen3-coder-next',
    label: 'Qwen 3 Coder Next',
    description: 'High-performance coding model with 98K context',
  },
  {
    id: 'glm-4.7',
    label: 'GLM 4.7',
    description: 'General-purpose model with 128K context',
  },
];

interface ModelSelectorProps {
  selected: string;
  onSelect: (modelId: string) => void;
}

export default function ModelSelector({ selected, onSelect }: ModelSelectorProps) {
  return (
    <View className="gap-2">
      {models.map((model) => {
        const isSelected = selected === model.id;
        return (
          <Pressable
            key={model.id}
            onPress={() => onSelect(model.id)}
            className={`rounded-lg border-2 p-4 ${
              isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
          >
            <View className="flex-row items-center">
              <View
                className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                  isSelected ? 'border-blue-600' : 'border-gray-300'
                }`}
              >
                {isSelected ? (
                  <View className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                ) : null}
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">
                  {model.label}
                </Text>
                <Text className="mt-0.5 text-sm text-gray-500">
                  {model.description}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
