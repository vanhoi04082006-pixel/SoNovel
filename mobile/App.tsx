import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator, useBootstrap } from './src/navigation';
import { useTheme } from './src/theme';

export default function App() {
  const t = useTheme();
  useBootstrap();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
      <SafeAreaProvider>
        <StatusBar style={t.name === 'dark' ? 'light' : 'dark'} />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
