import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { CoverImage } from '../components/ui/CoverImage';
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
  seekToTts,
  setRateTts,
  startTts,
  stopTts,
  togglePlayPause,
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

  // Subscribe to tts events
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

  // Sleep timer
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

  // Init logic per §8.4:
  // - Nếu native đang THỰC SỰ phát cùng series → chỉ sync UI
  // - Còn lại (paused/stopped/service chết/series khác) → luôn startTts() (full restart từ saved position)
  const maybeStartTts = useCallback(async () => {
    const cur = getNowPlaying();
    if (cur.seriesId === params.seriesId && (cur.isPlaying || cur.busy)) {
      // Đang phát cùng series — sync UI
      setNp(cur);
      return;
    }
    if (cur.seriesId === params.seriesId && cur.chapters.length > 0) {
      // Cùng series nhưng đang paused/stopped → resumePlayback (startTts từ saved pos)
      setNp(cur);
      await resumePlayback();
      return;
    }
    // Series khác hoặc chưa load → fetch chapters + startTts
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
  const contentLen = chapter?.content.length ?? 0;
  const progress = contentLen > 0 ? Math.min(1, np.currentChar / contentLen) : 0;
  const positionLabel = formatChar(np.currentChar);
  const durationLabel = formatChar(contentLen);

  // Seek ±15s worth of chars (~270 chars/min → 15s ~ 68 chars)
  const seekBy = (deltaSec: number) => {
    if (!chapter) return;
    const delta = Math.round((deltaSec / 60) * 270);
    const next = Math.max(0, Math.min(contentLen, np.currentChar + delta));
    seekToTts(next);
  };

  const onPlayPause = () => {
    setError(null);
    togglePlayPause();
  };

  const onSetRate = (r: number) => setRateTts(r);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={styles.wrap}>
        {/* Cover */}
        <View style={styles.coverWrap}>
          <CoverImage
            title={params.seriesTitle || np.seriesTitle || 'SoNovel'}
            coverUrl={params.coverUrl || np.coverUrl}
            width={180}
            height={240}
            borderRadius={16}
          />
        </View>

        {/* Title */}
        <View style={styles.titleWrap}>
          <Text style={[styles.seriesTitle, { color: t.text }]} numberOfLines={1}>
            {params.seriesTitle || np.seriesTitle}
          </Text>
          <Text style={[styles.chapterTitle, { color: t.textMuted }]} numberOfLines={2}>
            {chapter ? `Chương ${np.currentIndex + 1}. ${chapter.title}` : 'Đang tải…'}
          </Text>
        </View>

        {error ? (
          <View style={[styles.errorBar, { backgroundColor: t.bgSubtle, borderColor: t.danger }]}>
            <Text style={{ color: t.danger, fontSize: 12 }}>⚠ {error}</Text>
            <Pressable onPress={() => setError(null)}><Text style={{ color: t.textMuted }}>✕</Text></Pressable>
          </View>
        ) : null}

        {initializing ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={t.primary} />
            <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 8 }}>Đang chuẩn bị…</Text>
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
            onSeekBack={() => seekBy(-15)}
            onSeekForward={() => seekBy(15)}
            onTextSheet={() => setShowText(true)}
            onChaptersSheet={() => setShowChapters(true)}
            onSleepSheet={() => setShowSleep(true)}
            onStop={() => { stopTts(); nav.goBack(); }}
            onSetRate={onSetRate}
            progress={progress}
            positionLabel={positionLabel}
            durationLabel={durationLabel}
          />
        )}

        {np.seriesEnded ? (
          <SeriesEndOverlay
            onRestart={() => {
              // §8.4 — Nghe lại: startTts từ chương 0, char 0.
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

function formatChar(n: number): string {
  if (n <= 0) return '0:00';
  // ~270 chars/min
  const totalSec = Math.round((n / 270) * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 16 },
  coverWrap: { alignItems: 'center' },
  cover: {
    width: 180,
    height: 240,
    borderRadius: 12,
  },
  titleWrap: { alignItems: 'center', gap: 4 },
  seriesTitle: { fontSize: 16, fontWeight: '700' },
  chapterTitle: { fontSize: 13, textAlign: 'center' },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  loadingWrap: { alignItems: 'center', paddingVertical: 24, gap: 4 },
});
