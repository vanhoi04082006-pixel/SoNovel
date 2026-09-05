import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme, TYPO } from '../../theme';
import { Icon } from '../ui/Icon';
import type { IllustrationRow } from '../../lib/illustrations';
import { getIllustrations } from '../../lib/illustrations';

const DRAWER_WIDTH = Math.min(300, Dimensions.get('window').width * 0.78);

/**
 * Tab Minh họa (mobile): mục lục ngăn kéo trái (đẩy ra/thu vào) + ảnh giữ nguyên tỉ lệ.
 * Khớp web: chữ (thông tin ảnh) trên, ảnh dưới, theo đúng thứ tự.
 */
export function IllustrationsTab({ seriesId }: { seriesId: string }) {
  const t = useTheme();
  const [items, setItems] = useState<IllustrationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const rowY = useRef<Record<number, number>>({});
  const listRef = useRef<ScrollView | null>(null);
  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    setActiveIdx(0);
    setDrawerOpen(false);
    getIllustrations(seriesId)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch((e: any) => { if (!cancelled) setError(e?.message ?? 'Không tải được ảnh minh họa'); });
    return () => { cancelled = true; };
  }, [seriesId]);

  const setDrawer = (open: boolean) => {
    setDrawerOpen(open);
    Animated.timing(slideX, {
      toValue: open ? 0 : -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

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

  const scrollTo = (i: number, closeDrawer = true) => {
    setActiveIdx(i);
    const y = rowY.current[i];
    if (typeof y === 'number') listRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
    if (closeDrawer) setDrawer(false);
  };

  const cur = items[activeIdx];

  return (
    <View>
      {/* Thanh mục lục: bấm để đẩy ngăn kéo trái ra/thu vào */}
      <Pressable
        onPress={() => setDrawer(!drawerOpen)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: t.bgSubtle,
          marginBottom: 12,
        }}
        accessibilityRole="button"
        accessibilityLabel={drawerOpen ? 'Thu mục lục' : 'Mở mục lục minh họa'}
      >
        <Icon name="list" size={18} color={t.primary} />
        <Text style={[TYPO.bodySm, { color: t.text, fontWeight: '600', flex: 1 }]} numberOfLines={1}>
          Mục lục ({items.length}){cur ? ` · Đang xem ${activeIdx + 1}` : ''}
        </Text>
        <Icon name={drawerOpen ? 'chevron-back' : 'chevron-forward'} size={16} color={t.textMuted} />
      </Pressable>

      {/* Ngăn kéo mục lục trái */}
      <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={() => setDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Animated.View
            style={{
              width: DRAWER_WIDTH,
              backgroundColor: t.surface,
              borderRightWidth: 1,
              borderRightColor: t.border,
              paddingTop: 48,
              paddingBottom: 24,
              transform: [{ translateX: slideX }],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}>
              <Text style={[TYPO.bodySm, { fontWeight: '700', color: t.text }]}>Mục lục ({items.length})</Text>
              <Pressable onPress={() => setDrawer(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Thu mục lục">
                <Icon name="close" size={20} color={t.textMuted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: 12 }}>
              {items.map((it, i) => (
                <Pressable
                  key={it.id || i}
                  onPress={() => scrollTo(i)}
                  style={{
                    borderWidth: 1,
                    borderColor: i === activeIdx ? t.primary : 'transparent',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 9,
                    backgroundColor: i === activeIdx ? t.primarySoft : 'transparent',
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Tới ${it.caption || `ảnh ${i + 1}`}`}
                >
                  <Text numberOfLines={2} style={[TYPO.bodySm, { color: i === activeIdx ? t.primary : t.text, fontWeight: i === activeIdx ? '700' : '400' }]}>
                    {i + 1}. {it.caption || `Ảnh ${i + 1}`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setDrawer(false)} accessibilityLabel="Đóng mục lục" />
        </View>
      </Modal>

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
