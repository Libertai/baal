import React from 'react';
import { Pressable, Text } from 'react-native';

type OAuthProvider = 'google' | 'github';

interface OAuthButtonProps {
  provider: OAuthProvider;
  onPress: () => void;
}

const providerConfig: Record<OAuthProvider, { label: string; bg: string; text: string }> = {
  google: {
    label: 'Continue with Google',
    bg: 'bg-white border border-gray-300 active:bg-gray-50',
    text: 'text-gray-900',
  },
  github: {
    label: 'Continue with GitHub',
    bg: 'bg-gray-900 active:bg-gray-800',
    text: 'text-white',
  },
};

export default function OAuthButton({ provider, onPress }: OAuthButtonProps) {
  const config = providerConfig[provider];

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-center rounded-lg px-5 py-3 ${config.bg}`}
    >
      <Text className={`text-base font-semibold ${config.text}`}>
        {config.label}
      </Text>
    </Pressable>
  );
}
