import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import { Chip } from '../ui/Chip';
import { SleepOption } from './SleepSheet';

type Props = {
  isPlaying: boolean;
  busy: boolean;
  rate: number;
  sleepLabel: string;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeekBack: () => void;
  onSeekForward: () => void;
  onTextSheet: () => void;
  onChaptersSheet: () => void;
  onSleepSheet: () => void;
  onStop: () => void;
  onSetRate: (r: number) => void;
  progress: number; // 0..1
  positionLabel: string;
  durationLabel: string;
};

const RATES = [0.75, 1, 1.25, 1.5, 2];

export function PlayerControls(p: Props) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      {/* Seek bar */}
      <View style={styles.seekWrap}>
        <View style={[styles.seekTrack, { backgroundColor: t.bgSubtle }]}>
          <View style={[styles.seekFill, { width: `${Math.round(p.progress * 100)}%`, backgroundColor: t.primary }]} />
        </View>
        <View style={styles.seekLabels}>
          <Text style={[styles.seekText, { color: t.textMuted }]}>{p.positionLabel}</Text>
          <Text style={[styles.seekText, { color: t.textMuted }]}>{p.durationLabel}</Text>
        </View>
      </View>

      {/* Main controls */}
      <View style={styles.row}>
        <Pressable onPress={p.onPrev} style={styles.iconBtn}>
          <Text style={[styles.icon, { color: t.text }]}>⏮</Text>
          <Text style={[styles.iconLabel, { color: t.textMuted }]}>Trước</Text>
        </Pressable>
        <Pressable onPress={p.onSeekBack} style={styles.iconBtn}>
          <Text style={[styles.icon, { color: t.text }]}>-15s</Text>
          <Text style={[styles.iconLabel, { color: t.textMuted }]}>Lùi 15s</Text>
        </Pressable>
        <Pressable onPress={p.onPlayPause} style={[styles.playBtn, { backgroundColor: t.primary }]}>
          {p.busy ? (
            <ActivityIndicator color={t.primaryText} />
          ) : (
            <Text style={[styles.playIcon, { color: t.primaryText }]}>{p.isPlaying ? '⏸' : '▶'}</Text>
          )}
        </Pressable>
        <Pressable onPress={p.onSeekForward} style={styles.iconBtn}>
          <Text style={[styles.icon, { color: t.text }]}>+15s</Text>
          <Text style={[styles.iconLabel, { color: t.textMuted }]}>Tiến 15s</Text>
        </Pressable>
        <Pressable onPress={p.onNext} style={styles.iconBtn}>
          <Text style={[styles.icon, { color: t.text }]}>⏭</Text>
          <Text style={[styles.iconLabel, { color: t.textMuted }]}>Sau</Text>
        </Pressable>
      </View>

      {/* Rate chips */}
      <View style={styles.ratesRow}>
        {RATES.map((r) => (
          <Chip
            key={r}
            label={`${r}×`}
            selected={Math.abs(p.rate - r) < 0.01}
            onPress={() => p.onSetRate(r)}
          />
        ))}
      </View>

      {/* Secondary actions */}
      <View style={styles.secondaryRow}>
        <Pressable onPress={p.onTextSheet} style={[styles.secBtn, { borderColor: t.border, backgroundColor: t.surface }]}>
          <Text style={{ color: t.text, fontSize: 13 }}>📄 Xem chữ</Text>
        </Pressable>
        <Pressable onPress={p.onChaptersSheet} style={[styles.secBtn, { borderColor: t.border, backgroundColor: t.surface }]}>
          <Text style={{ color: t.text, fontSize: 13 }}>📋 Chương</Text>
        </Pressable>
        <Pressable onPress={p.onSleepSheet} style={[styles.secBtn, { borderColor: t.border, backgroundColor: t.surface }]}>
          <Text style={{ color: t.text, fontSize: 13 }}>🌙 {p.sleepLabel}</Text>
        </Pressable>
        <Pressable onPress={p.onStop} style={[styles.secBtn, { borderColor: t.danger, backgroundColor: t.surface }]}>
          <Text style={{ color: t.danger, fontSize: 13 }}>⏹ Dừng</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  seekWrap: { gap: 6 },
  seekTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  seekFill: { height: '100%' },
  seekLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  seekText: { fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  iconBtn: { alignItems: 'center', gap: 2, flex: 1, paddingVertical: 4 },
  icon: { fontSize: 18 },
  iconLabel: { fontSize: 10 },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 24 },
  ratesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  secondaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  secBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
