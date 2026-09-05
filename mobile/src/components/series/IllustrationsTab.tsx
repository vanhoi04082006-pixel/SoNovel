import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image as RNImage,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme, TYPO } from '../../theme';
import { Icon } from '../ui/Icon';
import type { IllustrationRow } from '../../lib/illustrations';
import { getIllustrations } from '../../lib/illustrations';

const DRAWER_WIDTH = Math.min(300, Dimensions.get('window').width * 0.78);
const BATCH = 6;

export type IllustIndexHandle = {
  openIndex: () => void;
};

type Props = {
  seriesId: string;
  /** ScrollView ngoài của màn Series — cuộn 1 luồng duy nhất. */
  parentScrollRef: React.RefObject<ScrollView | null>;
};

/**
 * Tab Minh họa (mobile): ảnh thumb nhẹ theo đợt + lightbox full.
 * Mục lục mở qua ref (nút nổi do màn Series render ngoài ScrollView nên không trôi).
 * Cuộn bằng Y cộng dồn từ onLayout — xác định, không phụ thuộc native measure.
 */
export const IllustrationsTab = forwardRef<IllustIndexHandle, Props>(function IllustrationsTab(
  { seriesId, parentScrollRef },
  ref
) {
  const t = useTheme();
  const [items, setItems] = useState<IllustrationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [fullUri, setFullUri] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(BATCH);
  const heights = useRef<Record<number, number>>({});
  const containerY = useRef(0);
  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    setActiveIdx(0);
    setDrawerOpen(false);
    setVisibleCount(BATCH);
    heights.current = {};
    getIllustrations(seriesId)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        // Prefetch thumb đợt đầu để lướt mượt
        rows.slice(0, BATCH).forEach((r) => Image.prefetch(r.thumbUrl).catch(() => {}));
      })
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

  useImperativeHandle(ref, () => ({ openIndex: () => setDrawer(true) }), []);

  const yOf = (i: number): number | null => {
    if (!items) return null;
    let y = containerY.current;
    for (let k = 0; k < i; k++) {
      const h = heights.current[k];
      if (typeof h !== 'number') return null; // chưa đo xong → không đoán
      y += h + 16; // gap 16 giữa các ảnh
    }
    return Math.max(0, y - 12);
  };

  const scrollTo = (i: number, closeDrawer = true) => {
    setActiveIdx(i);
    const y = yOf(i);
    if (y !== null) {
      parentScrollRef.current?.scrollTo({ y, animated: true });
    } else {
      console.warn(`[SoNovel][illust] chưa đo được Y của ảnh ${i + 1}, bỏ qua cuộn`);
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

  const shown = items.slice(0, visibleCount);

  const showMore = () => {
    const next = Math.min(items.length, visibleCount + BATCH);
    items.slice(visibleCount, next).forEach((r) => Image.prefetch(r.thumbUrl).catch(() => {}));
    setVisibleCount(next);
  };

  return (
    <View
      onLayout={(e) => { containerY.current = e.nativeEvent.layout.y; }}
    >
      <Text style={[TYPO.caption, { color: t.textMuted, marginBottom: 8 }]}>
        {items.length} ảnh · Đang xem {Math.min(activeIdx + 1, shown.length)}/{shown.length}
      </Text>

      {/* Ảnh theo đợt 6 — thumb nhẹ trước, giữ nguyên tỉ lệ */}
      <View style={{ gap: 16, paddingBottom: 8 }}>
        {shown.map((it, i) => (
          <View
            key={it.id || i}
            onLayout={(e) => { heights.current[i] = e.nativeEvent.layout.height; }}
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
      {visibleCount < items.length && (
        <Pressable
          onPress={showMore}
          style={{ borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 24 }}
          accessibilityRole="button"
          accessibilityLabel={`Xem thêm ảnh, còn ${items.length - visibleCount}`}
        >
          <Text style={[TYPO.bodySm, { color: t.primary, fontWeight: '700' }]}>
            Xem thêm ({items.length - visibleCount} ảnh còn lại)
          </Text>
        </Pressable>
      )}

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
                  onPress={() => {
                    if (i >= visibleCount) setVisibleCount(i + 1);
                    // Đợi render xong đợt mới rồi mới cuộn
                    setTimeout(() => scrollTo(i), 60);
                  }}
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
            <Image source={{ uri: lightbox }} style={{ width: '100%', height: '100%' }} contentFit="contain" cachePolicy="memory-disk" />
          ) : null}
          {fullUri && fullUri !== lightbox ? (
            <Image
              source={{ uri: fullUri }}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              contentFit="contain"
              cachePolicy="memory-disk"
              onLoad={() => setLightbox((prev) => (prev ? fullUri : prev))}
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
});

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
    RNImage.getSize(
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
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={150}
        onError={() => setFailed(true)}
      />
    </View>
  );
}
