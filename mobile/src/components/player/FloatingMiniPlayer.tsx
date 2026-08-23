import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TYPO, RADIUS } from '../../theme';
import { getNowPlaying, onTtsEvent, togglePlayPause, prevChapterTts, nextChapterTts, stopTts } from '../../lib/tts';
import { useNavInfo } from '../../lib/navState';
import { safeNavigate } from '../../lib/rootNav';
import { CoverImage } from '../ui/CoverImage';
import { Icon } from '../ui/Icon';

/** Chiều cao ước lượng tab bar để mini player ngồi phía trên khi ở màn Tabs. */
const TAB_BAR_H = 58;

/**
 * Floating mini player — overlay TOÀN CỤC (render ở RootNavigator):
 * - Hiện trên mọi màn hình TRỪ Player và Reader (tránh che điều khiển).
 * - Ở màn Tabs: nằm ngay phía trên tab bar. Ở màn stack (Series/Catalog...): nằm trên safe-area.
 * - Sau khi tắt app rồi mở lại vẫn còn nhờ restoreNowPlaying() trong tts.ts.
 */
export function FloatingMiniPlayer() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navInfo = useNavInfo();
  const [np, setNp] = useState(getNowPlaying());

  useEffect(() => {
    const unsub = onTtsEvent('nowPlaying', () => setNp(getNowPlaying()));
    return unsub;
  }, []);

  if (!np.seriesId) return null;
  // Ẩn khi đang ở trình nghe đầy đủ hoặc Reader (có thanh điều khiển riêng)
  if (navInfo.root === 'Player' || navInfo.root === 'Reader') return null;

  const inTabs = navInfo.root === 'Tabs';
  const chapter = np.chapters[np.currentIndex];
  const title = chapter ? `Chương ${np.currentIndex + 1}. ${chapter.title}` : np.seriesTitle;
  const progress = np.charLength > 0
    ? Math.min(1, np.currentChar / np.charLength)
    : 0;

  return (
    <Pressable
      onPress={() => {
        if (np.seriesId) {
          safeNavigate('Player', {
            seriesId: np.seriesId,
            seriesTitle: np.seriesTitle,
            coverUrl: np.coverUrl,
            startIndex: np.currentIndex,
            startChar: np.currentChar,
          });
        }
      }}
      style={({ pressed }) => [
        styles.bar,
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          bottom: inTabs ? insets.bottom + TAB_BAR_H : insets.bottom + 10,
        },
        t.shadowCard,
        pressed && { opacity: 0.92 },
      ]}
    >
      <CoverImage
        title={np.seriesTitle || 'SoNovel'}
        coverUrl={np.coverUrl}
        width={48}
        height={48}
        borderRadius={10}
      />
      <View style={styles.meta}>
        <Text style={[TYPO.bodySm, { color: t.text, fontWeight: '600' }]} numberOfLines={1}>{title}</Text>
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: t.bgSubtle }]}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: t.primary }]} />
          </View>
          <Text style={[TYPO.caption, { color: t.textMuted }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={(e) => { e.stopPropagation(); prevChapterTts(); }}
          hitSlop={6}
          style={styles.smallBtn}
        >
          <Icon name="play-back" size={18} color={t.textMuted} />
        </Pressable>
        <Pressable
          onPress={(e) => { e.stopPropagation(); togglePlayPause(); }}
          style={[styles.playBtn, { backgroundColor: t.primary }]}
        >
          {/* KHÔNG xoay khi busy — luôn hiển thị icon theo trạng thái thật */}
          <Icon name={np.isPlaying ? 'pause' : 'play'} size={18} color={t.primaryText} />
        </Pressable>
        <Pressable
          onPress={(e) => { e.stopPropagation(); nextChapterTts(); }}
          hitSlop={6}
          style={styles.smallBtn}
        >
          <Icon name="play-forward" size={18} color={t.textMuted} />
        </Pressable>
        <Pressable
          onPress={(e) => { e.stopPropagation(); stopTts(); }}
          hitSlop={6}
          style={styles.smallBtn}
          accessibilityLabel="Dừng"
        >
          <Icon name="stop" size={18} color={t.danger} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    zIndex: 100,
    elevation: 12,
  },
  meta: { flex: 1, gap: 5 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});