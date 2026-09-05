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

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function SeekBar({ charIndex, charLength, rate, onSeek }: Props) {
  const t = useTheme();
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null); // 0..1 khi đang kéo

  // Refs mirror để PanResponder (tạo 1 lần) luôn đọc giá trị mới nhất —
  // fix bug stale closure: trước đây computeFrac giữ width=1 của lần render đầu
  // nên kéo đâu cũng ra frac=1 → nhảy 100%.
  const widthRef = useRef(1);
  const originXRef = useRef(0);
  const lenRef = useRef(1);
  const onSeekRef = useRef(onSeek);
  const trackRef = useRef<View | null>(null);

  const len = Math.max(1, charLength);
  lenRef.current = len;
  onSeekRef.current = onSeek;
  const charsPerSec = Math.max(0.5, CHARS_PER_SEC * (rate || 1));
  const totalSec = charLength / charsPerSec;
  const frac = clamp01((drag ?? charIndex) / len);
  const posSec = frac * totalSec;

  const fracFromPageX = (pageX: number) => {
    const w = Math.max(1, widthRef.current);
    return clamp01((pageX - originXRef.current) / w);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        // Đo tọa độ tuyệt đối của track — không dùng locationX (tương đối theo
        // view con được chạm, cho giá trị rác khi chạm trúng thumb/fill).
        trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
          originXRef.current = pageX;
          setDrag(fracFromPageX(e.nativeEvent.pageX));
        });
      },
      onPanResponderMove: (e) => setDrag(fracFromPageX(e.nativeEvent.pageX)),
      onPanResponderRelease: (e) => {
        const f = fracFromPageX(e.nativeEvent.pageX);
        setDrag(null);
        onSeekRef.current(Math.floor(f * lenRef.current));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => setDrag(null),
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = Math.max(1, w);
    setWidth(widthRef.current);
  };

  return (
    <View style={styles.wrap}>
      <View
        ref={trackRef}
        {...pan.panHandlers}
        onLayout={onLayout}
        style={styles.hitArea}
        collapsable={false}
      >
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
