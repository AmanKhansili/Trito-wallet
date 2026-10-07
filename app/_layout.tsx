import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { WalletProvider } from '../src/context/WalletContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

function RootNavigation() {
  const { isReady, hasWallet, unlocked } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!hasWallet) {
      // User has no wallet created/imported yet
      if (!inAuthGroup || segments[1] === 'unlock') {
        router.replace('/(auth)/welcome');
      }
    } else if (!unlocked) {
      // Wallet exists on device, but is locked
      if (segments[1] !== 'unlock') {
        router.replace('/(auth)/unlock');
      }
    } else {
      // Wallet exists and is unlocked
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [isReady, hasWallet, unlocked, segments, router]);

  if (!isReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="transaction/details"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="wallet/backup"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="wallet/export"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <WalletProvider>
            <RootNavigation />
          </WalletProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
