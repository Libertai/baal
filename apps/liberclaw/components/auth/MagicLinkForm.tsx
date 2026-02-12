import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface MagicLinkFormProps {
  onSubmit: (email: string) => void;
  isLoading?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function MagicLinkForm({
  onSubmit,
  isLoading = false,
}: MagicLinkFormProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }
    setError(undefined);
    onSubmit(trimmed);
  };

  return (
    <View>
      <Input
        label="Email address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (error) setError(undefined);
        }}
        placeholder="you@example.com"
        error={error}
      />
      <Button
        title="Send magic link"
        onPress={handleSubmit}
        loading={isLoading}
        disabled={isLoading}
      />
    </View>
  );
}
