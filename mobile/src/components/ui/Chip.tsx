import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  prefix?: string;
  style?: ViewStyle;
};

export function Chip({ label, selected, onPress, prefix, style }: ChipProps) {
  const t = useTheme();
  const bg = selected ? t.primary : t.bgSubtle;
  const fg = selected ? t.primaryText : t.text;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: bg, borderColor: t.border }, style]}
    >
      {prefix ? (
        <Text style={[styles.prefix, { color: fg }]}>{prefix}</Text>
      ) : null}
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prefix: { fontSize: 12, fontWeight: '600' },
  label: { fontSize: 13 },
});

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={chipRowStyles.row}>
      {React.Children.map(children, (c, i) => (
        <View key={i} style={chipRowStyles.item}>{c}</View>
      ))}
    </View>
  );
}

const chipRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: {},
});
