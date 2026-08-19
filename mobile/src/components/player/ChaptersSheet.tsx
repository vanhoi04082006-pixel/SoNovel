import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { SheetModal } from '../ui/SheetModal';

/**
 * Mỗi chương chỉ cần id + tiêu đề cho sheet danh sách — không cần
 * ràng buộc toàn bộ ChapterRow (vì Player có thể đã strip content khi
 * truyền vào).
 */
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
};

export function ChaptersSheet({ visible, onClose, chapters, currentIndex, onSelect }: Props) {
  const t = useTheme();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim()) return chapters.map((c, i) => ({ c, i }));
    const needle = q.trim().toLowerCase();
    return chapters
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) =>
        c.title.toLowerCase().includes(needle) || String(i + 1) === needle
      );
  }, [q, chapters]);

  return (
    <SheetModal visible={visible} onClose={onClose} heightPct={0.7}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.text }]}>Chương</Text>
        <Text style={[styles.sub, { color: t.textMuted }]}>{chapters.length} chương</Text>
      </View>
      <TextInput
        style={[styles.input, { backgroundColor: t.bgSubtle, color: t.text, borderColor: t.border }]}
        placeholder="Tìm chương theo tiêu đề hoặc số…"
        placeholderTextColor={t.textMuted}
        value={q}
        onChangeText={setQ}
      />
      <View style={styles.list}>
        {filtered.map(({ c, i }) => {
          const isCur = i === currentIndex;
          return (
            <Pressable
              key={c.id}
              onPress={() => { onSelect(i); onClose(); }}
              style={[styles.row, { backgroundColor: isCur ? t.bgSubtle : 'transparent', borderColor: t.border }]}
            >
              <Text style={[styles.idx, { color: t.textMuted }]}>{i + 1}</Text>
              <Text style={[styles.rowTitle, { color: t.text }]} numberOfLines={2}>
                {c.title}
              </Text>
              {isCur ? <Text style={[styles.badge, { color: t.primary }]}>🔊</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 12 },
  input: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  list: { flex: 1, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  idx: { width: 28, fontSize: 12, fontWeight: '600' },
  rowTitle: { flex: 1, fontSize: 14 },
  badge: { fontSize: 14 },
});
