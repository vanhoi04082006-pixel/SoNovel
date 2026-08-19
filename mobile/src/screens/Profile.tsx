import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, TYPO, RADIUS, SPACING } from '../theme';
import { LoginCTA } from '../components/ui/LoginCTA';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Icon } from '../components/ui/Icon';
import { AppButton } from '../components/ui/AppButton';
import { useAuth } from '../lib/session';
import { supabase } from '../lib/supabase';
import { setTheme } from '../theme';
import { RootStackParamList } from '../navigation/types';

export function ProfileScreen() {
  const t = useTheme();
  const auth = useAuth();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const email = auth.session?.user?.email ?? '';
  const initial = email ? email.charAt(0).toUpperCase() : '?';

  const onLogout = async () => {
    try { await supabase.auth.signOut(); } catch (_e) {}
  };

  if (!auth.session) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Tài khoản" />
        <LoginCTA onCta={() => nav.navigate('Login')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Tài khoản" />

      {/* Account card */}
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <LinearGradient
          colors={t.gradientPrimary}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </LinearGradient>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[TYPO.title, { color: t.text }]} numberOfLines={1}>{email}</Text>
          <Text style={[TYPO.caption, { color: t.textMuted }]}>Đã đăng nhập</Text>
        </View>
      </View>

      {/* Theme */}
      <View style={styles.section}>
        <Text style={[TYPO.title, { color: t.text }]}>Giao diện</Text>
        <View style={[styles.segmented, { backgroundColor: t.bgSubtle }]}>
          <ThemeSegment label="Sáng" icon="sunny-outline" active={t.name === 'light'} onPress={() => setTheme('light')} />
          <ThemeSegment label="Tối" icon="moon-outline" active={t.name === 'dark'} onPress={() => setTheme('dark')} />
          <ThemeSegment label="Hệ thống" icon="contrast-outline" active={t.name !== 'light' && t.name !== 'dark'} onPress={() => setTheme(null)} />
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <AppButton
          label="Đăng xuất"
          variant="danger"
          icon="log-out-outline"
          onPress={onLogout}
        />
      </View>
    </Screen>
  );
}

function ThemeSegment({ label, icon, active, onPress }: { label: string; icon: any; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segBtn, { backgroundColor: active ? t.primary : 'transparent' }]}
    >
      <Icon name={icon} size={18} color={active ? t.primaryText : t.textMuted} />
      <Text style={{ color: active ? t.primaryText : t.textMuted, fontSize: 12, fontWeight: active ? '700' : '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  section: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  segmented: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
});