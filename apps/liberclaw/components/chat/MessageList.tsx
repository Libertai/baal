import React, { useRef, useCallback } from 'react';
import { FlatList, View } from 'react-native';
import MessageBubble, { Message } from './MessageBubble';
import ToolIndicator from './ToolIndicator';

export interface ChatItem {
  id: string;
  type: 'message' | 'tool';
  message?: Message;
  toolName?: string;
  isRunning?: boolean;
  toolResult?: string;
}

interface MessageListProps {
  messages: ChatItem[];
  isStreaming: boolean;
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  const listRef = useRef<FlatList<ChatItem>>(null);

  const renderItem = useCallback(({ item }: { item: ChatItem }) => {
    if (item.type === 'tool' && item.toolName) {
      return (
        <ToolIndicator
          toolName={item.toolName}
          isRunning={item.isRunning ?? false}
          result={item.toolResult}
        />
      );
    }

    if (item.type === 'message' && item.message) {
      return <MessageBubble message={item.message} />;
    }

    return null;
  }, []);

  const keyExtractor = useCallback((item: ChatItem) => item.id, []);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      inverted
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View className="h-1" />}
    />
  );
}
