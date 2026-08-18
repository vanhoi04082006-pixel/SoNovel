import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { LoginCTA } from '../components/ui/LoginCTA';
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

  const load = useCallback(async () => {
    if (!auth.session) {
      setItems([]);
      return;
    }
    try {
      const rows = await listHistory();
      setItems(rows);
    } catch (_e) {
      setItems([]);
    }
  }, [auth.session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!auth.session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
        <View style={styles.head}><Text style={[styles.title, { color: t.text }]}>Lịch sử</Text></View>
        <LoginCTA
          title="Đăng nhập để xem lịch sử"
          message="Lịch sử đọc truyện của bạn sẽ được đồng bộ trên nhiều thiết bị."
          onCta={() => nav.navigate('Login')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={styles.head}><Text style={[styles.title, { color: t.text }]}>Lịch sử</Text></View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.series_id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: pad + 16, gap: 8 }}
        renderItem={({ item }) => {
          const s = item.series;
          if (!s) return null;
          return (
            <Pressable
              onPress={() => nav.navigate('Series', { seriesId: s.id })}
              style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}
            >
              {s.cover_url ? (
                <Image source={{ uri: s.cover_url }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={[styles.cover, { backgroundColor: t.bgSubtle, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: t.textMuted }}>🎧</Text>
                </View>
              )}
              <View style={styles.meta}>
                <Text style={[styles.rowTitle, { color: t.text }]} numberOfLines={2}>{s.title}</Text>
                <Text style={[styles.rowMeta, { color: t.textMuted }]}>
                  Đã mở {item.opened_count} lần · {timeAgo(item.last_opened_at)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cover: { width: 50, height: 70, borderRadius: 6 },
  meta: { flex: 1, gap: 4, justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  rowMeta: { fontSize: 12 },
});
