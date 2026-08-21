import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme, TYPO } from '../../theme';
import { SeriesRow } from '../../lib/progress';
import { CoverImage } from './CoverImage';
import { Icon } from './Icon';

type Props = {
  series: SeriesRow;
  onPress?: (s: SeriesRow) => void;
  width?: number;
  favorited?: boolean;
  showChapterCount?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const SeriesCard = React.memo(function SeriesCard({ series, onPress, width, favorited, showChapterCount }: Props) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const completed = series.status === 'completed';

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={[styles.wrap, { width }]}>
      <AnimatedPressable
        onPress={() => onPress?.(series)}
        onPressIn={() => { scale.value = withTiming(0.96, { duration: 90 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 140 }); }}
        style={[styles.inner, anim]}
      >
        <View style={styles.coverWrap}>
          <CoverImage
            title={series.title}
            coverUrl={series.cover_url}
            style={styles.cover as ViewStyle}
            borderRadius={12}
            shadow
          />
          {completed ? (
            <View style={[styles.badge, { backgroundColor: t.success }]}>
              <Text style={styles.badgeText}>Xong</Text>
            </View>
          ) : null}
          {favorited ? (
            <View style={[styles.favBadge, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
              <Icon name="heart" size={10} color="#fff" />
            </View>
          ) : null}
        </View>
        <Text style={[styles.title as TextStyle, { color: t.text }]} numberOfLines={2}>
          {series.title}
        </Text>
        {showChapterCount ? (
          <Text style={[styles.author as TextStyle, { color: t.textMuted }]} numberOfLines={1}>
            {series.word_count > 0 ? `${series.word_count.toLocaleString('vi-VN')} chữ` : ''}
          </Text>
        ) : series.author ? (
          <Text style={[styles.author as TextStyle, { color: t.textMuted }]} numberOfLines={1}>
            {series.author}
          </Text>
        ) : null}
      </AnimatedPressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  inner: { gap: 6 },
  coverWrap: {
    position: 'relative',
  },
  cover: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  favBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    fontFamily: TYPO.body.fontFamily,
  },
  author: {
    fontSize: 12,
    marginTop: 2,
  },
});