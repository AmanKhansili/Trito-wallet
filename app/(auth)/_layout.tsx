import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="create-wallet" />
      <Stack.Screen name="recovery-phrase" />
      <Stack.Screen name="verify-recovery" />
      <Stack.Screen name="import-wallet" />
      <Stack.Screen name="unlock" />
    </Stack>
  );
}
