import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { SeriesCard } from '../components/ui/SeriesCard';
import { CoverImage } from '../components/ui/CoverImage';
import { Chip } from '../components/ui/Chip';
import { listSeries, listAllProgress, listChapters, SeriesRow, ProgressRow } from '../lib/progress';
import { useAuth } from '../lib/session';
import { setSearchFilter } from '../lib/searchFilter';
import { startTts, TtsChapter } from '../lib/tts';
import { RootStackParamList } from '../navigation/types';
import { useMiniPlayerPad } from '../lib/useMiniPlayerPad';

const GENRES = ['Hệ thống', 'Xuyên không', 'Sảng văn', 'Ngôn tình', 'Kiếm hiệp', 'Tiên hiệp', 'Đô thị', 'Huyền huyễn', 'Đồng nhân', 'Dị giới', 'Võng du', 'Trọng sinh'];

const COLS = 3;
const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - 16 * 2 - 8 * (COLS - 1)) / COLS;

export function HomeScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const pad = useMiniPlayerPad(true);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<SeriesRow[]>([]);
  const [popular, setPopular] = useState<SeriesRow[]>([]);
  const [progressItems, setProgressItems] = useState<(ProgressRow & { series?: SeriesRow })[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        listSeries({ limit: 10, orderBy: 'updated_at' }),
        listSeries({ limit: 10, orderBy: 'word_count' }),
      ]);
      setRecent(r);
      setPopular(p);
      if (auth.session) {
        const prog = await listAllProgress();
        setProgressItems(prog.slice(0, 5));
      } else {
        setProgressItems([]);
      }
    } catch (_e) {
      // ignore — UI sẽ hiện empty state
    } finally {
      setLoading(false);
    }
  }, [auth.session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openSeries = (s: SeriesRow) => nav.navigate('Series', { seriesId: s.id });

  const continueListen = async (item: ProgressRow & { series?: SeriesRow }) => {
    if (!item.series || !item.listen_chapter_id) return;
    try {
      const chs = await listChapters(item.series.id);
      const idx = Math.max(0, chs.findIndex((c) => c.id === item.listen_chapter_id));
      const ttsChapters: TtsChapter[] = chs.map((c) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        order_no: c.order_no,
        word_count: c.word_count,
      }));
      await startTts({
        seriesId: item.series.id,
        seriesTitle: item.series.title,
        coverUrl: item.series.cover_url,
        chapters: ttsChapters,
        startIndex: idx,
        startChar: item.listen_char_index ?? 0,
        rate: item.playback_speed ?? 1.0,
      });
      nav.navigate('Player', {
        seriesId: item.series.id,
        seriesTitle: item.series.title,
        coverUrl: item.series.cover_url,
        startIndex: idx,
        startChar: item.listen_char_index ?? 0,
      });
    } catch (_e) {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: pad + 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[t.primary]} tintColor={t.primary} />}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: t.primary }]}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>🎧 SoNovel</Text>
            <Text style={styles.heroSub}>
              Nghe truyện chữ bằng giọng đọc tổng hợp — miễn phí, không quảng cáo.
            </Text>
          </View>
        </View>

        {/* Continue listening */}
        {progressItems.length > 0 ? (
          <Section title="Tiếp tục nghe">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
              {progressItems.map((item, i) => {
                const s = item.series;
                if (!s) return null;
                const frac = s.word_count > 0 ? Math.min(1, (item.listen_char_index ?? 0) / Math.max(1, s.word_count * 5)) : 0;
                return (
                  <Pressable
                    key={i}
                    onPress={() => continueListen(item)}
                    style={({ pressed }) => [styles.contCard, { backgroundColor: t.surface, borderColor: t.border }, pressed && { opacity: 0.85 }]}
                  >
                    <CoverImage
                      title={s.title}
                      coverUrl={s.cover_url}
                      width={114}
                      height={152}
                      borderRadius={8}
                    />
                    <Text style={[styles.contTitle, { color: t.text }]} numberOfLines={1}>{s.title}</Text>
                    <Text style={[styles.contMeta, { color: t.textMuted }]} numberOfLines={1}>
                      Còn {Math.round((1 - frac) * 100)}% · {Math.ceil((1 - frac) * (s.word_count / 270))} phút
                    </Text>
                    <View style={[styles.contBar, { backgroundColor: t.bgSubtle }]}>
                      <View style={[styles.contBarFill, { width: `${Math.round(frac * 100)}%`, backgroundColor: t.primary }]} />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>
        ) : null}

        {/* Genres */}
        <Section title="Thể loại">
          <View style={styles.chipsRow}>
            {GENRES.map((g) => (
              <Chip
                key={g}
                label={g}
                onPress={() => {
                  setSearchFilter({ genre: g });
                  nav.navigate('Tabs' as any, { screen: 'Search' } as any);
                }}
              />
            ))}
          </View>
        </Section>

        {/* Recent */}
        <Section title="Truyện mới cập nhật">
          <FlatList
            data={recent}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            renderItem={({ item }) => (
              <View style={{ width: 110 }}>
                <SeriesCard series={item} onPress={openSeries} />
              </View>
            )}
            ListEmptyComponent={!loading ? <EmptyLabel t={t} text="Chưa có truyện nào" /> : null}
          />
        </Section>

        {/* Popular */}
        <Section title="Phổ biến">
          <View style={styles.grid}>
            {popular.map((s) => (
              <View key={s.id} style={{ width: CARD_W }}>
                <SeriesCard series={s} onPress={openSeries} />
              </View>
            ))}
            {popular.length === 0 && !loading ? <EmptyLabel t={t} text="Chưa có truyện nào" /> : null}
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function EmptyLabel({ t, text }: { t: ReturnType<typeof useTheme>; text: string }) {
  return <Text style={{ color: t.textMuted, fontSize: 13, paddingHorizontal: 16, paddingVertical: 12 }}>{text}</Text>;
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  heroContent: {
    padding: 20,
    gap: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.92)',
  },
  section: { marginTop: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  contCard: {
    width: 130,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  contTitle: { fontSize: 13, fontWeight: '600' },
  contMeta: { fontSize: 11 },
  contBar: { height: 3, borderRadius: 2, overflow: 'hidden' },
  contBarFill: { height: '100%' },
});
