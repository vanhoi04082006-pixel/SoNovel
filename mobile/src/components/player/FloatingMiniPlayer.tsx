import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { getNowPlaying, onTtsEvent, togglePlayPause } from '../../lib/tts';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { CoverImage } from '../ui/CoverImage';

/**
 * Floating mini player — nổi trên tab bar.
 * Hiện khi đang có seriesId trong tts state (đang phát / đang pause / đang busy).
 */
export function FloatingMiniPlayer() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [np, setNp] = useState(getNowPlaying());

  useEffect(() => {
    const unsub = onTtsEvent('nowPlaying', () => setNp(getNowPlaying()));
    return unsub;
  }, []);

  if (!np.seriesId) return null;

  const chapter = np.chapters[np.currentIndex];
  const title = chapter ? `Chương ${np.currentIndex + 1}. ${chapter.title}` : np.seriesTitle;
  const progress = chapter && chapter.content.length > 0
    ? Math.min(1, np.currentChar / chapter.content.length)
    : 0;

  return (
    <Pressable
      onPress={() => {
        if (np.seriesId) {
          nav.navigate('Player', {
            seriesId: np.seriesId,
            seriesTitle: np.seriesTitle,
            coverUrl: np.coverUrl,
          });
        }
      }}
      style={({ pressed }) => [styles.bar, { backgroundColor: t.surface, borderColor: t.border }, pressed && { opacity: 0.9 }]}
    >
      <CoverImage
        title={np.seriesTitle || 'SoNovel'}
        coverUrl={np.coverUrl}
        width={40}
        height={40}
        borderRadius={6}
      />
      <View style={styles.meta}>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>{title}</Text>
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: t.bgSubtle }]}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: t.primary }]} />
          </View>
          <Text style={[styles.charCount, { color: t.textMuted }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      </View>
      <Pressable
        onPress={(e) => { e.stopPropagation(); togglePlayPause(); }}
        style={[styles.playBtn, { backgroundColor: t.primary }]}
      >
        {np.busy ? (
          <ActivityIndicator color={t.primaryText} size="small" />
        ) : (
          <Text style={{ color: t.primaryText, fontSize: 16, fontWeight: '700' }}>
            {np.isPlaying ? '⏸' : '▶'}
          </Text>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 56,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  meta: { flex: 1, gap: 4 },
  title: { fontSize: 13, fontWeight: '600' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' },
  charCount: { fontSize: 10 },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
