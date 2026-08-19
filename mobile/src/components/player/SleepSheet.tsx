import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { SheetModal } from '../ui/SheetModal';

export type SleepOption = 'off' | '10m' | '15m' | '30m' | '60m' | 'chapter';

const OPTIONS: { value: SleepOption; label: string }[] = [
  { value: 'off', label: 'Tắt' },
  { value: '10m', label: '10 phút' },
  { value: '15m', label: '15 phút' },
  { value: '30m', label: '30 phút' },
  { value: '60m', label: '60 phút' },
  { value: 'chapter', label: 'Hết chương' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  value: SleepOption;
  onChange: (v: SleepOption) => void;
};

export function SleepSheet({ visible, onClose, value, onChange }: Props) {
  const t = useTheme();
  return (
    <SheetModal visible={visible} onClose={onClose} heightPct={0.45}>
      <Text style={[styles.title, { color: t.text }]}>Hẹn giờ tắt</Text>
      <View style={styles.list}>
        {OPTIONS.map((o) => {
          const sel = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => { onChange(o.value); onClose(); }}
              style={[styles.row, { borderColor: t.border, backgroundColor: sel ? t.bgSubtle : 'transparent' }]}
            >
              <Text style={{ color: sel ? t.primary : t.text, fontSize: 14 }}>{o.label}</Text>
              {sel ? <Text style={{ color: t.primary }}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
