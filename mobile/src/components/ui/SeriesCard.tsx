import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { SeriesRow } from '../../lib/progress';
import { CoverImage } from './CoverImage';

type Props = {
  series: SeriesRow;
  onPress?: (s: SeriesRow) => void;
  width?: number;
  favorited?: boolean;
};

export function SeriesCard({ series, onPress, width, favorited }: Props) {
  const t = useTheme();
  const completed = series.status === 'completed';

  return (
    <View style={[styles.wrap, { width }]}>
      <Pressable
        onPress={() => onPress?.(series)}
        style={({ pressed }) => [styles.inner, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.coverWrap}>
          <CoverImage
            title={series.title}
            coverUrl={series.cover_url}
            style={styles.cover as ViewStyle}
            borderRadius={10}
          />
          {/* Status badge top-right */}
          {completed ? (
            <View style={[styles.badge, { backgroundColor: t.primary }]}>
              <Text style={styles.badgeText}>Hoàn thành</Text>
            </View>
          ) : null}
          {/* Favorite heart */}
          {favorited ? (
            <View style={[styles.favBadge, { backgroundColor: t.surface }]}>
              <Text style={{ fontSize: 10 }}>❤️</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.title as TextStyle, { color: t.text }]} numberOfLines={2}>
          {series.title}
        </Text>
        {series.author ? (
          <Text style={[styles.author as TextStyle, { color: t.textMuted }]} numberOfLines={1}>
            {series.author}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
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
    borderRadius: 4,
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
  },
  author: {
    fontSize: 12,
    marginTop: 2,
  },
});
