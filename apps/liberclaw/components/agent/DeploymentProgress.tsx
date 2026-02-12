import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useDeploymentStatus } from '@/lib/hooks/useDeployment';
import type { DeploymentStep as ApiStep } from '@/lib/api/types';

interface StepDef {
  label: string;
  key: string;
}

const STEPS: StepDef[] = [
  { key: 'provisioning', label: 'Provisioning VM' },
  { key: 'allocation', label: 'Network allocation' },
  { key: 'ssh', label: 'Secure connection' },
  { key: 'environment', label: 'Environment setup' },
  { key: 'service', label: 'Service activation' },
  { key: 'health', label: 'Health check' },
];

interface DeploymentProgressProps {
  agentId: string;
}

export default function DeploymentProgress({ agentId }: DeploymentProgressProps) {
  const { data } = useDeploymentStatus(agentId);
  const apiSteps: ApiStep[] = data?.steps ?? [];

  // Determine current step from API data or default to 0
  let currentStep = 0;
  if (apiSteps.length > 0) {
    const activeIdx = apiSteps.findIndex((s) => s.status === 'active');
    const doneCount = apiSteps.filter((s) => s.status === 'done').length;
    currentStep = activeIdx >= 0 ? activeIdx : doneCount;
  }

  const progress = Math.min(((currentStep + 1) / STEPS.length) * 100, 100);

  return (
    <View className="bg-surface-raised border border-surface-border rounded-card p-5 mb-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-bold text-text-primary">
          Deploying Agent
        </Text>
        <Text className="font-mono text-xs text-claw-orange">
          {Math.round(progress)}%
        </Text>
      </View>

      {/* Progress bar */}
      <View className="h-1.5 bg-surface-border rounded-full mb-6 overflow-hidden">
        <View
          className="h-full bg-claw-orange rounded-full"
          style={{ width: `${progress}%` }}
        />
      </View>

      {/* Vertical timeline */}
      <View className="relative">
        {/* Connecting line */}
        <View className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-surface-border" />
        <View
          className="absolute left-[15px] top-4 w-0.5 bg-claw-orange"
          style={{ height: `${Math.max(0, ((currentStep) / (STEPS.length - 1)) * 100)}%` }}
        />

        {STEPS.map((step, index) => {
          const isDone = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;

          return (
            <View key={step.key} className="flex-row items-center mb-4 last:mb-0">
              {/* Step icon */}
              <View className="z-10">
                {isDone ? (
                  <View className="w-8 h-8 rounded-full bg-claw-orange items-center justify-center">
                    <MaterialIcons name="check" size={16} color="#ffffff" />
                  </View>
                ) : isCurrent ? (
                  <View className="w-8 h-8 rounded-full bg-surface-base border-2 border-claw-orange items-center justify-center">
                    <ActivityIndicator size="small" color="#ff5e00" />
                  </View>
                ) : (
                  <View className="w-8 h-8 rounded-full bg-surface-base border border-surface-border items-center justify-center">
                    <Text className="font-mono text-[10px] text-text-tertiary font-bold">
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Step label */}
              <View className="ml-3 flex-1">
                <Text
                  className={`text-sm font-medium ${
                    isDone
                      ? 'text-text-secondary'
                      : isCurrent
                      ? 'text-text-primary font-bold'
                      : 'text-text-tertiary'
                  }`}
                >
                  {step.label}
                </Text>
                {isDone && (
                  <Text className="font-mono text-[10px] text-status-running uppercase mt-0.5">
                    Complete
                  </Text>
                )}
                {isCurrent && (
                  <Text className="font-mono text-[10px] text-claw-orange uppercase mt-0.5">
                    In Progress
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Terminal log */}
      <View className="mt-4 bg-surface-base border border-surface-border rounded-lg p-3">
        <Text className="font-mono text-[10px] text-text-tertiary">
          {'> init_deployment_protocol()'}
        </Text>
        <Text className="font-mono text-[10px] text-text-tertiary">
          {'> allocating_resources...'}
        </Text>
        <Text className="font-mono text-[10px] text-claw-orange">
          {'> waiting for confirmation_'}
        </Text>
      </View>
    </View>
  );
}
