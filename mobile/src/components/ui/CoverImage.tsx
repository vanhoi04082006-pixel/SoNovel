import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle, ImageStyle, DimensionValue, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

type Props = {
  title: string;
  coverUrl?: string | null;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle | ImageStyle;
  fontSize?: number;
  shadow?: boolean;
};

// 10 palettes gradient — deterministic theo title hash
const PALETTES: [string, string, string][] = [
  ['#f59e0b', '#b45309', '#fbbf24'], // amber
  ['#10b981', '#065f46', '#34d399'], // emerald
  ['#ef4444', '#7f1d1d', '#f87171'], // red
  ['#8b5cf6', '#4c1d95', '#a78bfa'], // violet
  ['#06b6d4', '#155e75', '#22d3ee'], // cyan
  ['#d946ef', '#701a75', '#e879f9'], // fuchsia
  ['#f97316', '#7c2d12', '#fb923c'], // orange
  ['#84cc16', '#365314', '#a3e635'], // lime
  ['#14b8a6', '#134e4a', '#2dd4bf'], // teal
  ['#f43f5e', '#881337', '#fb7185'], // rose
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function CoverImage({ title, coverUrl, width = '100%', height, borderRadius = 8, style, fontSize, shadow }: Props) {
  const t = useTheme();
  const palette = useMemo(() => PALETTES[hashString(title) % PALETTES.length], [title]);
  const initial = useMemo(() => {
    const trimmed = (title || '?').trim();
    return trimmed.charAt(0).toUpperCase();
  }, [title]);
  const [loading, setLoading] = useState(false);

  const shadowStyle = shadow
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      }
    : null;

  if (coverUrl && coverUrl.length > 0) {
    return (
      <View style={[{ width, height, borderRadius }, shadowStyle, style as ViewStyle]}>
        <Image
          source={{ uri: coverUrl }}
          style={{ width: '100%', height: '100%', borderRadius, backgroundColor: t.bgSubtle }}
          resizeMode="cover"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
        />
        {loading ? (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', borderRadius }]}>
            <ActivityIndicator color={t.primary} size="small" />
          </View>
        ) : null}
      </View>
    );
  }

  // Gradient placeholder thật (LinearGradient) + initial + title
  const computedFontSize = fontSize ?? (typeof width === 'number' ? Math.max(20, width * 0.32) : 36);
  const containerStyle: ViewStyle = {
    width,
    height,
    borderRadius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...((style as ViewStyle) || {}),
    ...(shadowStyle as object),
  };

  return (
    <LinearGradient
      colors={[palette[0], palette[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={containerStyle}
    >
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
    </LinearGradient>
  );
}