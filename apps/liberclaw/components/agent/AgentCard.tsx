import React from 'react';
import { View, Text } from 'react-native';
import Card from '../ui/Card';
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
}

const modelLabels: Record<string, string> = {
  'qwen3-coder-next': 'Qwen 3 Coder Next',
  'glm-4.7': 'GLM 4.7',
};

export default function AgentCard({ agent, onPress }: AgentCardProps) {
  return (
    <Card onPress={onPress} className="mb-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {agent.name}
        </Text>
        <AgentStatusBadge status={agent.deployment_status} />
      </View>
      <Text className="mt-1 text-sm text-gray-500">
        {modelLabels[agent.model] ?? agent.model}
      </Text>
    </Card>
  );
}
