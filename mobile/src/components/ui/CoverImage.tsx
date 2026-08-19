import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle, ImageStyle } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  title: string;
  coverUrl?: string | null;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle | ImageStyle;
  fontSize?: number;
};

// 10 palettes gradient — deterministic theo title hash
const PALETTES: [string, string, string][] = [
  ['#d97706', '#92400e', '#fbbf24'], // amber
  ['#059669', '#065f46', '#34d399'], // emerald
  ['#dc2626', '#7f1d1d', '#f87171'], // red
  ['#7c3aed', '#4c1d95', '#a78bfa'], // violet
  ['#0891b2', '#155e75', '#22d3ee'], // cyan
  ['#c026d3', '#701a75', '#e879f9'], // fuchsia
  ['#ea580c', '#7c2d12', '#fb923c'], // orange
  ['#65a30d', '#365314', '#a3e635'], // lime
  ['#0d9488', '#134e4a', '#2dd4bf'], // teal
  ['#e11d48', '#881337', '#fb7185'], // rose
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function CoverImage({ title, coverUrl, width = '100%', height, borderRadius = 8, style, fontSize }: Props) {
  const t = useTheme();
  const palette = useMemo(() => PALETTES[hashString(title) % PALETTES.length], [title]);
  const initial = useMemo(() => {
    const trimmed = (title || '?').trim();
    return trimmed.charAt(0).toUpperCase();
  }, [title]);

  if (coverUrl && coverUrl.length > 0) {
    return (
      <Image
        source={{ uri: coverUrl }}
        style={[{ width, height, borderRadius }, style as ImageStyle]}
        resizeMode="cover"
      />
    );
  }

  // Gradient placeholder: 2 màu chồng nhau (RN không có LinearGradient native,
  // dùng 2 View overlap với opacity tạo hiệu ứng gradient đơn giản).
  const computedFontSize = fontSize ?? (typeof width === 'number' ? Math.max(20, width * 0.35) : 36);
  const containerStyle: ViewStyle = {
    width,
    height,
    borderRadius,
    backgroundColor: palette[0],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...((style as ViewStyle) || {}),
  };

  return (
    <View style={containerStyle}>
      {/* Lớp overlay tạo chiều sâu gradient */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: palette[1],
          opacity: 0.55,
        }}
      />
      {/* Initial chữ cái đầu — lớn, đậm */}
      <Text
        style={{
          color: palette[2],
          fontSize: computedFontSize,
          fontWeight: '800',
          includeFontPadding: false,
          textAlign: 'center',
          textAlignVertical: 'center',
        }}
      >
        {initial}
      </Text>
      {/* Title nhỏ ở dưới (nếu có chỗ) */}
      {typeof width === 'number' && width >= 80 ? (
        <Text
          style={{
            position: 'absolute',
            bottom: 6,
            left: 4,
            right: 4,
            color: 'rgba(255,255,255,0.92)',
            fontSize: Math.max(9, Math.min(11, width * 0.1)),
            fontWeight: '600',
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}
