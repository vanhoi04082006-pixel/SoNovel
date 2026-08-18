import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Chip } from '../components/ui/Chip';
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
      if (auth.session) {
        const [f, p] = await Promise.all([
          isFav(seriesId),
          getProgress(seriesId),
        ]);
        setFav(f);
        setProgress({
          chapterId: p?.listen_chapter_id ?? null,
          charIndex: p?.listen_char_index ?? 0,
        });
      }
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

  const isCurSeries = np.seriesId === series.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: pad + 16 }}>
        {/* Header */}
        <View style={[styles.head, { borderBottomColor: t.border }]}>
          {series.cover_url ? (
            <Image source={{ uri: series.cover_url }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.cover, { backgroundColor: t.bgSubtle, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: t.textMuted }}>Không bìa</Text>
            </View>
          )}
          <View style={styles.meta}>
            <Text style={[styles.title, { color: t.text }]} numberOfLines={3}>{series.title}</Text>
            {series.author ? (
              <Text style={[styles.author, { color: t.textMuted }]} numberOfLines={1}>{series.author}</Text>
            ) : null}
            <View style={styles.chips}>
              {(series.genres ?? []).map((g) => (
                <Chip key={g} label={g} onPress={() => nav.navigate('Tabs' as any, { screen: 'Search' } as any)} />
              ))}
            </View>
          </View>
        </View>

        {/* Description */}
        {series.description ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Giới thiệu</Text>
            <Text style={[styles.desc, { color: t.textMuted }]}>{series.description}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={[styles.actionsRow, { borderColor: t.border }]}>
          <Pressable
            onPress={onContinueOrStart}
            style={[styles.primaryBtn, { backgroundColor: t.primary }]}
          >
            <Text style={[styles.primaryBtnLabel, { color: t.primaryText }]}>
              {progress?.chapterId ? '▶ Tiếp tục nghe' : '🎧 Nghe từ đầu'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onFavToggle}
            style={[styles.secBtn, { borderColor: t.border, backgroundColor: t.surface }]}
          >
            <Text style={{ color: t.text, fontSize: 14 }}>{fav ? '❤️' : '🤍'}</Text>
          </Pressable>
          <Pressable
            onPress={onShare}
            style={[styles.secBtn, { borderColor: t.border, backgroundColor: t.surface }]}
          >
            <Text style={{ color: t.text, fontSize: 14 }}>📤</Text>
          </Pressable>
        </View>

        {/* Chapters */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Danh sách chương ({chapters.length})</Text>
          {filtered.map((c, i) => {
            const isCurChapter = isCurSeries && np.currentIndex === i;
            return (
              <Pressable
                key={c.id}
                onPress={() => startListening(i, 0)}
                style={[styles.chapterRow, { borderColor: t.border, backgroundColor: isCurChapter ? t.bgSubtle : 'transparent' }]}
              >
                <Text style={[styles.chapterIdx, { color: t.textMuted }]}>{c.order_no}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chapterTitle, { color: t.text }]} numberOfLines={2}>{c.title}</Text>
                  <Text style={[styles.chapterMeta, { color: t.textMuted }]}>
                    {c.content.length} ký tự · ~{Math.ceil(c.content.length / 270)} phút nghe
                  </Text>
                </View>
                {isCurChapter ? <Text style={{ color: t.primary }}>🔊</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cover: { width: 100, height: 140, borderRadius: 8 },
  meta: { flex: 1, gap: 4 },
  title: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
  author: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  section: { paddingHorizontal: 16, paddingVertical: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  desc: { fontSize: 13, lineHeight: 20 },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnLabel: { fontSize: 14, fontWeight: '600' },
  secBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chapterIdx: { width: 32, fontSize: 12, fontWeight: '600' },
  chapterTitle: { fontSize: 14, lineHeight: 18 },
  chapterMeta: { fontSize: 11, marginTop: 2 },
});
