import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme, RADIUS } from '../../theme';
import { Icon, IconName } from './Icon';

type Variant = 'soft' | 'outline' | 'filled';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  prefix?: string;
  icon?: IconName;
  iconSize?: number;
  variant?: Variant;
  style?: ViewStyle;
  compact?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Chip({ label, selected, onPress, prefix, icon, iconSize = 13, variant = 'soft', style, compact }: ChipProps) {
  const t = useTheme();
  const scale = useSharedValue(1);

  let bg = t.bgSubtle;
  let fg = t.text;
  let border = 'transparent';

  if (variant === 'filled') {
    bg = t.primary;
    fg = t.primaryText;
  } else if (variant === 'outline') {
    bg = 'transparent';
    border = t.border;
  }

  if (selected && variant !== 'filled') {
    bg = t.primarySoft;
    fg = t.primarySoftText;
    border = 'transparent';
  }

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.95, { duration: 80 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
      style={[styles.chip, { backgroundColor: bg, borderColor: border }, compact && styles.compactChip, animatedStyle, style]}
    >
      {icon ? <Icon name={icon} size={iconSize} color={fg} /> : null}
      {prefix ? <Text style={[styles.prefix, { color: fg }]}>{prefix}</Text> : null}
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactChip: { paddingHorizontal: 10, paddingVertical: 5 },
  prefix: { fontSize: 12, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '500' },
});