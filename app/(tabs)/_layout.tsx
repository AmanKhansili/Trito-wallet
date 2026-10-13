import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { TYPOGRAPHY } from '../../src/constants/theme';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          ...TYPOGRAPHY.captionBold,
          fontSize: 11,
        },
      }}
    >
      {/* Tab 1: Wallet (Home / Portfolio) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 2: Markets (CoinGecko Live Prices & Trends) */}
      <Tabs.Screen
        name="market"
        options={{
          title: 'Markets',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 3: Swap (DEX Trading) */}
      <Tabs.Screen
        name="swap"
        options={{
          title: 'Swap',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 4: Settings (Security, Accounts, Contacts) */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Hidden from Tab Bar (Accessed directly from Wallet quick action buttons) */}
      <Tabs.Screen
        name="send"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="receive"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
