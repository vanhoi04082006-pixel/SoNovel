import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, TYPO, RADIUS } from '../theme';
import { Icon } from '../components/ui/Icon';
import { ChaptersSheet } from '../components/player/ChaptersSheet';
import { EmptyState } from '../components/ui/EmptyState';
import { listChapters, ChapterRow, recordHistory, saveReadProgress } from '../lib/progress';
import { getChapterContent } from '../lib/chapters';
import { useReaderSettings, setFontSize } from '../lib/readerSettings';
import { useReadMarkers, markChapterRead } from '../lib/readMarkers';
import { RootStackParamList } from '../navigation/types';

type ReaderRouteProp = RouteProp<RootStackParamList, 'Reader'>;

const SAVE_THROTTLE_MS = 5000;

const FONT_FAMILY_MAP: Record<string, string | undefined> = {
  system: undefined,
  serif: 'serif',
  sans: 'sans-serif',
  mono: 'monospace',
};

/**
 * Màn đọc chương — nằm BÊN TRONG hệ thống bộ truyện:
 * Series detail → tab Chapters → chọn chương → Reader → Chapter trước/sau.
 * Back từ Reader quay về đúng nơi đã mở (không mất ngữ cảnh).
 */
export function ReaderScreen() {
  const t = useTheme();
  const rs = useReaderSettings();
  const route = useRoute<ReaderRouteProp>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { seriesId, seriesTitle } = route.params;

  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [index, setIndex] = useState<number>(-1);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChapters, setShowChapters] = useState(false);

  const listRef = useRef<FlatList<string>>(null);
  const lastSaveRef = useRef(0);
  const charIndexRef = useRef(0);
  const chaptersRef = useRef(chapters);
  const indexRef = useRef(index);
  const seriesIdRef = useRef(seriesId);
  useEffect(() => { chaptersRef.current = chapters; indexRef.current = index; seriesIdRef.current = seriesId; });

  // ---- Tải danh sách chương (meta-only, nhanh nhờ fields=meta) ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const chs = await listChapters(seriesId);
        if (cancelled) return;
        setChapters(chs);
        let idx = route.params.chapterIndex ?? -1;
        if (route.params.chapterId) {
          const byId = chs.findIndex((c) => c.id === route.params.chapterId);
          if (byId >= 0) idx = byId;
        }
        if (idx < 0 || idx >= chs.length) idx = 0;
        setIndex(idx);
        recordHistory(seriesId).catch(() => {});
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Không tải được danh sách chương');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  // ---- Tải nội dung chương hiện tại + prefetch 2 chương lân cận ----
  useEffect(() => {
    if (index < 0 || !chapters[index]) return;
    let cancelled = false;
    const ch = chapters[index];
    setSwitching(true);
    (async () => {
      try {
        const row = await getChapterContent(seriesId, ch.id);
        if (cancelled) return;
        if (!row || !row.content) {
          setError('Chương này chưa có nội dung.');
          setContent(null);
        } else {
          setError(null);
          setContent(row.content);
        }
        charIndexRef.current = 0;
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        saveProgressNow();
        // Prefetch lân cận để bấm trước/sau là có ngay
        if (chapters[index + 1]) getChapterContent(seriesId, chapters[index + 1].id).catch(() => {});
        if (chapters[index - 1]) getChapterContent(seriesId, chapters[index - 1].id).catch(() => {});
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Không tải được nội dung chương');
      } finally {
        if (!cancelled) setSwitching(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, chapters]);

  const totalChars = useMemo(
    () => chapters[index]?.word_count ? (chapters[index].word_count as number) * 5 : 0,
    [chapters, index]
  );

  const saveProgressNow = useCallback(() => {
    const ch = chapters[index];
    if (!ch) return;
    lastSaveRef.current = Date.now();
    saveReadProgress({
      seriesId,
      chapterId: ch.id,
      charIndex: charIndexRef.current,
      percent: totalChars > 0 ? Math.min(100, (charIndexRef.current / totalChars) * 100) : undefined,
    }).catch(() => {});
  }, [chapters, index, seriesId, totalChars]);

  // Lưu tiến độ khi rời màn
  useEffect(() => {
    return () => {
      try {
        const ch = chaptersRef.current[indexRef.current];
        if (ch && charIndexRef.current > 0) {
          saveReadProgress({
            seriesId: seriesIdRef.current,
            chapterId: ch.id,
            charIndex: charIndexRef.current,
          }).catch(() => {});
        }
      } catch (_e) {}
    };
  }, []);

  const paragraphs = useMemo(
    () => (content ?? '').replace(/\r\n/g, '\n').split('\n'),
    [content]
  );
  const PARA_EST = rs.fontSize * rs.lineHeight + 16;

  // Cuộn → ước lượng vị trí ký tự để lưu tiến độ đọc (throttle 5s)
  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = Math.max(0, e.nativeEvent.contentOffset.y);
    const estIdx = Math.min(paragraphs.length - 1, Math.round(y / PARA_EST));
    let acc = 0;
    for (let i = 0; i < estIdx; i++) acc += (paragraphs[i]?.length ?? 0) + 1;
    charIndexRef.current = acc;
    if (Date.now() - lastSaveRef.current > SAVE_THROTTLE_MS) {
      lastSaveRef.current = Date.now();
      const ch = chapters[index];
      if (ch) {
        saveReadProgress({
          seriesId,
          chapterId: ch.id,
          charIndex: acc,
          percent: totalChars > 0 ? Math.min(100, (acc / totalChars) * 100) : undefined,
        }).catch(() => {});
      }
    }
  }, [paragraphs, PARA_EST, chapters, index, seriesId, totalChars]);

  const goChapter = useCallback((newIdx: number) => {
    if (newIdx < 0 || newIdx >= chapters.length || newIdx === index) return;
    setShowChapters(false);
    // Rời chương hiện tại đi tới chương kế → coi như đã đọc xong.
    const cur = chapters[index];
    if (cur && newIdx > index) markChapterRead(seriesId, cur.id).catch(() => {});
    setIndex(newIdx);
  }, [chapters.length, index]);

  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < chapters.length - 1;
  const ch = index >= 0 ? chapters[index] : null;
  const readSet = useReadMarkers(seriesId);

  // Cuộn tới cuối chương (~95%) → đánh dấu đã đọc (chỉ chạy 1 lần mỗi chương)
  useEffect(() => {
    if (!ch || !content) return;
    if (readSet.has(ch.id)) return;
    const id = setInterval(() => {
      if (charIndexRef.current >= totalChars * 0.95 && totalChars > 0) {
        markChapterRead(seriesId, ch.id).catch(() => {});
      }
    }, 2000);
    return () => clearInterval(id);
  }, [ch, content, readSet, totalChars, seriesId]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} size="large" />
          <Text style={[TYPO.bodySm, { color: t.textMuted, marginTop: 10 }]}>Đang mở chương…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ch) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['top']}>
        <ReaderHeader
          seriesTitle={seriesTitle}
          chapterLabel=""
          onBack={() => nav.goBack()}
          t={t}
        />
        <View style={styles.center}>
          <EmptyState icon="document-text-outline" title="Không có chương nào" message="Bộ truyện này chưa có chương để đọc." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['top']}>
      {/* Header: tên bộ truyện · Chương N */}
      <ReaderHeader
        seriesTitle={seriesTitle}
        chapterLabel={`Chương ${ch.order_no}. ${ch.title}`}
        onBack={() => nav.goBack()}
        t={t}
      />

      {/* Nội dung chương */}
      <View style={{ flex: 1 }}>
        {error ? (
          <View style={styles.center}>
            <EmptyState icon="cloud-offline-outline" title="Không tải được chương" message={error} />
            <Pressable
              onPress={() => goChapter(index)}
              style={[styles.retryBtn, { backgroundColor: t.primary }]}
            >
              <Text style={{ color: t.primaryText, fontSize: 13, fontWeight: '600' }}>Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={paragraphs}
            keyExtractor={(_, i) => String(i)}
            onScroll={onScroll}
            scrollEventThrottle={200}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
            renderItem={({ item }) =>
              item.trim() === '' ? (
                <View style={{ height: 10 }} />
              ) : (
                <Text
                  style={[
                    styles.para,
                    {
                      color: t.text,
                      fontSize: rs.fontSize,
                      lineHeight: rs.fontSize * rs.lineHeight,
                      fontFamily: FONT_FAMILY_MAP[rs.fontFamily],
                    },
                  ]}
                >
                  {item}
                </Text>
              )
            }
            ListFooterComponent={<View style={{ height: 24 }} />}
          />
        )}
        {switching && (
          <View style={[styles.switchOverlay, { backgroundColor: t.overlay }]}>
            <ActivityIndicator color={t.primaryText} />
          </View>
        )}
      </View>

      {/* Điều hướng: ← Chương trước | Danh sách | Chương tiếp → */}
      <View style={[styles.navBar, { borderTopColor: t.border, backgroundColor: t.surface }]}>
        <NavButton
          label="Trước"
          icon="arrow-back"
          disabled={!hasPrev}
          onPress={() => goChapter(index - 1)}
          t={t}
        />
        <Pressable
          onPress={() => setShowChapters(true)}
          style={[styles.tocBtn, { backgroundColor: t.bgSubtle }]}
          accessibilityRole="button"
          accessibilityLabel="Danh sách chương"
        >
          <Icon name="list-outline" size={17} color={t.text} />
          <Text style={[TYPO.label, { color: t.text }]}>
            {index + 1}/{chapters.length}
          </Text>
        </Pressable>
        <NavButton
          label="Sau"
          icon="arrow-forward"
          reversed
          disabled={!hasNext}
          onPress={() => goChapter(index + 1)}
          t={t}
        />
      </View>

      {/* Cỡ chữ nhanh */}
      <View style={[styles.fontBar, { backgroundColor: t.surface, borderTopColor: t.border }]}>
        <Text style={[TYPO.caption, { color: t.textMuted, flex: 1 }]} numberOfLines={1}>
          {totalChars > 0 ? `${Math.round(((charIndexRef.current / totalChars) * 100)).toFixed(0)}% chương` : ''}
        </Text>
        <Pressable onPress={() => setFontSize(rs.fontSize - 1)} style={styles.fontBtn} hitSlop={6}>
          <Icon name="text-outline" size={13} color={t.textMuted} />
        </Pressable>
        <Pressable onPress={() => setFontSize(rs.fontSize + 1)} style={styles.fontBtn} hitSlop={6}>
          <Icon name="text" size={19} color={t.text} />
        </Pressable>
      </View>

      <ChaptersSheet
        visible={showChapters}
        onClose={() => setShowChapters(false)}
        chapters={chapters.map((c) => ({ id: c.id, title: c.title, order_no: c.order_no }))}
        currentIndex={index}
        readIds={readSet}
        onSelect={(idx) => goChapter(idx)}
      />
    </SafeAreaView>
  );
}

function ReaderHeader({
  seriesTitle,
  chapterLabel,
  onBack,
  t,
}: {
  seriesTitle: string;
  chapterLabel: string;
  onBack: () => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.header, { borderBottomColor: t.border }]}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Quay lại">
        <Icon name="arrow-back" size={22} color={t.text} />
      </Pressable>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={[TYPO.caption, { color: t.textMuted }]} numberOfLines={1}>{seriesTitle}</Text>
        {!!chapterLabel && (
          <Text style={[TYPO.bodySm, { color: t.text, fontWeight: '600', marginTop: 1 }]} numberOfLines={1}>
            {chapterLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

function NavButton({
  label,
  icon,
  reversed,
  disabled,
  onPress,
  t,
}: {
  label: string;
  icon: string;
  reversed?: boolean;
  disabled?: boolean;
  onPress: () => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.navBtn,
        { opacity: disabled ? 0.35 : pressed ? 0.75 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label === 'Trước' ? 'Chương trước' : 'Chương tiếp'}
    >
      {!reversed ? <Icon name={icon as any} size={17} color={t.text} /> : null}
      <Text style={[TYPO.label, { color: t.text }]}>{label}</Text>
      {reversed ? <Icon name={icon as any} size={17} color={t.text} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  para: {
    marginBottom: 14,
    textAlign: 'justify',
  },
  switchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
  tocBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
  fontBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fontBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
});
