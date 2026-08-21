import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, TYPO, SPACING, RADIUS } from '../theme';
import { SeriesCard } from '../components/ui/SeriesCard';
import { CoverImage } from '../components/ui/CoverImage';
import { Chip } from '../components/ui/Chip';
import { Screen } from '../components/ui/Screen';
import { Skeleton } from '../components/ui/Skeleton';
import { Icon } from '../components/ui/Icon';
import { listSeries, listAllProgress, listChapters, getSeries, SeriesRow, ProgressRow } from '../lib/progress';
import { useAuth } from '../lib/session';
import { setSearchFilter } from '../lib/searchFilter';
import { startTts, TtsChapter, listLocalProgress } from '../lib/tts';
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
  const firstLoadRef = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
        const locals = await listLocalProgress();
        const items: (ProgressRow & { series?: SeriesRow })[] = [];
        for (const lp of locals.slice(0, 5)) {
          try {
            const s = await getSeries(lp.seriesId);
            if (s) {
              items.push({
                user_id: 'local',
                series_id: lp.seriesId,
                listen_chapter_id: lp.chapterId,
                listen_char_index: lp.charIndex,
                audio_sec: 0,
                playback_speed: 1.0,
                last_listened_at: lp.lastListenedAt,
                read_chapter_id: null,
                read_char_index: 0,
                read_percent: 0,
                last_read_at: null,
                series: s,
              });
            }
          } catch (_e) {}
        }
        setProgressItems(items);
      }
    } catch (_e) {
    } finally {
      if (!silent) setLoading(false);
    }
  }, [auth.session]);

  useFocusEffect(useCallback(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      load(false);
    } else {
      load(true);
    }
  }, [load]));

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
    <Screen scroll refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(false)} colors={[t.primary]} tintColor={t.primary} />}
      contentContainerStyle={{ paddingBottom: pad + 16 }}>
      {/* Hero gradient */}
      <LinearGradient
        colors={t.gradientHero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>SoNovel</Text>
          <Text style={styles.heroSub}>
            Nghe truyện chữ bằng giọng đọc tổng hợp — miễn phí, không quảng cáo.
          </Text>
          <Pressable
            onPress={() => nav.navigate('Tabs' as any, { screen: 'Search' } as any)}
            style={styles.heroSearch}
          >
            <Icon name="search" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.heroSearchText}>Tìm truyện, tác giả…</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Continue listening */}
      {loading ? (
        <View style={styles.section}>
          <Skeleton width={150} height={20} />
          <Skeleton width="100%" height={170} radius={RADIUS.xl} />
        </View>
      ) : progressItems.length > 0 ? (
        <Section title="Tiếp tục nghe">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {progressItems.map((item, i) => {
              const s = item.series;
              if (!s) return null;
              const frac = s.word_count > 0 ? Math.min(1, (item.listen_char_index ?? 0) / Math.max(1, s.word_count * 5)) : 0;
              return (
                <Pressable
                  key={i}
                  onPress={() => continueListen(item)}
                  style={({ pressed }) => [styles.contCard, { backgroundColor: t.surface, borderColor: t.border }, t.shadowSoft, pressed && { opacity: 0.85 }]}
                >
                  <CoverImage
                    title={s.title}
                    coverUrl={s.cover_url}
                    width={116}
                    height={154}
                    borderRadius={RADIUS.md}
                    shadow
                  />
                  <View style={styles.contPlay}>
                    <Icon name="play" size={14} color={t.primaryText} />
                  </View>
                  <Text style={[TYPO.bodySm, { color: t.text, fontWeight: '600' }]} numberOfLines={1}>{s.title}</Text>
                  <View style={[styles.contBar, { backgroundColor: t.bgSubtle }]}>
                    <View style={[styles.contBarFill, { width: `${Math.round(frac * 100)}%`, backgroundColor: t.primary }]} />
                  </View>
                  <Text style={[TYPO.caption, { color: t.textMuted }]} numberOfLines={1}>
                    {Math.round((1 - frac) * 100)}% còn lại
                  </Text>
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
              icon="pricetag-outline"
              iconSize={12}
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
        {loading ? (
          <SkeletonListRow />
        ) : (
          <FlatList
            data={recent}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            renderItem={({ item }) => (
              <View style={{ width: 112 }}>
                <SeriesCard series={item} onPress={openSeries} showChapterCount />
              </View>
            )}
            ListEmptyComponent={!loading ? <EmptyLabel t={t} text="Chưa có truyện nào" /> : null}
          />
        )}
      </Section>

      {/* Popular */}
      <Section title="Phổ biến">
        {loading ? (
          <SkeletonGrid />
        ) : (
          <View style={styles.grid}>
            {popular.map((s) => (
              <View key={s.id} style={{ width: CARD_W }}>
                <SeriesCard series={s} onPress={openSeries} />
              </View>
            ))}
            {popular.length === 0 && !loading ? <EmptyLabel t={t} text="Chưa có truyện nào" /> : null}
          </View>
        )}
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[TYPO.h3, { color: t.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function SkeletonListRow() {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} width={112} height={170} radius={RADIUS.md} />
      ))}
    </View>
  );
}

function SkeletonGrid() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} width={CARD_W} height={CARD_W * 1.5 + 40} radius={RADIUS.md} />
      ))}
    </View>
  );
}

function EmptyLabel({ t, text }: { t: ReturnType<typeof useTheme>; text: string }) {
  return <Text style={[TYPO.bodySm, { color: t.textMuted, paddingHorizontal: 16, paddingVertical: 12 }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: 16,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  heroContent: {
    padding: 20,
    gap: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
    fontFamily: 'BeVietnamPro_800ExtraBold',
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.92)',
  },
  heroSearch: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroSearchText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
  },
  section: { marginTop: 24, gap: 12 },
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
    width: 132,
    padding: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 4,
    position: 'relative',
  },
  contPlay: {
    position: 'absolute',
    right: 12,
    top: 122,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(124,58,237,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contBar: { height: 3, borderRadius: 2, overflow: 'hidden' },
  contBarFill: { height: '100%' },
});