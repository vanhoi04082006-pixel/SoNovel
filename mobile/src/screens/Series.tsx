import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, TYPO, SPACING, RADIUS } from '../theme';
import { Chip } from '../components/ui/Chip';
import { CoverImage } from '../components/ui/CoverImage';
import { Icon } from '../components/ui/Icon';
import { AppButton } from '../components/ui/AppButton';
import { setSearchFilter } from '../lib/searchFilter';
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
import { getNowPlaying } from '../lib/tts';
import { getChapterContent } from '../lib/chapters';
import { invalidateCache } from '../lib/dataCache';
import { useReadMarkers } from '../lib/readMarkers';
import { useMiniPlayerPad } from '../lib/useMiniPlayerPad';
import { IllustrationsTab } from '../components/series/IllustrationsTab';

type SeriesRouteProp = RouteProp<RootStackParamList, 'Series'>;

export function SeriesScreen({ route }: { route: SeriesRouteProp }) {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const pad = useMiniPlayerPad(true);
  const seriesId = route.params?.seriesId;

  const [series, setSeries] = useState<SeriesRow | null>(null);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [progress, setProgress] = useState<{ chapterId: string | null; charIndex: number; readChapterId?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'info' | 'chapters' | 'illustrations'>('info');
  const seriesScrollRef = useRef<ScrollView | null>(null);
  const [search, setSearch] = useState('');
  const [visibleChapters, setVisibleChapters] = useState(100);
  const np = getNowPlaying();
  const readSet = useReadMarkers(seriesId);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, chs] = await Promise.all([
        getSeries(seriesId),
        listChapters(seriesId), // meta-only → nhanh
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
        readChapterId: p?.read_chapter_id ?? null,
      });
      // Prefetch nội dung: chương đầu + chương đang nghe dở (fire-and-forget)
      // → bấm "Nghe"/chương bất kỳ là phát gần như ngay.
      if (chs[0]) getChapterContent(seriesId, chs[0].id).catch(() => {});
      if (p?.listen_chapter_id && p.listen_chapter_id !== chs[0]?.id) {
        getChapterContent(seriesId, p.listen_chapter_id).catch(() => {});
      }
    } catch (e: any) {
      setError(e?.message ?? 'Không tải được truyện');
    } finally {
      setLoading(false);
    }
  }, [seriesId, auth.session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /**
   * Điều hướng sang Player NGAY LẬP TỨC (không chờ tải nội dung).
   * Player tự load danh sách chương + resolve vị trí theo startChapterId rồi phát.
   */
  const startListening = (chapterId?: string, startChar = 0) => {
    if (!series) return;
    let idx = 0;
    if (chapterId) {
      const byId = chapters.findIndex((c) => c.id === chapterId);
      if (byId >= 0) idx = byId;
    }
    nav.navigate('Player', {
      seriesId: series.id,
      seriesTitle: series.title,
      coverUrl: series.cover_url,
      startIndex: idx,
      startChar,
      ...(chapterId ? { startChapterId: chapterId } : {}),
    });
  };

  const onContinueOrStart = () => {
    if (!series || chapters.length === 0) return;
    if (progress?.chapterId) {
      const idx = chapters.findIndex((c) => c.id === progress.chapterId);
      if (idx >= 0) {
        startListening(progress.chapterId, progress.charIndex);
        return;
      }
    }
    startListening(undefined, 0);
  };

  const openReader = (chapterId?: string) => {
    if (!series) return;
    nav.navigate('Reader', {
      seriesId: series.id,
      seriesTitle: series.title,
      chapterId: chapterId ?? progress?.readChapterId ?? undefined,
    });
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

  const listenIdx = useMemo(
    () => (progress?.chapterId ? chapters.findIndex((c) => c.id === progress.chapterId) : -1),
    [chapters, progress]
  );

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
      <ScrollView ref={seriesScrollRef} contentContainerStyle={{ paddingBottom: pad + 96 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
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
                  <Chip
                    key={g}
                    label={g}
                    compact
                    onPress={() => {
                      setSearchFilter({ genre: g });
                      nav.navigate('Tabs' as any, { screen: 'Search' } as any);
                    }}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={[styles.actionsRow, { borderColor: t.border }]}>
          <AppButton
            label={listenIdx >= 0 ? 'Tiếp tục nghe' : 'Nghe từ đầu'}
            icon={listenIdx >= 0 ? 'play' : 'headset'}
            onPress={onContinueOrStart}
            style={{ flex: 1 }}
          />
          <Pressable
            onPress={() => openReader()}
            style={[styles.iconBtn, { borderColor: t.border, backgroundColor: t.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Đọc truyện"
          >
            <Icon name="book-outline" size={22} color={t.text} />
          </Pressable>
          <Pressable
            onPress={onFavToggle}
            style={[styles.iconBtn, { borderColor: t.border, backgroundColor: fav ? t.dangerSoft : t.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Yêu thích"
          >
            <Icon name={fav ? 'heart' : 'heart-outline'} size={22} color={fav ? t.danger : t.textMuted} />
          </Pressable>
          <Pressable
            onPress={onShare}
            style={[styles.iconBtn, { borderColor: t.border, backgroundColor: t.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Chia sẻ"
          >
            <Icon name="share-social-outline" size={20} color={t.textMuted} />
          </Pressable>
        </View>

        {/* Tabs: Info | Chapters | Minh họa */}
        <View style={[styles.tabBar, { borderBottomColor: t.border }]}>
          <TabButton label="Thông tin" active={tab === 'info'} onPress={() => setTab('info')} t={t} />
          <TabButton label={`Chương (${chapters.length})`} active={tab === 'chapters'} onPress={() => setTab('chapters')} t={t} />
          <TabButton label="Minh họa" active={tab === 'illustrations'} onPress={() => setTab('illustrations')} t={t} />
        </View>

        {tab === 'info' ? (
          <View style={styles.section}>
            {/* Stats */}
            <View style={[styles.statsRow, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Stat label="Số chương" value={String(chapters.length)} t={t} />
              <View style={[styles.statDivider, { backgroundColor: t.border }]} />
              <Stat label="Tổng chữ" value={totalChars > 0 ? totalChars.toLocaleString('vi-VN') : '—'} t={t} />
              <View style={[styles.statDivider, { backgroundColor: t.border }]} />
              <Stat label="Trạng thái" value={series.status === 'completed' ? 'Hoàn thành' : 'Đang ra'} t={t} />
            </View>
            {/* Description */}
            <Text style={[TYPO.title, { color: t.text }]}>Giới thiệu</Text>
            <Text style={[TYPO.bodySm, { color: t.textMuted, lineHeight: 21 }]}>
              {series.description || 'Chưa có mô tả.'}
            </Text>
          </View>
        ) : tab === 'illustrations' ? (
          <View style={styles.section}>
            {seriesId ? <IllustrationsTab seriesId={seriesId} parentScrollRef={seriesScrollRef} /> : null}
          </View>
        ) : (
          <View style={styles.section}>
            {/* Search chương */}
            <View style={[styles.chapterSearchWrap]}>
              <View style={[styles.chapterSearch, { backgroundColor: t.bgSubtle }]}>
                <Icon name="search" size={15} color={t.textMuted} />
                <TextInput
                  style={[styles.chapterSearchInput, { color: t.text }]}
                  placeholder="Tìm số thứ tự hoặc tên chương…"
                  placeholderTextColor={t.textMuted}
                  value={search}
                  onChangeText={(txt) => { setSearch(txt); setVisibleChapters(100); }}
                />
              </View>
            </View>

            {shownChapters.map((c) => {
              const globalIdx = chapters.indexOf(c);
              const isCurChapter = isCurSeries && np.currentIndex === globalIdx;
              // Đã nghe: marker local HOẶC đứng trước vị trí đang nghe trên server.
              const isRead =
                readSet.has(c.id) ||
                (listenIdx >= 0 && globalIdx < listenIdx);
              const isListeningPos = globalIdx === listenIdx;
              const pct = isListeningPos && progress ? Math.min(100, Math.round((progress.charIndex / Math.max(1, (c.word_count ?? 0) * 5)) * 100)) : isRead ? 100 : 0;
              return (
                <View key={c.id} style={styles.chapterItem}>
                  <Pressable
                    onPress={() => startListening(c.id, 0)}
                    style={({ pressed }) => [
                      styles.chapterRow,
                      { borderColor: t.border },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={[styles.chapterIdxWrap, { backgroundColor: isCurChapter ? t.primary : isRead ? t.successSoft : t.bgSubtle }]}>
                      {isRead && !isCurChapter ? (
                        <Icon name="checkmark" size={16} color={t.success} />
                      ) : (
                        <Text style={[styles.chapterIdx, { color: isCurChapter ? t.primaryText : t.textMuted }]}>{c.order_no}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[TYPO.body, { color: isRead && !isCurChapter ? t.textMuted : isCurChapter ? t.primary : t.text }]} numberOfLines={2}>{c.title}</Text>
                      <Text style={[TYPO.caption, { color: t.textMuted, marginTop: 2 }]}>
                        ~{Math.max(1, Math.ceil(((c.word_count ?? 0) * 5) / 270))} phút
                        {isRead ? ' · Đã nghe' : ''}
                        {isListeningPos && pct > 0 && pct < 100 ? ` · Đang nghe ${pct}%` : ''}
                        {isCurChapter ? ' · Đang phát' : ''}
                      </Text>
                      {isListeningPos && pct > 0 && pct < 100 && (
                        <View style={[styles.rowProgressTrack, { backgroundColor: t.bgSubtle }]}>
                          <View style={[styles.rowProgressFill, { width: `${pct}%`, backgroundColor: t.primary }]} />
                        </View>
                      )}
                    </View>
                    {isCurChapter ? (
                      <View style={styles.playingBadge}>
                        <Icon name="volume-high" size={14} color={t.primary} />
                      </View>
                    ) : isRead ? (
                      <Icon name="checkmark-circle" size={20} color={t.success} />
                    ) : (
                      <Icon name="play-circle-outline" size={22} color={t.border} />
                    )}
                  </Pressable>
                  {/* Đọc chương này — giữ ngữ cảnh, mở Reader bên trong bộ truyện */}
                  <Pressable
                    onPress={() => openReader(c.id)}
                    hitSlop={8}
                    style={styles.readBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Đọc ${c.title}`}
                  >
                    <Icon name="document-text-outline" size={18} color={t.textMuted} />
                  </Pressable>
                </View>
              );
            })}
            {filtered.length === 0 && (
              <Text style={[TYPO.bodySm, { color: t.textMuted, textAlign: 'center', paddingVertical: 24 }]}>
                Không có chương phù hợp.
              </Text>
            )}
            {remainingChapters > 0 && (
              <Pressable
                onPress={() => setVisibleChapters((v) => v + 100)}
                style={[styles.chapterMore, { borderColor: t.border }]}
              >
                <Text style={{ color: t.primary, fontSize: 13, fontWeight: '600' }}>
                  Tải thêm chương ({remainingChapters} còn lại)
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress, t }: { label: string; active: boolean; onPress: () => void; t: ReturnType<typeof useTheme> }) {
  return (
    <Pressable onPress={onPress} style={styles.tabBtn}>
      <Text
        style={[
          TYPO.label,
          { color: active ? t.primary : t.textMuted, fontSize: 14, fontWeight: active ? '700' : '500' },
        ]}
      >
        {label}
      </Text>
      {active ? <View style={[styles.tabIndicator, { backgroundColor: t.primary }]} /> : null}
    </Pressable>
  );
}

function Stat({ label, value, t }: { label: string; value: string; t: ReturnType<typeof useTheme> }) {
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
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.lg,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginRight: 24,
  },
  tabIndicator: {
    height: 2,
    borderRadius: 1,
    alignSelf: 'stretch',
    marginTop: 6,
  },
  section: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: 10 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28 },
  chapterSearchWrap: { marginBottom: 4 },
  chapterSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: RADIUS.pill,
  },
  chapterSearchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 4,
    paddingLeft: 8,
    borderRadius: RADIUS.md,
  },
  chapterIdxWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterIdx: { fontSize: 12, fontWeight: '700' },
  rowProgressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
    maxWidth: 160,
  },
  rowProgressFill: { height: '100%', borderRadius: 2 },
  playingBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readBtn: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterMore: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    paddingVertical: 12,
  },
});
