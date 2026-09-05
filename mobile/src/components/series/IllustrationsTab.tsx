import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme, TYPO } from '../../theme';
import type { IllustrationRow } from '../../lib/illustrations';
import { getIllustrations } from '../../lib/illustrations';

/**
 * Tab Minh họa (mobile): danh sách caption phía trên + ảnh giữ nguyên tỉ lệ (contain).
 * Khớp web: chữ (thông tin ảnh) trên, ảnh dưới, theo đúng thứ tự.
 */
export function IllustrationsTab({ seriesId }: { seriesId: string }) {
  const t = useTheme();
  const [items, setItems] = useState<IllustrationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const rowY = useRef<Record<number, number>>({});
  const listRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    setActiveIdx(0);
    getIllustrations(seriesId)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch((e: any) => { if (!cancelled) setError(e?.message ?? 'Không tải được ảnh minh họa'); });
    return () => { cancelled = true; };
  }, [seriesId]);

  if (items === null && !error) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }}>
        <Text style={[TYPO.bodySm, { color: t.textMuted, textAlign: 'center' }]}>{error}</Text>
      </View>
    );
  }
  if (!items || items.length === 0) {
    return (
      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
        <Text style={[TYPO.bodySm, { color: t.textMuted, textAlign: 'center' }]}>Chưa có ảnh minh họa.</Text>
      </View>
    );
  }

  const scrollTo = (i: number) => {
    setActiveIdx(i);
    const y = rowY.current[i];
    if (typeof y === 'number') listRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  return (
    <View>
      {/* Mục lục ngang */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {items.map((it, i) => (
          <Pressable
            key={it.id || i}
            onPress={() => scrollTo(i)}
            style={{
              borderWidth: 1,
              borderColor: i === activeIdx ? t.primary : t.border,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: i === activeIdx ? t.primarySoft : 'transparent',
            }}
            accessibilityRole="button"
            accessibilityLabel={`Tới ${it.caption || `ảnh ${i + 1}`}`}
          >
            <Text numberOfLines={1} style={[TYPO.caption, { color: i === activeIdx ? t.primary : t.textMuted, maxWidth: 160 }]}>
              {i + 1}. {it.caption || `Ảnh ${i + 1}`}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Cột ảnh giữ nguyên tỉ lệ */}
      <ScrollView
        ref={listRef}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
      >
        {items.map((it, i) => (
          <View
            key={it.id || i}
            onLayout={(e) => { rowY.current[i] = e.nativeEvent.layout.y; }}
            style={{ gap: 6 }}
          >
            <Text style={[TYPO.bodySm, { color: t.text, fontWeight: '600' }]}>
              <Text style={{ color: t.primary }}>{i + 1}. </Text>
              {it.caption || `Ảnh ${i + 1}`}
            </Text>
            <Pressable onPress={() => setLightbox(it.imageUrl)} accessibilityRole="imagebutton" accessibilityLabel={`Phóng to ${it.caption || `ảnh ${i + 1}`}`}>
              <IllustrationImage uri={it.imageUrl} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {/* Lightbox */}
      <Modal visible={lightbox !== null} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <Pressable
          onPress={() => setLightbox(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 }}
        >
          {lightbox ? (
            <Image source={{ uri: lightbox }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

/** Ảnh giữ nguyên tỉ lệ gốc (contain): đo kích thước thật rồi tính chiều cao theo. */
function IllustrationImage({ uri }: { uri: string }) {
  const t = useTheme();
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRatio(null);
    Image.getSize(
      uri,
      (w, h) => { if (!cancelled && w > 0 && h > 0) setRatio(h / w); },
      () => { if (!cancelled) setRatio(9 / 16); }
    );
    return () => { cancelled = true; };
  }, [uri]);
  return (
    <View style={{ width: '100%', aspectRatio: ratio ? 1 / ratio : 16 / 9, backgroundColor: t.bgSubtle, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: t.border }}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </View>
  );
}
