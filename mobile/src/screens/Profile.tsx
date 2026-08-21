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
import { saveSettings } from '../lib/progress';
import { setTheme, ThemeName } from '../theme';
import { IconName } from '../components/ui/Icon';
import { RootStackParamList } from '../navigation/types';

const THEME_OPTIONS: { name: ThemeName; label: string; icon: IconName }[] = [
  { name: 'light', label: 'Sáng', icon: 'sunny-outline' },
  { name: 'dark', label: 'Tối', icon: 'moon-outline' },
  { name: 'sepia', label: 'Vàng giấy', icon: 'book-outline' },
  { name: 'amoled', label: 'Đen tuyền', icon: 'contrast-outline' },
];

export function ProfileScreen() {
  const t = useTheme();
  const auth = useAuth();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const email = auth.session?.user?.email ?? '';
  const initial = email ? email.charAt(0).toUpperCase() : '?';

  const onLogout = async () => {
    try { await supabase.auth.signOut(); } catch (_e) {}
  };

  const pickTheme = (name: ThemeName | null) => {
    setTheme(name);
    const effective = name ?? (t.name === 'sepia' || t.name === 'amoled' ? t.name : (t.name === 'dark' ? 'dark' : 'light'));
    saveSettings({ theme: effective }).catch(() => {});
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

      {/* Quick links */}
      <View style={styles.section}>
        <View style={styles.quickRow}>
          <QuickLink icon="bookmark-outline" label="Đánh dấu" onPress={() => nav.navigate('Bookmarks')} />
          <QuickLink icon="stats-chart-outline" label="Thống kê" onPress={() => nav.navigate('Stats')} />
          <QuickLink icon="settings-outline" label="Cài đặt" onPress={() => nav.navigate('Settings')} />
          <QuickLink icon="heart-outline" label="Yêu thích" onPress={() => nav.navigate('Tabs' as any, { screen: 'Favorites' } as any)} />
          <QuickLink icon="time-outline" label="Lịch sử" onPress={() => nav.navigate('Tabs' as any, { screen: 'History' } as any)} />
        </View>
      </View>

      {/* Theme */}
      <View style={styles.section}>
        <Text style={[TYPO.title, { color: t.text }]}>Giao diện</Text>
        <View style={styles.themeGrid}>
          {THEME_OPTIONS.map((o) => (
            <Pressable
              key={o.name}
              onPress={() => pickTheme(o.name)}
              style={[styles.themeCard, { borderColor: t.border, backgroundColor: t.name === o.name ? t.primarySoft : t.surface }]}
            >
              <Icon name={o.icon} size={20} color={t.name === o.name ? t.primary : t.textMuted} />
              <Text style={{ color: t.name === o.name ? t.primarySoftText : t.text, fontSize: 12, fontWeight: '600' }}>
                {o.label}
              </Text>
              {t.name === o.name ? <Icon name="checkmark-circle" size={16} color={t.primary} /> : null}
            </Pressable>
          ))}
          <Pressable
            onPress={() => pickTheme(null)}
            style={[styles.themeCard, { borderColor: t.border, backgroundColor: 'transparent' }]}
          >
            <Icon name="contrast-outline" size={20} color={t.textMuted} />
            <Text style={{ color: t.text, fontSize: 12, fontWeight: '500' }}>Hệ thống</Text>
          </Pressable>
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

function QuickLink({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.quickBtn, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Icon name={icon} size={20} color={t.primary} />
      <Text style={[TYPO.caption, { color: t.text }]}>{label}</Text>
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
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
});