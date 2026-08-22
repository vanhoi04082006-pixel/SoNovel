import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  rank: number;
  size?: number;
};

const TOP_COLORS = ['#f59e0b', '#94a3b8', '#d97706'];

/** Huy hiệu số thứ tự bảng xếp hạng — top 3 màu vàng/bạc/đồng. */
export function RankBadge({ rank, size = 26 }: Props) {
  const t = useTheme();
  const isTop = rank <= 3;
  const bg = isTop ? TOP_COLORS[rank - 1] : t.bgSubtle;
  const fg = isTop ? '#ffffff' : t.textMuted;
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Text style={[styles.text, { color: fg, fontSize: Math.round(size * 0.46) }]}>{rank}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
  },
});
