import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, TYPO, RADIUS, SPACING } from '../theme';
import { LoginCTA } from '../components/ui/LoginCTA';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { CoverImage } from '../components/ui/CoverImage';
import { Icon } from '../components/ui/Icon';
import { SkeletonList } from '../components/ui/Skeleton';
import { HistoryRow as HistoryRowType, listHistory, SeriesRow } from '../lib/progress';
import { useAuth } from '../lib/session';
import { RootStackParamList } from '../navigation/types';
import { useMiniPlayerPad } from '../lib/useMiniPlayerPad';

type Item = HistoryRowType & { series?: SeriesRow };

function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return `${min} phút trước`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} giờ trước`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} ngày trước`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo} tháng trước`;
    return `${Math.floor(mo / 12)} năm trước`;
  } catch (_e) {
    return '';
  }
}

export function HistoryScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const pad = useMiniPlayerPad(true);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!auth.session) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const rows = await listHistory();
      setItems(rows);
    } catch (_e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [auth.session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!auth.session) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Lịch sử" />
        <LoginCTA
          title="Đăng nhập để xem lịch sử"
          message="Lịch sử đọc truyện của bạn sẽ được đồng bộ trên nhiều thiết bị."
          onCta={() => nav.navigate('Login')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Lịch sử" subtitle={items.length > 0 ? `${items.length} truyện đã mở` : undefined} />
      {loading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <SkeletonList count={6} height={70} />
        </View>
      ) : error ? (
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
          <Text style={[TYPO.bodySm, { color: t.textMuted }]}>Không tải được lịch sử.</Text>
          <Pressable onPress={load} style={{ paddingHorizontal: 20, paddingVertical: 9, borderRadius: RADIUS.pill, backgroundColor: t.primary }}>
            <Text style={{ color: t.primaryText, fontSize: 13, fontWeight: '600' }}>Thử lại</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Chưa có lịch sử đọc"
          message="Những truyện bạn từng mở sẽ xuất hiện ở đây."
          ctaLabel="Khám phá truyện"
          onCta={() => nav.navigate('Tabs' as any, { screen: 'Home' } as any)}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.series_id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: pad + 16, gap: 8 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} colors={[t.primary]} tintColor={t.primary} />
          }
          renderItem={({ item }) => {
            const s = item.series;
            if (!s) return null;
            return (
              <Pressable
                onPress={() => nav.navigate('Series', { seriesId: s.id })}
                style={({ pressed }) => [styles.row, { backgroundColor: t.surface, borderColor: t.border }, t.shadowSoft, pressed && { opacity: 0.85 }]}
              >
                <CoverImage title={s.title} coverUrl={s.cover_url} width={50} height={70} borderRadius={RADIUS.sm} />
                <View style={styles.meta}>
                  <Text style={[TYPO.body, { color: t.text, fontWeight: '600' }]} numberOfLines={2}>{s.title}</Text>
                  <Text style={[TYPO.caption, { color: t.textMuted, marginTop: 2 }]}>
                    Đã mở {item.opened_count} lần · {timeAgo(item.last_opened_at)}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={t.border} />
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  meta: { flex: 1, gap: 2, justifyContent: 'center' },
});