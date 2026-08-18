import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle, ImageStyle } from 'react-native';
import { useTheme } from '../../theme';
import { SeriesRow } from '../../lib/progress';

type Props = {
  series: SeriesRow;
  onPress?: (s: SeriesRow) => void;
  width?: number;
};

export function SeriesCard({ series, onPress, width }: Props) {
  const t = useTheme();
  const cover: ImageSourcePropType | undefined =
    series.cover_url && series.cover_url.length > 0 ? { uri: series.cover_url } : undefined;
  return (
    <View style={[styles.wrap, { width }]}>
      <Pressable onPress={() => onPress?.(series)} style={styles.inner}>
        {cover ? (
          <Image source={cover} style={[styles.cover as ImageStyle, { backgroundColor: t.bgSubtle }]} resizeMode="cover" />
        ) : (
          <View style={[styles.cover as ViewStyle, { backgroundColor: t.bgSubtle, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: t.textMuted, fontSize: 12 }}>Không bìa</Text>
          </View>
        )}
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
  cover: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
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
