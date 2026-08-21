import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, TYPO, SPACING, RADIUS } from '../theme';
import { CoverImage } from '../components/ui/CoverImage';
import { Icon } from '../components/ui/Icon';
import { PlayerControls } from '../components/player/PlayerControls';
import { TextSheet } from '../components/player/TextSheet';
import { ChaptersSheet } from '../components/player/ChaptersSheet';
import { SleepSheet, SleepOption } from '../components/player/SleepSheet';
import { SeriesEndOverlay } from '../components/player/SeriesEndOverlay';
import {
  getNowPlaying,
  onTtsEvent,
  pauseTts,
  playChapterTts,
  prevChapterTts,
  nextChapterTts,
  resumePlayback,
  setRateTts,
  startTts,
  stopTts,
  togglePlayPause,
  ensureChapterContent,
  TtsChapter,
} from '../lib/tts';
import { listChapters, ChapterRow } from '../lib/progress';
import { RootStackParamList } from '../navigation/types';

type PlayerRouteProp = RouteProp<RootStackParamList, 'Player'>;

const SLEEP_MINUTES: Record<SleepOption, number | null> = {
  off: null,
  '10m': 10,
  '15m': 15,
  '30m': 30,
  '60m': 60,
  chapter: null,
};

const SLEEP_LABELS: Record<SleepOption, string> = {
  off: 'Tắt',
  '10m': '10p',
  '15m': '15p',
  '30m': '30p',
  '60m': '60p',
  chapter: 'Hết chương',
};

export function PlayerScreen({ route }: { route: PlayerRouteProp }) {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = route.params;
  const [np, setNp] = useState(getNowPlaying());
  const [showText, setShowText] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [sleep, setSleep] = useState<SleepOption>('off');
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubs = [
      onTtsEvent('nowPlaying', () => setNp(getNowPlaying())),
      onTtsEvent('stateChange', () => setNp(getNowPlaying())),
      onTtsEvent('progress', () => setNp(getNowPlaying())),
      onTtsEvent('error', (p: any) => {
        setError(p?.message ?? 'Lỗi TTS');
      }),
      onTtsEvent('chapterEnd', () => {
        if (sleep === 'chapter') {
          stopTts();
          setSleep('off');
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [sleep]);

  useEffect(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    const mins = SLEEP_MINUTES[sleep];
    if (mins != null) {
      sleepTimerRef.current = setTimeout(() => {
        stopTts();
        setSleep('off');
      }, mins * 60 * 1000);
    }
    return () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    };
  }, [sleep]);

  const maybeStartTts = useCallback(async () => {
    const cur = getNowPlaying();
    if (cur.seriesId === params.seriesId && (cur.isPlaying || cur.busy)) {
      setNp(cur);
      return;
    }
    if (cur.seriesId === params.seriesId && cur.chapters.length > 0) {
      setNp(cur);
      await resumePlayback();
      return;
    }
    setInitializing(true);
    try {
      const chs: ChapterRow[] = await listChapters(params.seriesId);
      const ttsChapters: TtsChapter[] = chs.map((c) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        order_no: c.order_no,
        word_count: c.word_count,
      }));
      await startTts({
        seriesId: params.seriesId,
        seriesTitle: params.seriesTitle,
        coverUrl: params.coverUrl,
        chapters: ttsChapters,
        startIndex: params.startIndex ?? 0,
        startChar: params.startChar ?? 0,
      });
    } catch (e: any) {
      setError(`Không tải được chương: ${e?.message ?? e}`);
    } finally {
      setInitializing(false);
    }
  }, [params.seriesId, params.seriesTitle, params.coverUrl, params.startIndex, params.startChar]);

  useEffect(() => {
    maybeStartTts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.seriesId]);

  const chapter = np.chapters[np.currentIndex] ?? null;

  const onPlayPause = () => {
    setError(null);
    togglePlayPause();
  };

  const onSetRate = (r: number) => setRateTts(r);

  const openTextSheet = async () => {
    try {
      await ensureChapterContent(np.currentIndex);
    } catch (_e) {
      // Đã có content trong cache → vẫn mở sheet được; nếu chưa, sheet trống.
    }
    setShowText(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* Ambient gradient background */}
      <LinearGradient
        colors={[t.gradientPrimary[0], t.bg, t.bg]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.ambient}
        pointerEvents="none"
      />
      <View style={styles.wrap}>
        {/* Cover */}
        <View style={styles.coverWrap}>
          <View style={[styles.coverGlow, { backgroundColor: t.primary }]} />
          <CoverImage
            title={params.seriesTitle || np.seriesTitle || 'SoNovel'}
            coverUrl={params.coverUrl || np.coverUrl}
            width={200}
            height={266}
            borderRadius={RADIUS.xl}
            shadow
          />
        </View>

        {/* Title */}
        <View style={styles.titleWrap}>
          <Text style={[TYPO.h3, { color: t.text }]} numberOfLines={1}>
            {params.seriesTitle || np.seriesTitle}
          </Text>
          <Text style={[TYPO.bodySm, { color: t.textMuted }]} numberOfLines={2}>
            {chapter ? `Chương ${np.currentIndex + 1}. ${chapter.title}` : 'Đang tải…'}
          </Text>
        </View>

        {error ? (
          <View style={[styles.errorBar, { backgroundColor: t.dangerSoft, borderColor: t.danger }]}>
            <Icon name="warning" size={14} color={t.danger} />
            <Text style={{ color: t.danger, fontSize: 12, flex: 1 }} numberOfLines={2}>{error}</Text>
            <Pressable onPress={() => setError(null)} hitSlop={8}>
              <Icon name="close" size={14} color={t.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {initializing ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={t.primary} size="large" />
            <Text style={[TYPO.label, { color: t.textMuted, marginTop: 8 }]}>Đang chuẩn bị…</Text>
          </View>
        ) : (
          <PlayerControls
            isPlaying={np.isPlaying}
            busy={np.busy}
            rate={np.rate}
            sleepLabel={SLEEP_LABELS[sleep]}
            onPlayPause={onPlayPause}
            onPrev={() => prevChapterTts()}
            onNext={() => nextChapterTts()}
            onTextSheet={openTextSheet}
            onChaptersSheet={() => setShowChapters(true)}
            onSleepSheet={() => setShowSleep(true)}
            onStop={() => { stopTts(); nav.goBack(); }}
            onSetRate={onSetRate}
          />
        )}

        {np.seriesEnded ? (
          <SeriesEndOverlay
            onRestart={() => {
              playChapterTts(0, 0);
            }}
          />
        ) : null}
      </View>

      <TextSheet
        visible={showText}
        onClose={() => setShowText(false)}
        chapter={chapter}
        currentIndex={np.currentIndex}
        charIndex={np.currentChar}
      />
      <ChaptersSheet
        visible={showChapters}
        onClose={() => setShowChapters(false)}
        chapters={np.chapters.map((c) => ({
          id: c.id,
          title: c.title,
          order_no: c.order_no,
        }))}
        currentIndex={np.currentIndex}
        onSelect={(idx) => playChapterTts(idx, 0)}
      />
      <SleepSheet
        visible={showSleep}
        onClose={() => setShowSleep(false)}
        value={sleep}
        onChange={setSleep}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ambient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
  },
  wrap: { flex: 1, padding: 16, gap: 16, paddingTop: SPACING.xl },
  coverWrap: { alignItems: 'center', position: 'relative' },
  coverGlow: {
    position: 'absolute',
    top: 20,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.18,
  },
  titleWrap: { alignItems: 'center', gap: 4 },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  loadingWrap: { alignItems: 'center', paddingVertical: 32, gap: 4 },
});