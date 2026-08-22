import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, TYPO, RADIUS, SPACING } from '../../theme';
import { SheetModal } from '../ui/SheetModal';
import { Icon } from '../ui/Icon';

export type ChapterListItem = {
  id: string;
  title: string;
  order_no?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  chapters: ChapterListItem[];
  currentIndex: number;
  onSelect: (idx: number) => void;
  /** Set chapterId đã nghe/đọc — hiện tick xanh cạnh chương. */
  readIds?: ReadonlySet<string>;
};

export function ChaptersSheet({ visible, onClose, chapters, currentIndex, onSelect, readIds }: Props) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const listRef = useRef<FlatList<{ c: ChapterListItem; i: number }>>(null);

  // Mở sheet → cuộn tới chương đang phát (fix: trước đây luôn đứng ở đầu,
  // người dùng tưởng danh sách "bị hard cứng" không di chuyển được).
  useEffect(() => {
    if (!visible) return;
    setQ('');
    const id = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({
          index: Math.max(0, Math.min(currentIndex, chapters.length - 1)),
          animated: false,
          viewPosition: 0.35,
        });
      } catch (_e) {}
    }, 260);
    return () => clearTimeout(id);
  }, [visible, currentIndex, chapters.length]);

  const filtered = useMemo(() => {
    if (!q.trim()) return chapters.map((c, i) => ({ c, i }));
    const needle = q.trim().toLowerCase();
    return chapters
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) =>
        c.title.toLowerCase().includes(needle) || String(i + 1) === needle
      );
  }, [q, chapters]);

  const renderItem = useCallback(
    ({ item }: { item: { c: ChapterListItem; i: number } }) => {
      const { c, i } = item;
      const isCur = i === currentIndex;
      const isRead = !!readIds?.has(c.id);
      return (
        <Pressable
          onPress={() => { onSelect(i); onClose(); }}
          style={[styles.row, { backgroundColor: isCur ? t.primarySoft : 'transparent' }]}
        >
          <View style={[styles.idxWrap, { backgroundColor: isCur ? t.primary : isRead ? t.successSoft : t.bgSubtle }]}>
            <Text style={[styles.idx, { color: isCur ? t.primaryText : isRead ? t.success : t.textMuted }]}>{i + 1}</Text>
          </View>
          <Text style={[styles.rowTitle, { color: isRead && !isCur ? t.textMuted : t.text }]} numberOfLines={2}>
            {c.title}
          </Text>
          {isCur ? (
            <Icon name="volume-high" size={16} color={t.primary} />
          ) : isRead ? (
            <Icon name="checkmark-circle" size={16} color={t.success} />
          ) : null}
        </Pressable>
      );
    },
    [currentIndex, onClose, onSelect, t, readIds]
  );

  return (
    <SheetModal visible={visible} onClose={onClose} heightPct={0.7}>
      <View style={styles.head}>
        <Text style={[TYPO.h3, { color: t.text }]}>Chương</Text>
        <Text style={[TYPO.label, { color: t.textMuted }]}>{chapters.length} chương</Text>
      </View>
      <View style={[styles.searchWrap, { backgroundColor: t.bgSubtle }]}>
        <Icon name="search" size={16} color={t.textMuted} />
        <TextInput
          style={[styles.input, { color: t.text }]}
          placeholder="Tìm chương theo tiêu đề hoặc số…"
          placeholderTextColor={t.textMuted}
          value={q}
          onChangeText={setQ}
        />
      </View>
      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(item) => item.c.id}
        renderItem={renderItem}
        initialNumToRender={30}
        maxToRenderPerBatch={30}
        windowSize={11}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={[TYPO.caption, { color: t.textMuted, textAlign: 'center', paddingVertical: 24 }]}>Không có chương phù hợp.</Text>}
      />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: SPACING.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    marginBottom: SPACING.sm,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  // QUAN TRỌNG: flexGrow (KHÔNG phải flex:1) — flex:1 ép contentContainer đúng bằng
  // chiều cao viewport → danh sách dài không cuộn được.
  list: { flexGrow: 1, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 10,
  },
  idxWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idx: { fontSize: 12, fontWeight: '700' },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '500' },
});