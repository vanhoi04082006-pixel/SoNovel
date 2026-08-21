import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, TYPO, RADIUS } from '../theme';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { CoverImage } from '../components/ui/CoverImage';
import { Icon } from '../components/ui/Icon';
import { SkeletonList } from '../components/ui/Skeleton';
import { listBookmarks, deleteBookmark, BookmarkRow } from '../lib/progress';
import { showToast } from '../lib/toast';
import { RootStackParamList } from '../navigation/types';
import { useMiniPlayerPad } from '../lib/useMiniPlayerPad';

function timeAgo(iso: string): string {
  try {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return `${min} phút trước`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} giờ trước`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} ngày trước`;
    return `${Math.floor(d / 30)} tháng trước`;
  } catch (_e) { return ''; }
}

export function BookmarksScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const pad = useMiniPlayerPad(true);
  const [items, setItems] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setItems(await listBookmarks());
    } catch (_e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = async (id: string) => {
    const prev = items;
    setItems((cur) => cur.filter((b) => b.id !== id));
    try {
      await deleteBookmark(id);
    } catch (_e) {
      setItems(prev);
      showToast('Xóa đánh dấu thất bại.');
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Đánh dấu" subtitle={items.length > 0 ? `${items.length} vị trí` : undefined} />
      {loading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <SkeletonList count={5} height={72} />
        </View>
      ) : error ? (
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
          <Text style={[TYPO.bodySm, { color: t.textMuted }]}>Không tải được danh sách đánh dấu.</Text>
          <Pressable onPress={load} style={{ paddingHorizontal: 20, paddingVertical: 9, borderRadius: RADIUS.pill, backgroundColor: t.primary }}>
            <Text style={{ color: t.primaryText, fontSize: 13, fontWeight: '600' }}>Thử lại</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="Chưa có đánh dấu"
          message="Nhấn 'Đánh dấu' trong trình nghe để lưu vị trí yêu thích."
          ctaLabel="Khám phá truyện"
          onCta={() => nav.navigate('Tabs' as any, { screen: 'Home' } as any)}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: pad + 16, gap: 8 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[t.primary]} tintColor={t.primary} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.seriesId ? nav.navigate('Series', { seriesId: item.seriesId }) : undefined}
              style={({ pressed }) => [styles.row, { backgroundColor: t.surface, borderColor: t.border }, t.shadowSoft, pressed && { opacity: 0.85 }]}
            >
              <CoverImage title={item.series?.title ?? '?'} coverUrl={item.series?.coverUrl} width={46} height={62} borderRadius={RADIUS.sm} />
              <View style={styles.meta}>
                <Text style={[TYPO.body, { color: t.text, fontWeight: '600' }]} numberOfLines={1}>
                  {item.series?.title ?? 'Truyện'}
                </Text>
                <Text style={[TYPO.caption, { color: t.textMuted }]} numberOfLines={1}>
                  Ký tự {item.charIndex} · {timeAgo(item.createdAt)}
                </Text>
                {item.note ? (
                  <Text style={[TYPO.caption, { color: t.primary, fontStyle: 'italic' }]} numberOfLines={1}>"{item.note}"</Text>
                ) : null}
              </View>
              <Pressable onPress={() => onDelete(item.id)} hitSlop={8} style={styles.del}>
                <Icon name="trash-outline" size={18} color={t.danger} />
              </Pressable>
            </Pressable>
          )}
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
  del: { padding: 6 },
});
