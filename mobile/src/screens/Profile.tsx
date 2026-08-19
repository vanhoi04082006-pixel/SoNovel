import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { LoginCTA } from '../components/ui/LoginCTA';
import { useAuth } from '../lib/session';
import { supabase } from '../lib/supabase';
import { setTheme } from '../theme';
import { RootStackParamList } from '../navigation/types';

export function ProfileScreen() {
  const t = useTheme();
  const auth = useAuth();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const email = auth.session?.user?.email ?? '';

  const onLogout = async () => {
    try { await supabase.auth.signOut(); } catch (_e) {}
  };

  if (!auth.session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
        <View style={styles.head}><Text style={[styles.title, { color: t.text }]}>Tài khoản</Text></View>
        <LoginCTA onCta={() => nav.navigate('Login')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={styles.head}><Text style={[styles.title, { color: t.text }]}>Tài khoản</Text></View>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.label, { color: t.textMuted }]}>Email</Text>
        <Text style={[styles.value, { color: t.text }]}>{email}</Text>
      </View>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.text }]}>Giao diện</Text>
        <View style={styles.rowBtns}>
          <Pressable
            onPress={() => setTheme('light')}
            style={[styles.themeBtn, { borderColor: t.border, backgroundColor: t.name === 'light' ? t.primary : t.surface }]}
          >
            <Text style={{ color: t.name === 'light' ? t.primaryText : t.text }}>Sáng</Text>
          </Pressable>
          <Pressable
            onPress={() => setTheme('dark')}
            style={[styles.themeBtn, { borderColor: t.border, backgroundColor: t.name === 'dark' ? t.primary : t.surface }]}
          >
            <Text style={{ color: t.name === 'dark' ? t.primaryText : t.text }}>Tối</Text>
          </Pressable>
          <Pressable
            onPress={() => setTheme(null)}
            style={[styles.themeBtn, { borderColor: t.border, backgroundColor: t.surface }]}
          >
            <Text style={{ color: t.text }}>Hệ thống</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.section}>
        <Pressable
          onPress={onLogout}
          style={[styles.logoutBtn, { borderColor: t.danger, backgroundColor: t.surface }]}
        >
          <Text style={{ color: t.danger, fontSize: 14, fontWeight: '600' }}>Đăng xuất</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  label: { fontSize: 12 },
  value: { fontSize: 15, fontWeight: '600' },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  rowBtns: { flexDirection: 'row', gap: 8 },
  themeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  logoutBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
});
