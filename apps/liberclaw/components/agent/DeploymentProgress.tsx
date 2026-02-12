import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import ProgressBar from '../ui/ProgressBar';

interface DeploymentStep {
  label: string;
  key: string;
}

const steps: DeploymentStep[] = [
  { key: 'pending', label: 'Queued' },
  { key: 'provisioning', label: 'Provisioning VM' },
  { key: 'deploying', label: 'Deploying agent code' },
  { key: 'configuring', label: 'Configuring HTTPS' },
  { key: 'running', label: 'Running' },
];

interface DeploymentProgressProps {
  agentId: number;
  onComplete: () => void;
}

export default function DeploymentProgress({
  agentId,
  onComplete,
}: DeploymentProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState('pending');

  // Placeholder for useDeploymentStatus hook integration
  // In production, this would poll the API for deployment status
  useEffect(() => {
    if (status === 'running') {
      onComplete();
    }
  }, [status, onComplete]);

  const progress = (currentStep + 1) / steps.length;

  return (
    <View className="rounded-xl bg-white p-4">
      <Text className="mb-3 text-lg font-semibold text-gray-900">
        Deploying Agent
      </Text>
      <ProgressBar progress={progress} className="mb-4" />
      <View className="gap-2">
        {steps.map((step, index) => {
          const isDone = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <View key={step.key} className="flex-row items-center">
              <Text className="mr-2 w-5 text-center text-sm">
                {isDone ? '[x]' : isCurrent ? '[ ]' : '   '}
              </Text>
              <Text
                className={`text-sm ${
                  isDone
                    ? 'text-green-600'
                    : isCurrent
                    ? 'font-medium text-gray-900'
                    : 'text-gray-400'
                }`}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
