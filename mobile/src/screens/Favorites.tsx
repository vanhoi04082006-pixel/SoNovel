import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, Dimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, TYPO, RADIUS, SPACING } from '../theme';
import { SeriesCard } from '../components/ui/SeriesCard';
import { LoginCTA } from '../components/ui/LoginCTA';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import { listFavorites, SeriesRow } from '../lib/progress';
import { useAuth } from '../lib/session';
import { RootStackParamList } from '../navigation/types';
import { useMiniPlayerPad } from '../lib/useMiniPlayerPad';

const COLS = 3;
const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - 16 * 2 - 8 * (COLS - 1)) / COLS;

export function FavoritesScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const pad = useMiniPlayerPad(true);
  const [items, setItems] = useState<SeriesRow[]>([]);
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
      const rows = await listFavorites();
      setItems(rows.map((r) => r.series).filter(Boolean) as SeriesRow[]);
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
        <ScreenHeader title="Yêu thích" />
        <LoginCTA
          title="Đăng nhập để xem yêu thích"
          message="Lưu và đồng bộ danh sách truyện yêu thích của bạn trên nhiều thiết bị."
          onCta={() => nav.navigate('Login')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Yêu thích" subtitle={items.length > 0 ? `${items.length} truyện` : undefined} />
      {loading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <SkeletonList count={6} height={200} />
        </View>
      ) : error ? (
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
          <Text style={[TYPO.bodySm, { color: t.textMuted }]}>Không tải được danh sách yêu thích.</Text>
          <Pressable onPress={load} style={{ paddingHorizontal: 20, paddingVertical: 9, borderRadius: RADIUS.pill, backgroundColor: t.primary }}>
            <Text style={{ color: t.primaryText, fontSize: 13, fontWeight: '600' }}>Thử lại</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="Bạn chưa có truyện yêu thích"
          message="Nhấn trái tim trên trang truyện để lưu vào danh sách này."
          ctaLabel="Khám phá truyện"
          onCta={() => nav.navigate('Tabs' as any, { screen: 'Home' } as any)}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: 8, paddingHorizontal: 16, marginBottom: 8 }}
          contentContainerStyle={{ paddingBottom: pad + 16 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} colors={[t.primary]} tintColor={t.primary} />
          }
          renderItem={({ item }) => (
            <View style={{ width: CARD_W }}>
              <SeriesCard series={item} onPress={(s) => nav.navigate('Series', { seriesId: s.id })} favorited />
            </View>
          )}
        />
      )}
    </Screen>
  );
}