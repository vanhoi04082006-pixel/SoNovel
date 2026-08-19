import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, TYPO, SPACING } from '../../theme';
import { Icon, IconName } from './Icon';
import { AppButton } from './AppButton';

type Props = {
  icon?: IconName;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
};

/** Empty state thống nhất — icon + title + message + optional CTA. */
export function EmptyState({ icon = 'book-outline', title, message, ctaLabel, onCta }: Props) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: t.primarySoft }]}>
        <Icon name={icon} size={34} color={t.primary} />
      </View>
      <Text style={[TYPO.title, { color: t.text, textAlign: 'center' }]}>{title}</Text>
      {message ? (
        <Text style={[TYPO.bodySm, { color: t.textMuted, textAlign: 'center', lineHeight: 20 }]}>{message}</Text>
      ) : null}
      {ctaLabel && onCta ? <AppButton label={ctaLabel} onPress={onCta} variant="primary" compact style={{ marginTop: SPACING.sm }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 48,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
});