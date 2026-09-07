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
import { getIllustrations, groupIllustrations } from '../../lib/illustrations';

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
 * Tab Minh họa (mobile): ảnh gốc full chất lượng theo đợt + lightbox.
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
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const sectionY = useRef<Record<number, number>>({});
  const rowY = useRef<Record<string, number>>({});
  const containerY = useRef(0);
  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    setActiveIdx(0);
    setDrawerOpen(false);
    setVisibleCount(BATCH);
    setCollapsed(new Set());
    sectionY.current = {};
    rowY.current = {};
    getIllustrations(seriesId)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        // KHÔNG prefetch nền: mỗi ảnh chỉ tải khi hiện trong đợt của nó,
        // tránh chục link nặng song song gây nghẽn.
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

  // Prefetch CHẶN 1 đợt kế (tối đa BATCH link) để lướt tiếp hiện ngay —
  // không prefetch toàn bộ, tránh nghẽn mạng.
  useEffect(() => {
    if (!items) return;
    const next = items.slice(visibleCount, visibleCount + BATCH);
    if (next.length === 0) return;
    const t = setTimeout(() => {
      next.forEach((r) => Image.prefetch(r.imageUrl).catch(() => {}));
    }, 1500);
    return () => clearTimeout(t);
  }, [items, visibleCount]);

  useImperativeHandle(ref, () => ({ openIndex: () => setDrawer(true) }), []);

  // Y tuyệt đối trong ScrollView ngoài = containerY + sectionY + rowY (đo thật qua onLayout,
  // chính xác kể cả khi thu gọn/mở mục hay ảnh chưa tải xong).
  const yOf = (si: number, i: number): number | null => {
    const sy = sectionY.current[si];
    const ry = rowY.current[`${si}:${i}`];
    if (typeof sy !== 'number' || typeof ry !== 'number') return null;
    return Math.max(0, containerY.current + sy + ry - 12);
  };

  const doScrollTo = (si: number, i: number) => {
    const y = yOf(si, i);
    if (y !== null) {
      parentScrollRef.current?.scrollTo({ y, animated: true });
    } else {
      console.warn(`[SoNovel][illust] chưa đo được Y của ảnh ${i + 1}, bỏ qua cuộn`);
    }
  };

  const scrollTo = (si: number, i: number, closeDrawer = true) => {
    setActiveIdx(i);
    if (collapsed.has(si)) {
      // Mở mục đang thu gọn rồi đợi layout xong mới cuộn
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(si);
        return next;
      });
      setTimeout(() => doScrollTo(si, i), 150);
    } else {
      doScrollTo(si, i);
    }
    if (closeDrawer) setDrawer(false);
  };

  const toggleSection = (si: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(si)) next.delete(si);
      else next.add(si);
      return next;
    });
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
  const sections = groupIllustrations(items);
  let titledSeen = 0;

  const showMore = () => {
    setVisibleCount(Math.min(items.length, visibleCount + BATCH));
  };

  return (
    <View
      onLayout={(e) => { containerY.current = e.nativeEvent.layout.y; }}
    >
      <Text style={[TYPO.caption, { color: t.textMuted, marginBottom: 8 }]}>
        {items.length} ảnh · Đang xem {Math.min(activeIdx + 1, shown.length)}/{shown.length}
      </Text>

      {/* Ảnh theo mục (thu gọn được), đợt 6 — full gốc, giữ nguyên tỉ lệ */}
      <View style={{ gap: 16, paddingBottom: 8 }}>
        {sections.map((s, si) => {
          const rows = s.rows.filter(({ idx }) => idx < visibleCount);
          if (rows.length === 0) return null;
          const isCollapsed = collapsed.has(si);
          if (s.title) titledSeen++;
          const titleNo = s.title ? titledSeen : 0;
          return (
            <View
              key={`sec-${si}`}
              onLayout={(e) => { sectionY.current[si] = e.nativeEvent.layout.y; }}
              style={{ gap: 10 }}
            >
              {s.title ? (
                <Pressable
                  onPress={() => toggleSection(si)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: t.border,
                    backgroundColor: t.bgSubtle,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={isCollapsed ? `Mở ${s.title}` : `Thu gọn ${s.title}`}
                >
                  <Text style={[TYPO.bodySm, { color: t.text, fontWeight: '700', flex: 1 }]} numberOfLines={1}>
                    Mục {titleNo}: {s.title}
                    <Text style={{ color: t.textMuted, fontWeight: '400' }}> · {s.rows.length} ảnh</Text>
                  </Text>
                  <Icon name={isCollapsed ? 'chevron-forward' : 'chevron-down'} size={18} color={t.textMuted} />
                </Pressable>
              ) : null}
              {!isCollapsed && rows.map(({ it, idx: i }) => (
                <View
                  key={it.id || i}
                  onLayout={(e) => { rowY.current[`${si}:${i}`] = e.nativeEvent.layout.y; }}
                  style={{ gap: 6 }}
                >
                  <Text style={[TYPO.bodySm, { color: t.text, fontWeight: '600' }]}>
                    <Text style={{ color: t.primary }}>{i + 1}. </Text>
                    {it.caption || `Ảnh ${i + 1}`}
                  </Text>
                  <Pressable
                    onPress={() => { setFullUri(null); setLightbox(it.imageUrl); }}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`Phóng to ${it.caption || `ảnh ${i + 1}`}`}
                  >
                    <IllustrationImage uri={it.imageUrl} />
                  </Pressable>
                </View>
              ))}
            </View>
          );
        })}
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
              {sections.map((s, si) => (
                <View key={`idx-sec-${si}`} style={{ gap: 4 }}>
                  {s.title ? (
                    <Pressable
                      onPress={() => {
                        const first = s.rows[0];
                        if (!first) return;
                        if (first.idx >= visibleCount) setVisibleCount(first.idx + 1);
                        setTimeout(() => scrollTo(si, first.idx), 120);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Tới mục ${s.title}`}
                    >
                      <Text style={[TYPO.caption, { color: t.primary, fontWeight: '700', paddingHorizontal: 10, paddingTop: 4 }]}>
                        {s.title} ({s.rows.length})
                      </Text>
                    </Pressable>
                  ) : null}
                  {s.rows.map(({ it, idx: i }) => (
                    <Pressable
                      key={it.id || i}
                      onPress={() => {
                        if (i >= visibleCount) setVisibleCount(i + 1);
                        // Đợi render xong đợt mới rồi mới cuộn
                        setTimeout(() => scrollTo(si, i), 120);
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
                </View>
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

/** Ảnh gốc full + vòng xoay "đang tải" rõ ràng + nút thử lại khi lỗi. */
function IllustrationImage({ uri }: { uri: string }) {
  const t = useTheme();
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setRatio(null);
    setFailed(false);
    setLoaded(false);
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
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {!loaded && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="large" color={t.primary} />
          <Text style={[TYPO.caption, { color: t.textMuted }]}>Đang tải ảnh…</Text>
        </View>
      )}
    </View>
  );
}
