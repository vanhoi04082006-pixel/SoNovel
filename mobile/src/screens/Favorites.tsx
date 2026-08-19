import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, Dimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { SeriesCard } from '../components/ui/SeriesCard';
import { LoginCTA } from '../components/ui/LoginCTA';
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

  const load = useCallback(async () => {
    if (!auth.session) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listFavorites();
      setItems(rows.map((r) => r.series).filter(Boolean) as SeriesRow[]);
    } catch (_e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [auth.session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!auth.session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
        <View style={styles.head}><Text style={[styles.title, { color: t.text }]}>Yêu thích</Text></View>
        <LoginCTA
          title="Đăng nhập để xem yêu thích"
          message="Lưu và đồng bộ danh sách truyện yêu thích của bạn trên nhiều thiết bị."
          onCta={() => nav.navigate('Login')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={styles.head}><Text style={[styles.title, { color: t.text }]}>Yêu thích</Text></View>
      {loading ? (
        <ActivityIndicator color={t.primary} style={{ padding: 20 }} />
      ) : items.length === 0 ? (
        <Text style={{ color: t.textMuted, fontSize: 13, padding: 16 }}>
          Bạn chưa có truyện yêu thích nào.
        </Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: 8, paddingHorizontal: 16, marginBottom: 8 }}
          contentContainerStyle={{ paddingBottom: pad + 16 }}
          renderItem={({ item }) => (
            <View style={{ width: CARD_W }}>
              <SeriesCard series={item} onPress={(s) => nav.navigate('Series', { seriesId: s.id })} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '700' },
});
