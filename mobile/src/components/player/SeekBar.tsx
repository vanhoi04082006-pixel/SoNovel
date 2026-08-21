import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { useTheme, TYPO } from '../../theme';

type Props = {
  charIndex: number;
  charLength: number;
  rate: number;
  onSeek: (char: number) => void;
};

// TTS ~4.5 ký tự/giây ở rate 1 (ước tính — khớp web)
const CHARS_PER_SEC = 4.5;

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function SeekBar({ charIndex, charLength, rate, onSeek }: Props) {
  const t = useTheme();
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null); // 0..1 khi đang kéo

  const len = Math.max(1, charLength);
  const charsPerSec = Math.max(0.5, CHARS_PER_SEC * (rate || 1));
  const totalSec = charLength / charsPerSec;
  const frac = Math.min(1, Math.max(0, (drag ?? charIndex) / len));
  const posSec = frac * totalSec;

  const computeFrac = (x: number) => Math.min(1, Math.max(0, x / Math.max(1, width)));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setDrag(computeFrac(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setDrag(computeFrac(e.nativeEvent.locationX)),
      onPanResponderRelease: (e) => {
        const f = computeFrac(e.nativeEvent.locationX);
        setDrag(null);
        onSeek(Math.floor(f * charLength));
      },
      onPanResponderTerminate: () => setDrag(null),
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap}>
      <View {...pan.panHandlers} onLayout={onLayout} style={styles.hitArea} collapsable={false}>
        <View style={[styles.track, { backgroundColor: t.bgSubtle }]}>
          <View style={[styles.fill, { width: `${frac * 100}%`, backgroundColor: t.primary }]} />
          <View style={[styles.thumb, { backgroundColor: t.primary, left: `${Math.min(97, frac * 100)}%` }]} />
        </View>
      </View>
      <View style={styles.meta}>
        <Text style={[TYPO.caption, { color: t.textMuted, minWidth: 34 }]}>
          {drag !== null ? fmt(posSec) : fmt(charIndex / charsPerSec)}
        </Text>
        <Text style={[TYPO.caption, { color: t.primary, fontWeight: '700' }]}>{Math.round(frac * 100)}%</Text>
        <Text style={[TYPO.caption, { color: t.textMuted, minWidth: 34, textAlign: 'right' }]}>{fmt(totalSec)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  hitArea: { paddingVertical: 8, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'visible', justifyContent: 'center' },
  fill: { height: 4, borderRadius: 2 },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
