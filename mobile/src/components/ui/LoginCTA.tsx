import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

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
    <View style={[styles.wrap, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      <Text style={[styles.message, { color: t.textMuted }]}>{message}</Text>
      <Pressable
        style={[styles.btn, { backgroundColor: t.primary }]}
        onPress={onCta}
      >
        <Text style={[styles.btnLabel, { color: t.primaryText }]}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  btnLabel: { fontSize: 14, fontWeight: '600' },
});
