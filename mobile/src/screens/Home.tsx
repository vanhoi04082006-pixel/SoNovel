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
import { SectionHeader } from '../components/ui/SectionHeader';
import { RankBadge } from '../components/ui/RankBadge';
import { Chip } from '../components/ui/Chip';
import { Screen } from '../components/ui/Screen';
import { Skeleton } from '../components/ui/Skeleton';
import { Icon } from '../components/ui/Icon';
import { listSeries, listAllProgress, listChapters, getSeries, SeriesRow, ProgressRow } from '../lib/progress';
import { useAuth } from '../lib/session';
import { startTts, TtsChapter, listLocalProgress } from '../lib/tts';
import { RootStackParamList } from '../navigation/types';
import { useMiniPlayerPad } from '../lib/useMiniPlayerPad';

const RANK_TABS: { key: 'new' | 'chapters'; label: string }[] = [
  { key: 'new', label: 'Mới cập nhật' },
  { key: 'chapters', label: 'Nhiều chương' },
];

export function HomeScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const pad = useMiniPlayerPad(true);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<SeriesRow[]>([]);
  const [rankNew, setRankNew] = useState<SeriesRow[]>([]);
  const [rankLong, setRankLong] = useState<SeriesRow[]>([]);
  const [rankTab, setRankTab] = useState<'new' | 'chapters'>('new');
  const [progressItems, setProgressItems] = useState<(ProgressRow & { series?: SeriesRow })[]>([]);
  const firstLoadRef = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Song song toàn bộ request — không chờ tuần tự.
      const progressPromise: Promise<(ProgressRow & { series?: SeriesRow })[]> =
        auth.session
          ? listAllProgress().catch(() => [])
          : listLocalProgress()
              .then(async (locals) => {
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
                return items;
              })
              .catch(() => []);

      const [r, rankN, rankL, prog] = await Promise.all([
        listSeries({ limit: 10, orderBy: 'updated_at' }).catch(() => [] as SeriesRow[]),
        listSeries({ limit: 5, orderBy: 'word_count' }).catch(() => [] as SeriesRow[]),
        listSeries({ limit: 5, orderBy: 'updated_at' }).catch(() => [] as SeriesRow[]),
        progressPromise,
      ]);
      setRecent(r);
      // Bảng xếp hạng: "Mới cập nhật" theo updated_at, "Nhiều chương" theo word_count.
      setRankNew(rankL.slice(0, 5));
      setRankLong(rankN.slice(0, 5));
      setProgressItems(prog.slice(0, 5));
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

  const openCatalog = (sort: 'new' | 'chapters') =>
    nav.navigate('Catalog', { sort, title: sort === 'new' ? 'Truyện mới cập nhật' : 'Truyện nhiều chương' });

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

  const rankList = rankTab === 'new' ? rankNew : rankLong;

  return (
    <Screen scroll refreshControl={
      <RefreshControl refreshing={loading} onRefresh={() => load(false)} colors={[t.primary]} tintColor={t.primary} />
    } contentContainerStyle={{ paddingBottom: pad + 16 }}>
      {/* Brand header gọn */}
      <View style={styles.brandRow}>
        <View>
          <Text style={[styles.brandTitle, { color: t.text }]}>SoNovel</Text>
          <Text style={[TYPO.caption, { color: t.textMuted }]}>Nghe truyện chữ bằng giọng đọc tổng hợp</Text>
        </View>
        <Pressable
          onPress={() => nav.navigate('Catalog', { title: 'Tất cả truyện' })}
          style={({ pressed }) => [styles.allBtn, { backgroundColor: t.primarySoft }, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Xem tất cả truyện"
        >
          <Icon name="library-outline" size={15} color={t.primarySoftText} />
          <Text style={[TYPO.label, { color: t.primarySoftText }]}>Tất cả</Text>
        </Pressable>
      </View>

      {/* Continue listening */}
      {loading ? (
        <View style={styles.section}>
          <Skeleton width={150} height={20} />
          <Skeleton width="100%" height={170} radius={RADIUS.xl} />
        </View>
      ) : progressItems.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Tiếp tục nghe" />
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
        </View>
      ) : null}

      {/* Bảng xếp hạng */}
      <View style={styles.section}>
        <SectionHeader title="Bảng xếp hạng" onAction={() => openCatalog(rankTab === 'new' ? 'new' : 'chapters')} />
        <View style={styles.rankTabs}>
          {RANK_TABS.map((rt) => (
            <Chip
              key={rt.key}
              label={rt.label}
              selected={rankTab === rt.key}
              variant={rankTab === rt.key ? 'filled' : 'soft'}
              onPress={() => setRankTab(rt.key)}
            />
          ))}
        </View>
        {loading ? (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={64} radius={RADIUS.lg} />
            ))}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {rankList.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => openSeries(s)}
                style={({ pressed }) => [
                  styles.rankRow,
                  { backgroundColor: t.surface, borderColor: t.border },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <RankBadge rank={i + 1} />
                <CoverImage title={s.title} coverUrl={s.cover_url} width={40} height={54} borderRadius={8} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[TYPO.body, { color: t.text, fontWeight: '600' }]} numberOfLines={1}>{s.title}</Text>
                  <Text style={[TYPO.caption, { color: t.textMuted }]} numberOfLines={1}>
                    {s.author || 'Không rõ tác giả'} · {s.word_count.toLocaleString('vi-VN')} chữ
                  </Text>
                </View>
                <Icon name="chevron-forward" size={16} color={t.border} />
              </Pressable>
            ))}
            {rankList.length === 0 && <EmptyLabel t={t} text="Chưa có dữ liệu xếp hạng" />}
          </View>
        )}
      </View>

      {/* Truyện mới cập nhật */}
      <View style={styles.section}>
        <SectionHeader title="Truyện mới cập nhật" onAction={() => openCatalog('new')} />
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
      </View>
    </Screen>
  );
}

function EmptyLabel({ t, text }: { t: ReturnType<typeof useTheme>; text: string }) {
  return <Text style={[TYPO.bodySm, { color: t.textMuted, textAlign: 'center', paddingVertical: 16 }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
    fontFamily: 'BeVietnamPro_800ExtraBold',
  },
  allBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
  section: { marginTop: SPACING.xl, gap: 12 },
  rankTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: 8,
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

function SkeletonListRow() {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} width={112} height={170} radius={RADIUS.md} />
      ))}
    </View>
  );
}
