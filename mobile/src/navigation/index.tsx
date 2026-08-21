import React, { useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme, initTheme } from '../theme';
import { initSession } from '../lib/session';
import { initReaderSettings } from '../lib/readerSettings';
import { loadSavedRate } from '../lib/tts';

import { HomeScreen } from '../screens/Home';
import { SearchScreen } from '../screens/Search';
import { FavoritesScreen } from '../screens/Favorites';
import { HistoryScreen } from '../screens/History';
import { ProfileScreen } from '../screens/Profile';
import { SeriesScreen } from '../screens/Series';
import { PlayerScreen } from '../screens/Player';
import { LoginScreen } from '../screens/Login';
import { BookmarksScreen } from '../screens/Bookmarks';
import { StatsScreen } from '../screens/Stats';
import { SettingsScreen } from '../screens/Settings';
import { TabBar } from './TabBar';
import { RootStackParamList, TabsParamList } from './types';

const Tab = createBottomTabNavigator<TabsParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
        tabBarLabelStyle: { fontSize: 11 },
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Trang chủ', tabBarLabel: 'Trang chủ' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'Tìm kiếm', tabBarLabel: 'Tìm kiếm' }} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Yêu thích', tabBarLabel: 'Yêu thích' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Lịch sử', tabBarLabel: 'Lịch sử' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Tài khoản', tabBarLabel: 'Tài khoản' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const t = useTheme();
  const navTheme = {
    ...(t.name === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.name === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: t.bg,
      card: t.surface,
      text: t.text,
      border: t.border,
      primary: t.primary,
      notification: t.danger,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: t.surface },
          headerTintColor: t.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Series"
          component={SeriesScreen}
          options={({ route }) => ({ title: route.params?.seriesId ? 'Chi tiết truyện' : 'Truyện' })}
        />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{ title: 'Trình nghe' }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ presentation: 'modal', title: 'Đăng nhập' }}
        />
        <Stack.Screen
          name="Bookmarks"
          component={BookmarksScreen}
          options={{ title: 'Đánh dấu' }}
        />
        <Stack.Screen
          name="Stats"
          component={StatsScreen}
          options={{ title: 'Thống kê' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Cài đặt' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export function useBootstrap() {
  useEffect(() => {
    initSession();
    initTheme().catch(() => {});
    initReaderSettings().catch(() => {});
    loadSavedRate().catch(() => {});
  }, []);
}
