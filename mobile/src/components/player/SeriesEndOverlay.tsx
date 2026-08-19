import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, TYPO, RADIUS, SPACING } from '../../theme';
import { Icon } from '../ui/Icon';
import { AppButton } from '../ui/AppButton';

type Props = {
  message?: string;
  onRestart?: () => void;
};

/**
 * Overlay hiển thị khi kết thúc bộ truyện — có nút "🔁 Nghe lại".
 */
export function SeriesEndOverlay({ message = 'Đã nghe hết bộ truyện!', onRestart }: Props) {
  const t = useTheme();
  return (
    <View style={[styles.overlay, { backgroundColor: t.overlay }]}>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: t.primarySoft }]}>
          <Icon name="checkmark-circle" size={34} color={t.primary} />
        </View>
        <Text style={[TYPO.title, { color: t.text, textAlign: 'center' }]}>{message}</Text>
        {onRestart ? (
          <AppButton label="Nghe lại" icon="refresh" onPress={onRestart} compact style={{ marginTop: SPACING.sm }} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 32,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});