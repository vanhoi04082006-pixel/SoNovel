import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, TYPO, RADIUS } from '../../theme';
import { SheetModal } from '../ui/SheetModal';
import { Icon } from '../ui/Icon';

export type SleepOption = 'off' | '10m' | '15m' | '30m' | '60m' | 'chapter';

const OPTIONS: { value: SleepOption; label: string; icon: any }[] = [
  { value: 'off', label: 'Tắt', icon: 'close' },
  { value: '10m', label: '10 phút', icon: 'time-outline' },
  { value: '15m', label: '15 phút', icon: 'time-outline' },
  { value: '30m', label: '30 phút', icon: 'time-outline' },
  { value: '60m', label: '60 phút', icon: 'time-outline' },
  { value: 'chapter', label: 'Hết chương', icon: 'book-outline' },
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
    <SheetModal visible={visible} onClose={onClose} heightPct={0.5}>
      <Text style={[TYPO.h3, { color: t.text, marginBottom: 12 }]}>Hẹn giờ tắt</Text>
      <View style={styles.list}>
        {OPTIONS.map((o) => {
          const sel = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => { onChange(o.value); onClose(); }}
              style={[styles.row, { backgroundColor: sel ? t.primarySoft : 'transparent' }]}
            >
              <Icon name={o.icon} size={18} color={sel ? t.primary : t.textMuted} />
              <Text style={{ color: sel ? t.primary : t.text, fontSize: 14, fontWeight: sel ? '600' : '400', flex: 1 }}>
                {o.label}
              </Text>
              {sel ? <Icon name="checkmark" size={18} color={t.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
  },
});