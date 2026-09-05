import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  findNodeHandle,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { RefObject } from 'react';
import { useTheme, TYPO } from '../../theme';
import { Icon } from '../ui/Icon';
import type { IllustrationRow } from '../../lib/illustrations';
import { getIllustrations } from '../../lib/illustrations';

const DRAWER_WIDTH = Math.min(300, Dimensions.get('window').width * 0.78);

type Props = {
  seriesId: string;
  /** ScrollView ngoài của màn Series — dùng để cuộn 1 luồng (không ScrollView lồng). */
  parentScrollRef: RefObject<ScrollView | null>;
};

/**
 * Tab Minh họa (mobile): nút mục lục sát rìa trái + ảnh thumb nhẹ (giữ tỉ lệ),
 * bấm mới tải full. Khớp web: chữ (thông tin ảnh) trên, ảnh dưới, đúng thứ tự.
 */
export function IllustrationsTab({ seriesId, parentScrollRef }: Props) {
  const t = useTheme();
  const [items, setItems] = useState<IllustrationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [fullUri, setFullUri] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const rowRefs = useRef<Record<number, View | null>>({});
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

  // Cuộn bằng ScrollView NGOÀI (1 luồng cuộn duy nhất) — bấm mục nào tới ảnh đó.
  const scrollTo = (i: number, closeDrawer = true) => {
    setActiveIdx(i);
    const parent = parentScrollRef.current;
    const row = rowRefs.current[i];
    if (parent && row) {
      const node = findNodeHandle(parent);
      if (node) {
        row.measureLayout(node, (_x, y) => {
          parent.scrollTo({ y: Math.max(0, y - 12), animated: true });
        }, () => {});
      }
    }
    if (closeDrawer) setDrawer(false);
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
        <Pressable
          onPress={() => {
            setError(null);
            setItems(null);
            getIllustrations(seriesId)
              .then((rows) => setItems(rows))
              .catch((e: any) => setError(e?.message ?? 'Không tải được ảnh minh họa'));
          }}
          style={{ borderWidth: 1, borderColor: t.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Thử tải lại ảnh minh họa"
        >
          <Text style={[TYPO.bodySm, { color: t.primary, fontWeight: '600' }]}>Thử lại</Text>
        </Pressable>
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

  const cur = items[activeIdx];

  return (
    <View>
      {/* Vị trí đang xem */}
      <Text style={[TYPO.caption, { color: t.textMuted, marginBottom: 8 }]}>
        {items.length} ảnh{cur ? ` · Đang xem ${activeIdx + 1}` : ''}
      </Text>

      {/* Cột ảnh: thumb nhẹ trước, giữ nguyên tỉ lệ */}
      <View style={{ gap: 16, paddingBottom: 24 }}>
        {items.map((it, i) => (
          <View
            key={it.id || i}
            ref={(el) => { rowRefs.current[i] = el; }}
            collapsable={false}
            style={{ gap: 6 }}
          >
            <Text style={[TYPO.bodySm, { color: t.text, fontWeight: '600' }]}>
              <Text style={{ color: t.primary }}>{i + 1}. </Text>
              {it.caption || `Ảnh ${i + 1}`}
            </Text>
            <Pressable
              onPress={() => { setFullUri(it.imageUrl); setLightbox(it.thumbUrl); }}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Phóng to ${it.caption || `ảnh ${i + 1}`}`}
            >
              <IllustrationImage uri={it.thumbUrl} />
            </Pressable>
          </View>
        ))}
      </View>

      {/* Nút mục lục sát rìa trái màn hình */}
      <Pressable
        onPress={() => setDrawer(!drawerOpen)}
        style={{
          position: 'absolute',
          left: 0,
          top: 120,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: t.primary,
          borderTopRightRadius: 999,
          borderBottomRightRadius: 999,
          paddingLeft: 8,
          paddingRight: 12,
          paddingVertical: 12,
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        }}
        accessibilityRole="button"
        accessibilityLabel={drawerOpen ? 'Thu mục lục' : 'Mở mục lục minh họa'}
      >
        <Icon name="list" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{items.length}</Text>
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

      {/* Lightbox: hiện thumb ngay, full tải nền rồi swap */}
      <Modal visible={lightbox !== null} transparent animationType="fade" onRequestClose={() => { setLightbox(null); setFullUri(null); }}>
        <Pressable
          onPress={() => { setLightbox(null); setFullUri(null); }}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 }}
        >
          {lightbox ? (
            <Image source={{ uri: lightbox }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          ) : null}
          {fullUri && fullUri !== lightbox ? (
            <Image
              source={{ uri: fullUri }}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              resizeMode="contain"
              onLoad={() => setLightbox(fullUri)}
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

/** Ảnh thumb nhẹ, giữ nguyên tỉ lệ gốc (contain) + nút thử lại khi lỗi. */
function IllustrationImage({ uri }: { uri: string }) {
  const t = useTheme();
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setRatio(null);
    setFailed(false);
    Image.getSize(
      uri,
      (w, h) => { if (!cancelled && w > 0 && h > 0) setRatio(h / w); },
      () => { if (!cancelled) setRatio(9 / 16); }
    );
    return () => { cancelled = true; };
  }, [uri, retryKey]);
  if (failed) {
    return (
      <View style={{ width: '100%', minHeight: 160, backgroundColor: t.bgSubtle, borderRadius: 12, borderWidth: 1, borderColor: t.border, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16 }}>
        <Text style={[TYPO.caption, { color: t.textMuted, textAlign: 'center' }]}>Không tải được ảnh (mạng yếu?).</Text>
        <Pressable
          onPress={() => setRetryKey((k) => k + 1)}
          style={{ borderWidth: 1, borderColor: t.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Thử tải lại ảnh"
        >
          <Text style={[TYPO.bodySm, { color: t.primary, fontWeight: '600' }]}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ width: '100%', aspectRatio: ratio ? 1 / ratio : 16 / 9, backgroundColor: t.bgSubtle, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: t.border }}>
      <Image
        key={retryKey}
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
        resizeMethod="resize"
        progressiveRenderingEnabled
        onError={() => setFailed(true)}
      />
    </View>
  );
}
