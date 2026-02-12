import React from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AgentStatusBadge from './AgentStatusBadge';

export interface Agent {
  id: number;
  name: string;
  model: string;
  deployment_status: string;
  system_prompt?: string;
}

interface AgentCardProps {
  agent: Agent;
  onPress: () => void;
  onChat?: () => void;
  onEdit?: () => void;
}

const MODEL_BRANDS: Record<string, { name: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  'qwen3-coder-next': { name: 'Claw-Core', icon: 'balance' },
  'glm-4.7': { name: 'Deep-Claw', icon: 'psychology' },
};

export default function AgentCard({ agent, onPress, onChat, onEdit }: AgentCardProps) {
  const brand = MODEL_BRANDS[agent.model] ?? { name: agent.model, icon: 'smart-toy' as keyof typeof MaterialIcons.glyphMap };
  const initial = agent.name.charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-raised border border-surface-border rounded-card p-4 mb-3 active:opacity-90"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="w-10 h-10 rounded-lg bg-claw-orange/10 border border-claw-orange/20 items-center justify-center">
          <Text className="text-claw-orange font-bold text-lg">{initial}</Text>
        </View>
        <AgentStatusBadge status={agent.deployment_status} />
      </View>

      <Text className="text-base font-bold text-text-primary mb-1" numberOfLines={1}>
        {agent.name}
      </Text>

      <View className="flex-row items-center gap-2 mb-4">
        <View className="bg-surface-overlay border border-surface-border rounded px-2 py-0.5">
          <Text className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
            {brand.name}
          </Text>
        </View>
      </View>

      {(onChat || onEdit) && (
        <View className="flex-row border-t border-surface-border pt-3 gap-3">
          {onChat && agent.deployment_status === 'running' && (
            <Pressable
              onPress={onChat}
              className="flex-1 flex-row items-center justify-center py-2 rounded-lg active:bg-surface-overlay"
            >
              <MaterialIcons name="chat-bubble-outline" size={16} color="#8a8494" />
              <Text className="text-text-secondary text-xs font-medium ml-1.5">Chat</Text>
            </Pressable>
          )}
          {onEdit && (
            <Pressable
              onPress={onEdit}
              className="flex-1 flex-row items-center justify-center py-2 rounded-lg active:bg-surface-overlay"
            >
              <MaterialIcons name="edit" size={16} color="#8a8494" />
              <Text className="text-text-secondary text-xs font-medium ml-1.5">Edit</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}
