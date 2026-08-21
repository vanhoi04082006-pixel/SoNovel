import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, TYPO, SPACING, RADIUS } from '../theme';
import { Chip } from '../components/ui/Chip';
import { CoverImage } from '../components/ui/CoverImage';
import { Icon } from '../components/ui/Icon';
import { AppButton } from '../components/ui/AppButton';
import {
  ChapterRow,
  SeriesRow,
  getSeries,
  listChapters,
  recordHistory,
  isFavorite as isFav,
  toggleFavorite,
  getProgress,
} from '../lib/progress';
import { useAuth } from '../lib/session';
import { RootStackParamList } from '../navigation/types';
import { startTts, TtsChapter, getNowPlaying } from '../lib/tts';
import { useMiniPlayerPad } from '../lib/useMiniPlayerPad';

type SeriesRouteProp = RouteProp<RootStackParamList, 'Series'>;

export function SeriesScreen({ route }: { route: SeriesRouteProp }) {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const pad = useMiniPlayerPad(true);
  const seriesId = route.params?.seriesId;

  const [series, setSeries] = useState<SeriesRow | null>(null);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [progress, setProgress] = useState<{ chapterId: string | null; charIndex: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [visibleChapters, setVisibleChapters] = useState(100);
  const np = getNowPlaying();

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, chs] = await Promise.all([
        getSeries(seriesId),
        listChapters(seriesId),
      ]);
      setSeries(s);
      setChapters(chs);
      recordHistory(seriesId).catch(() => {});
      const [f, p] = await Promise.all([
        isFav(seriesId),
        getProgress(seriesId),
      ]);
      setFav(f);
      setProgress({
        chapterId: p?.listen_chapter_id ?? null,
        charIndex: p?.listen_char_index ?? 0,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Không tải được truyện');
    } finally {
      setLoading(false);
    }
  }, [seriesId, auth.session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startListening = async (idx: number, startChar = 0) => {
    if (!series) return;
    const ttsChapters: TtsChapter[] = chapters.map((c) => ({
      id: c.id,
      title: c.title,
      content: c.content,
      order_no: c.order_no,
      word_count: c.word_count,
    }));
    await startTts({
      seriesId: series.id,
      seriesTitle: series.title,
      coverUrl: series.cover_url,
      chapters: ttsChapters,
      startIndex: idx,
      startChar,
    });
    nav.navigate('Player', {
      seriesId: series.id,
      seriesTitle: series.title,
      coverUrl: series.cover_url,
      startIndex: idx,
      startChar,
    });
  };

  const onContinueOrStart = () => {
    if (!series || chapters.length === 0) return;
    if (progress?.chapterId) {
      const idx = chapters.findIndex((c) => c.id === progress.chapterId);
      if (idx >= 0) {
        startListening(idx, progress.charIndex);
        return;
      }
    }
    startListening(0, 0);
  };

  const onShare = async () => {
    if (!series) return;
    try {
      await Share.share({ message: `${series.title} — ${series.author}\nSoNovel` });
    } catch (_e) {}
  };

  const onFavToggle = async () => {
    if (!auth.session) {
      nav.navigate('Login');
      return;
    }
    if (!series) return;
    try {
      await toggleFavorite(series.id, !fav);
      setFav(!fav);
    } catch (_e) {}
  };

  if (loading && !series) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.primary} />
      </SafeAreaView>
    );
  }
  if (error || !series) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ color: t.textMuted, textAlign: 'center' }}>{error ?? 'Không tìm thấy truyện'}</Text>
      </SafeAreaView>
    );
  }

  const filtered = chapters.filter((c) =>
    !search.trim() ||
    c.title.toLowerCase().includes(search.trim().toLowerCase()) ||
    String(c.order_no) === search.trim()
  );
  const shownChapters = filtered.slice(0, visibleChapters);
  const remainingChapters = filtered.length - visibleChapters;

  const isCurSeries = np.seriesId === series.id;
  const totalChars = chapters.reduce((sum, c) => sum + ((c.word_count ?? 0) * 5), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: pad + 16 }} showsVerticalScrollIndicator={false}>
        {/* Header with gradient backdrop */}
        <View style={styles.headerWrap}>
          <LinearGradient colors={[t.gradientPrimary[0], 'transparent']} style={styles.headerGlow} />
          <View style={styles.headerRow}>
            <CoverImage
              title={series.title}
              coverUrl={series.cover_url}
              width={110}
              height={150}
              borderRadius={RADIUS.lg}
              shadow
            />
            <View style={styles.meta}>
              <Text style={[TYPO.h3, { color: t.text }]} numberOfLines={3}>{series.title}</Text>
              {series.author ? (
                <Text style={[TYPO.bodySm, { color: t.textMuted }]} numberOfLines={1}>{series.author}</Text>
              ) : null}
              <View style={styles.chips}>
                {(series.genres ?? []).slice(0, 4).map((g) => (
                  <Chip key={g} label={g} compact onPress={() => nav.navigate('Tabs' as any, { screen: 'Search' } as any)} />
                ))}
              </View>
            </View>
          </View>
          {/* Stats */}
          <View style={[styles.statsRow, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Stat label="Chương" value={String(chapters.length)} />
            <View style={[styles.statDivider, { backgroundColor: t.border }]} />
            <Stat label="Chữ" value={totalChars > 0 ? totalChars.toLocaleString('vi-VN') : '—'} />
            <View style={[styles.statDivider, { backgroundColor: t.border }]} />
            <Stat label="Trạng thái" value={series.status === 'completed' ? 'Xong' : 'Đang ra'} />
          </View>
        </View>

        {/* Description */}
        {series.description ? (
          <View style={styles.section}>
            <Text style={[TYPO.title, { color: t.text }]}>Giới thiệu</Text>
            <Text style={[TYPO.bodySm, { color: t.textMuted, lineHeight: 20 }]}>{series.description}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={[styles.actionsRow, { borderColor: t.border }]}>
          <AppButton
            label={progress?.chapterId ? 'Tiếp tục nghe' : 'Nghe từ đầu'}
            icon={progress?.chapterId ? 'play' : 'headset'}
            onPress={onContinueOrStart}
            style={{ flex: 1 }}
          />
          <Pressable
            onPress={onFavToggle}
            style={[styles.iconBtn, { borderColor: t.border, backgroundColor: fav ? t.dangerSoft : t.surface }]}
          >
            <Icon name={fav ? 'heart' : 'heart-outline'} size={22} color={fav ? t.danger : t.textMuted} />
          </Pressable>
          <Pressable
            onPress={onShare}
            style={[styles.iconBtn, { borderColor: t.border, backgroundColor: t.surface }]}
          >
            <Icon name="share-social-outline" size={20} color={t.textMuted} />
          </Pressable>
        </View>

        {/* Chapters */}
        <View style={styles.section}>
          <View style={styles.chapterHead}>
            <Text style={[TYPO.title, { color: t.text }]}>Danh sách chương ({chapters.length})</Text>
            <View style={[styles.chapterSearch, { backgroundColor: t.bgSubtle }]}>
              <Icon name="search" size={14} color={t.textMuted} />
              <TextInput
                style={[styles.chapterSearchInput, { color: t.text }]}
                placeholder="Tìm…"
                placeholderTextColor={t.textMuted}
                value={search}
                onChangeText={(t) => { setSearch(t); setVisibleChapters(100) }}
              />
            </View>
          </View>
          {shownChapters.map((c, i) => {
            const isCurChapter = isCurSeries && np.currentIndex === i;
            return (
              <Pressable
                key={c.id}
                onPress={() => startListening(i, 0)}
                style={({ pressed }) => [styles.chapterRow, { borderColor: t.border }, isCurChapter && { backgroundColor: t.primarySoft }, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.chapterIdxWrap, { backgroundColor: isCurChapter ? t.primary : t.bgSubtle }]}>
                  <Text style={[styles.chapterIdx, { color: isCurChapter ? t.primaryText : t.textMuted }]}>{c.order_no}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[TYPO.body, { color: t.text }]} numberOfLines={2}>{c.title}</Text>
                  <Text style={[TYPO.caption, { color: t.textMuted, marginTop: 2 }]}>
                    {((c.word_count ?? 0) * 5).toLocaleString('vi-VN')} ký tự · ~{Math.ceil(((c.word_count ?? 0) * 5) / 270)} phút
                  </Text>
                </View>
                {isCurChapter ? (
                  <View style={styles.playingBadge}>
                    <Icon name="volume-high" size={14} color={t.primary} />
                  </View>
                ) : (
                  <Icon name="chevron-forward" size={16} color={t.border} />
                )}
              </Pressable>
            );
          })}
          {remainingChapters > 0 && (
            <Pressable
              onPress={() => setVisibleChapters((v) => v + 100)}
              style={[styles.chapterRow, { borderColor: t.border, justifyContent: 'center' }]}
            >
              <Text style={{ color: t.primary, fontSize: 13, fontWeight: '600' }}>
                Tải thêm chương ({remainingChapters} còn lại)
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[TYPO.title, { color: t.text }]}>{value}</Text>
      <Text style={[TYPO.caption, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    height: 220,
    opacity: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 14,
  },
  meta: { flex: 1, gap: 4, paddingTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28 },
  section: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: 8 },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  chapterSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: RADIUS.pill,
    width: 110,
  },
  chapterSearchInput: { flex: 1, fontSize: 12, paddingVertical: 0 },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
  },
  chapterIdxWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterIdx: { fontSize: 12, fontWeight: '700' },
  playingBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});