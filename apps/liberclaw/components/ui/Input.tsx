import React from 'react';
import { View, Text, TextInput } from 'react-native';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
}

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  multiline = false,
  secureTextEntry = false,
}: InputProps) {
  return (
    <View className="mb-4">
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        className={`rounded-lg border px-4 py-3 text-base text-gray-900 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${multiline ? 'min-h-[100px]' : ''}`}
      />
      {error ? (
        <Text className="mt-1 text-sm text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}
