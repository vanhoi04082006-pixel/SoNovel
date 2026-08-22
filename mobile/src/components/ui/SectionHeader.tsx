import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, TYPO } from '../../theme';
import { Icon } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: object;
};

/** Header khu vực chuẩn: tiêu đề bên trái + hành động "Xem tất cả" bên phải. */
export function SectionHeader({ title, subtitle, actionLabel = 'Xem tất cả', onAction, style }: Props) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[TYPO.h3, { color: t.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[TYPO.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      {onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[TYPO.label, { color: t.primary }]}>{actionLabel}</Text>
          <Icon name="chevron-forward" size={14} color={t.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingLeft: 8,
  },
});
