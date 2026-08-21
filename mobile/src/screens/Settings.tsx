import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, TYPO, RADIUS, SPACING } from '../theme';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Icon } from '../components/ui/Icon';
import { useReaderSettings, setFontSize, setLineHeight, setFontFamily, resetReaderSettings, FontFamily } from '../lib/readerSettings';
import { saveSettings } from '../lib/progress';

const FONT_OPTIONS: { key: FontFamily; label: string }[] = [
  { key: 'system', label: 'Mặc định' },
  { key: 'serif', label: 'Serif' },
  { key: 'sans', label: 'Sans' },
  { key: 'mono', label: 'Mono' },
];

export function SettingsScreen() {
  const t = useTheme();
  const { fontSize, lineHeight, fontFamily } = useReaderSettings();

  const pickFont = (f: FontFamily) => {
    setFontFamily(f);
    saveSettings({ fontFamily: f }).catch(() => {});
  };

  return (
    <Screen edges={['top']} scroll>
      <ScreenHeader title="Cài đặt" />

      {/* Font size */}
      <View style={styles.section}>
        <Text style={[TYPO.title, { color: t.text }]}>Cỡ chữ</Text>
        <Text style={[TYPO.caption, { color: t.textMuted, marginBottom: 6 }]}>Áp dụng cho phần Xem chữ trong trình nghe.</Text>
        <View style={styles.rowBetween}>
          <Pressable onPress={() => setFontSize(fontSize - 1)} style={[styles.smallBtn, { backgroundColor: t.bgSubtle }]}>
            <Icon name="remove" size={18} color={t.text} />
          </Pressable>
          <Text style={[TYPO.h3, { color: t.text }]}>{fontSize}px</Text>
          <Pressable onPress={() => setFontSize(fontSize + 1)} style={[styles.smallBtn, { backgroundColor: t.bgSubtle }]}>
            <Icon name="add" size={18} color={t.text} />
          </Pressable>
        </View>
        {/* Preview */}
        <Text style={{ fontSize, lineHeight, color: t.text, marginTop: 8 }}>
          Mèo con đang ngồi lặng lẽ bên cửa sổ, ngắm nhìn hoàng hôn buông xuống phố nhỏ.
        </Text>
      </View>

      {/* Line height */}
      <View style={styles.section}>
        <Text style={[TYPO.title, { color: t.text }]}>Giãn dòng</Text>
        <View style={styles.rowBetween}>
          <Pressable onPress={() => setLineHeight(Math.round((lineHeight - 0.1) * 10) / 10)} style={[styles.smallBtn, { backgroundColor: t.bgSubtle }]}>
            <Icon name="remove" size={18} color={t.text} />
          </Pressable>
          <Text style={[TYPO.h3, { color: t.text }]}>{lineHeight.toFixed(1)}</Text>
          <Pressable onPress={() => setLineHeight(Math.round((lineHeight + 0.1) * 10) / 10)} style={[styles.smallBtn, { backgroundColor: t.bgSubtle }]}>
            <Icon name="add" size={18} color={t.text} />
          </Pressable>
        </View>
      </View>

      {/* Font family */}
      <View style={styles.section}>
        <Text style={[TYPO.title, { color: t.text }]}>Phông chữ</Text>
        <View style={styles.chips}>
          {FONT_OPTIONS.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => pickFont(o.key)}
              style={[styles.chip, { backgroundColor: fontFamily === o.key ? t.primary : t.bgSubtle }]}
            >
              <Text style={{ color: fontFamily === o.key ? t.primaryText : t.text, fontSize: 13, fontWeight: '600' }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Reset */}
      <View style={styles.section}>
        <Pressable
          onPress={resetReaderSettings}
          style={[styles.resetBtn, { backgroundColor: t.dangerSoft }]}
        >
          <Icon name="refresh-outline" size={18} color={t.danger} />
          <Text style={{ color: t.danger, fontSize: 13, fontWeight: '600' }}>Đặt lại cài đặt đọc</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 24, gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallBtn: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.pill },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
  },
});
