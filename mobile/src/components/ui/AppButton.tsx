import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { Icon, IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  iconSize?: number;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  compact?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Nút bấm chuẩn — gradient primary, press scale, loading, variants. */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconSize = 18,
  disabled,
  loading,
  style,
  compact,
}: Props) {
  const t = useTheme();
  const scale = useSharedValue(1);

  const base: ViewStyle = {
    paddingVertical: compact ? 10 : 14,
    paddingHorizontal: compact ? 14 : 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    opacity: disabled || loading ? 0.55 : 1,
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const content =
    variant === 'primary' ? (
      <LinearGradient
        colors={t.gradientPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[base, style, styles.gradient]}
      >
        <ButtonInner {...{ icon, iconSize, loading, label, tint: t.primaryText }} />
      </LinearGradient>
    ) : (
      <View
        style={[
          base,
          style,
          variant === 'secondary' && { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
          variant === 'danger' && { backgroundColor: t.dangerSoft, borderWidth: 1, borderColor: 'transparent' },
        ]}
      >
        <ButtonInner
          {...{ icon, iconSize, loading, label }}
          tint={variant === 'danger' ? t.danger : variant === 'secondary' ? t.text : t.primary}
        />
      </View>
    );

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withTiming(0.97, { duration: 80 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      style={animatedStyle}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </AnimatedPressable>
  );
}

function ButtonInner({
  icon,
  iconSize,
  loading,
  label,
  tint,
}: {
  icon?: IconName;
  iconSize: number;
  loading?: boolean;
  label: string;
  tint: string;
}) {
  return (
    <>
      {loading ? (
        <ActivityIndicator color={tint} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={iconSize} color={tint} /> : null}
          <Text style={[styles.label, { color: tint }]}>{label}</Text>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});