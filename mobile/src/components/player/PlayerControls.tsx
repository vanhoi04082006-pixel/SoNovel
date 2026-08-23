import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, TYPO, RADIUS } from '../../theme';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';
import { SeekBar } from './SeekBar';
import { SleepOption } from './SleepSheet';

type Props = {
  isPlaying: boolean;
  busy: boolean;
  rate: number;
  charIndex: number;
  charLength: number;
  sleepLabel: string;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (char: number) => void;
  onSeekBySeconds: (sec: number) => void;
  onTextSheet: () => void;
  onChaptersSheet: () => void;
  onSleepSheet: () => void;
  onBookmark: () => void;
  onStop: () => void;
  onSetRate: (r: number) => void;
};

const RATES = [0.75, 1, 1.25, 1.5, 2];

export function PlayerControls(p: Props) {
  const t = useTheme();
  const tap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    p.onPlayPause();
  };

  return (
    <View style={styles.wrap}>
      {/* Seek bar + progress */}
      <SeekBar charIndex={p.charIndex} charLength={p.charLength} rate={p.rate} onSeek={p.onSeek} />

      {/* Main controls */}
      <View style={styles.row}>
        <Pressable
          onPress={p.onPrev}
          onLongPress={() => p.onSeekBySeconds(-10)}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Icon name="play-back" size={26} color={t.text} />
          <Text style={[TYPO.caption, { color: t.textMuted }]}>Trước</Text>
        </Pressable>
        <Pressable
          onPress={tap}
          style={({ pressed }) => [
            styles.playBtn,
            { backgroundColor: t.primary },
            pressed && { transform: [{ scale: 0.94 }], opacity: 0.9 },
          ]}
        >
          {/* KHÔNG xoay khi busy — luôn hiển thị icon theo trạng thái thật */}
          <Icon name={p.isPlaying ? 'pause' : 'play'} size={30} color={t.primaryText} />
        </Pressable>
        <Pressable
          onPress={p.onNext}
          onLongPress={() => p.onSeekBySeconds(10)}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Icon name="play-forward" size={26} color={t.text} />
          <Text style={[TYPO.caption, { color: t.textMuted }]}>Sau</Text>
        </Pressable>
      </View>

      {/* Rate chips */}
      <View style={styles.ratesRow}>
        {RATES.map((r) => (
          <Chip
            key={r}
            label={`${r}×`}
            selected={Math.abs(p.rate - r) < 0.01}
            variant={Math.abs(p.rate - r) < 0.01 ? 'filled' : 'soft'}
            onPress={() => p.onSetRate(r)}
          />
        ))}
      </View>

      {/* Secondary actions */}
      <View style={styles.secondaryRow}>
        <Pressable onPress={p.onTextSheet} style={({ pressed }) => [styles.secBtn, { backgroundColor: t.bgSubtle }, pressed && { opacity: 0.7 }]}>
          <Icon name="document-text-outline" size={18} color={t.text} />
          <Text style={[TYPO.label, { color: t.text }]}>Xem chữ</Text>
        </Pressable>
        <Pressable onPress={p.onChaptersSheet} style={({ pressed }) => [styles.secBtn, { backgroundColor: t.bgSubtle }, pressed && { opacity: 0.7 }]}>
          <Icon name="list-outline" size={18} color={t.text} />
          <Text style={[TYPO.label, { color: t.text }]}>Chương</Text>
        </Pressable>
        <Pressable onPress={p.onSleepSheet} style={({ pressed }) => [styles.secBtn, { backgroundColor: t.bgSubtle }, pressed && { opacity: 0.7 }]}>
          <Icon name="moon-outline" size={18} color={t.text} />
          <Text style={[TYPO.label, { color: t.text }]}>{p.sleepLabel}</Text>
        </Pressable>
        <Pressable onPress={p.onBookmark} style={({ pressed }) => [styles.secBtn, { backgroundColor: t.bgSubtle }, pressed && { opacity: 0.7 }]}>
          <Icon name="bookmark-outline" size={18} color={t.text} />
          <Text style={[TYPO.label, { color: t.text }]}>Đánh dấu</Text>
        </Pressable>
        <Pressable onPress={p.onStop} style={({ pressed }) => [styles.secBtn, { backgroundColor: t.dangerSoft }, pressed && { opacity: 0.7 }]}>
          <Icon name="stop-circle-outline" size={18} color={t.danger} />
          <Text style={[TYPO.label, { color: t.danger }]}>Dừng</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  iconBtn: { alignItems: 'center', gap: 4, flex: 1, paddingVertical: 4 },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  ratesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  secondaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  secBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
});
