import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, TYPO, SPACING } from '../../theme';
import { Icon } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
};

/** Header màn hình — title + optional back + right action. */
export function ScreenHeader({ title, subtitle, showBack, right }: Props) {
  const t = useTheme();
  const nav = useNavigation<any>();

  return (
    <View style={styles.wrap}>
      {showBack ? (
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={[styles.backBtn, { backgroundColor: t.bgSubtle }]}>
          <Icon name="chevron-back" size={20} color={t.text} />
        </Pressable>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={[TYPO.h3, { color: t.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[TYPO.caption, { color: t.textMuted }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1, gap: 1 },
  right: {},
});