import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, ViewStyle, DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useTheme, RADIUS } from '../../theme';

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/** Placeholder loading shimmer — dùng cho skeleton. */
export function Skeleton({ width = '100%', height = 14, radius = RADIUS.sm, style }: Props) {
  const t = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [opacity]);

  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: t.bgSubtle }, anim, style]}
    />
  );
}

export function SkeletonList({ count = 6, height = 18 }: { count?: number; height?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </View>
  );
}