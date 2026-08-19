import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, TYPO, RADIUS } from '../../theme';
import { getNowPlaying, onTtsEvent, togglePlayPause } from '../../lib/tts';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { CoverImage } from '../ui/CoverImage';
import { Icon } from '../ui/Icon';

/**
 * Floating mini player — compact, nằm phía trên tab bar (render trong tabBar của Tabs).
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
      style={({ pressed }) => [styles.bar, { backgroundColor: t.surface, borderColor: t.border }, t.shadowCard, pressed && { opacity: 0.92 }]}
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
      <Pressable
        onPress={(e) => { e.stopPropagation(); togglePlayPause(); }}
        style={[styles.playBtn, { backgroundColor: t.primary }]}
      >
        {np.busy ? (
          <ActivityIndicator color={t.primaryText} size="small" />
        ) : (
          <Icon name={np.isPlaying ? 'pause' : 'play'} size={18} color={t.primaryText} />
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 14,
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
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
});