import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, TYPO, RADIUS } from '../theme';
import { SeriesCard } from '../components/ui/SeriesCard';
import { Chip } from '../components/ui/Chip';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { listSeries, SeriesRow } from '../lib/progress';
import { invalidateCache } from '../lib/dataCache';
import { RootStackParamList } from '../navigation/types';

const COLS = 3;
const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - 16 * 2 - 8 * (COLS - 1)) / COLS;

type Sort = 'new' | 'title' | 'chapters';

const SORT_TABS: { key: Sort; label: string }[] = [
  { key: 'new', label: 'Mới cập nhật' },
  { key: 'chapters', label: 'Nhiều chương' },
  { key: 'title', label: 'Tiêu đề A→Z' },
];

/**
 * Màn "Tất cả truyện" — đích của "Xem tất cả" trên Trang chủ.
 * Lưới vô hạn (infinite scroll), đổi sort không mất vị trí đầu.
 */
export function CatalogScreen() {
  const t = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'Catalog'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [sort, setSort] = useState<Sort>(route.params?.sort ?? 'new');
  const [items, setItems] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const PAGE = 30;

  // Đổi sort → reset danh sách
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDone(false);
    setItems([]);
    (async () => {
      try {
        const rows = await listSeries({
          limit: PAGE,
          offset: 0,
          orderBy: sort === 'title' ? 'title' : sort === 'chapters' ? 'word_count' : 'updated_at',
          ascending: sort === 'title',
        });
        if (!cancelled) {
          setItems(rows);
          if (rows.length < PAGE) setDone(true);
        }
      } catch (_e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sort]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || done || items.length === 0) return;
    setLoadingMore(true);
    try {
      const rows = await listSeries({
        limit: PAGE,
        offset: items.length,
        orderBy: sort === 'title' ? 'title' : sort === 'chapters' ? 'word_count' : 'updated_at',
        ascending: sort === 'title',
      });
      // Cache có thể trả trang trùng lặp khi dữ liệu đổi giữa chừng — lọc id đã có.
      const seen = new Set(items.map((i) => i.id));
      const fresh = rows.filter((r) => !seen.has(r.id));
      setItems((prev) => [...prev, ...fresh]);
      if (fresh.length < PAGE) setDone(true);
    } catch (_e) {
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, done, items, sort]);

  const openSeries = useCallback((s: SeriesRow) => nav.navigate('Series', { seriesId: s.id }), [nav]);

  const onRefresh = useCallback(async () => {
    invalidateCache('series:');
    setLoading(true);
    try {
      const rows = await listSeries({
        limit: PAGE,
        offset: 0,
        orderBy: sort === 'title' ? 'title' : sort === 'chapters' ? 'word_count' : 'updated_at',
        ascending: sort === 'title',
      });
      setItems(rows);
      setDone(rows.length < PAGE);
    } catch (_e) {
    } finally {
      setLoading(false);
    }
  }, [sort]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* Header */}
      <View style={[styles.head, { borderBottomColor: t.border }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Quay lại">
          <Icon name="arrow-back" size={22} color={t.text} />
        </Pressable>
        <Text style={[TYPO.h3, { color: t.text, flex: 1 }]} numberOfLines={1}>
          {route.params?.title ?? 'Tất cả truyện'}
        </Text>
      </View>

      {/* Sort */}
      <View style={styles.sortRow}>
        {SORT_TABS.map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            selected={sort === s.key}
            variant={sort === s.key ? 'filled' : 'soft'}
            compact
            onPress={() => setSort(s.key)}
          />
        ))}
      </View>

      {/* Grid */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 104, gap: 8 }}
        columnWrapperStyle={{ gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={loading && items.length > 0} onRefresh={onRefresh} colors={[t.primary]} tintColor={t.primary} />
        }
        renderItem={({ item }) => (
          <View style={{ width: CARD_W }}>
            <SeriesCard series={item} onPress={openSeries} />
          </View>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          loading && items.length === 0 ? (
            <View style={styles.gridSkeleton}>
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} width={CARD_W} height={CARD_W * 1.5 + 40} radius={RADIUS.md} />
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={t.primary} style={{ padding: 12 }} /> :
          done && items.length > 0 ? (
            <Text style={[TYPO.caption, { color: t.textMuted, textAlign: 'center', paddingVertical: 16 }]}>
              Đã hiển thị tất cả {items.length} truyện
            </Text>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <EmptyState icon="library-outline" title="Chưa có truyện nào" message="Dữ liệu đang được cập nhật." />
              <Pressable
                onPress={onRefresh}
                style={[styles.retryBtn, { backgroundColor: t.primary }]}
              >
                <Text style={{ color: t.primaryText, fontSize: 13, fontWeight: '600' }}>Thử lại</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  gridSkeleton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
});
