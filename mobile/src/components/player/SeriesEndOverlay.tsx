import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  message?: string;
  onRestart?: () => void;
};

/**
 * Overlay hiển thị khi kết thúc bộ truyện — có nút "🔁 Nghe lại".
 * §8.4: SeriesEndOverlay → "🔁 Nghe lại".
 */
export function SeriesEndOverlay({ message = 'Đã nghe hết bộ truyện!', onRestart }: Props) {
  const t = useTheme();
  return (
    <View style={[styles.overlay, { backgroundColor: t.overlay }]}>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={styles.emoji}>🎧</Text>
        <Text style={[styles.title, { color: t.text }]}>{message}</Text>
        {onRestart ? (
          <Pressable
            onPress={onRestart}
            style={[styles.btn, { backgroundColor: t.primary }]}
          >
            <Text style={[styles.btnLabel, { color: t.primaryText }]}>🔁 Nghe lại</Text>
          </Pressable>
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
    paddingVertical: 22,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 32,
  },
  emoji: { fontSize: 36 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  btn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  btnLabel: { fontSize: 14, fontWeight: '600' },
});
