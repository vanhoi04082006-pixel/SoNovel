import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, TYPO, SPACING, RADIUS } from '../../theme';
import { Icon } from './Icon';
import { AppButton } from './AppButton';

type Props = {
  title?: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
};

/**
 * Card mời đăng nhập — dùng trong Favorites/History/Profile khi chưa đăng nhập.
 */
export function LoginCTA({
  title = 'Đăng nhập để đồng bộ',
  message = 'Đăng nhập để lưu yêu thích, lịch sử và tiến độ nghe trên nhiều thiết bị.',
  ctaLabel = 'Đăng nhập',
  onCta,
}: Props) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: t.primarySoft }]}>
        <Icon name="cloud-upload-outline" size={28} color={t.primary} />
      </View>
      <Text style={[TYPO.title, { color: t.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[TYPO.bodySm, { color: t.textMuted, textAlign: 'center', lineHeight: 20 }]}>{message}</Text>
      <AppButton label={ctaLabel} onPress={onCta} icon="log-in-outline" compact style={{ marginTop: SPACING.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    margin: SPACING.lg,
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.md,
    ...({ shadowColor: 'rgba(0,0,0,0.1)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3 } as object),
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});