import React from 'react';
import { View, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View
      className={`mb-2 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}
    >
      <View
        className={`rounded-2xl px-4 py-2.5 ${
          isUser ? 'rounded-br-sm bg-blue-600' : 'rounded-bl-sm bg-gray-200'
        }`}
      >
        {isUser ? (
          <Text className="text-base text-white">{message.content}</Text>
        ) : (
          <Markdown
            style={{
              body: { color: '#111827', fontSize: 16 },
              code_inline: {
                backgroundColor: '#e5e7eb',
                paddingHorizontal: 4,
                borderRadius: 4,
                fontSize: 14,
              },
              fence: {
                backgroundColor: '#1f2937',
                color: '#e5e7eb',
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
              },
            }}
          >
            {message.content}
          </Markdown>
        )}
      </View>
      {message.timestamp ? (
        <Text
          className={`mt-1 text-xs text-gray-400 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {message.timestamp}
        </Text>
      ) : null}
    </View>
  );
}
