import React, { useState } from 'react';
import { View, TextInput, Pressable, Text } from 'react-native';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View className="flex-row items-end border-t border-gray-200 bg-white px-3 py-2">
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Type a message..."
        placeholderTextColor="#9ca3af"
        multiline
        editable={!disabled}
        className="mr-2 max-h-28 flex-1 rounded-2xl border border-gray-300 px-4 py-2.5 text-base text-gray-900"
      />
      <Pressable
        onPress={handleSend}
        disabled={disabled || !text.trim()}
        className={`items-center justify-center rounded-full px-4 py-2.5 ${
          disabled || !text.trim() ? 'bg-gray-300' : 'bg-blue-600 active:bg-blue-700'
        }`}
      >
        <Text
          className={`text-sm font-semibold ${
            disabled || !text.trim() ? 'text-gray-500' : 'text-white'
          }`}
        >
          Send
        </Text>
      </Pressable>
    </View>
  );
}
