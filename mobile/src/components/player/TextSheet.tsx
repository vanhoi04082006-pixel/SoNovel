import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import { SheetModal } from '../ui/SheetModal';

type ChapterText = {
  title?: string;
  content: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  chapter: ChapterText | null;
  currentIndex: number;
  charIndex: number;
};

const SCREEN_H = Dimensions.get('window').height;

/**
 * Sheet "Xem chữ" — 88% chiều cao màn hình, tách đoạn theo \n,
 * highlight đoạn đang đọc (tính từ charIndex), toggle "Theo dõi" auto-scroll.
 */
export function TextSheet({ visible, onClose, chapter, currentIndex, charIndex }: Props) {
  const t = useTheme();
  const [follow, setFollow] = useState(true);
  const listRef = useRef<FlatList<(Paragraph | null)>>(null);

  const paragraphs: (string | null)[] = useMemo(() => {
    if (!chapter?.content) return [];
    return chapter.content
      .replace('\r\n', '\n')
      .split('\n')
      .map((p) => p.trim());
  }, [chapter]);

  // Tính offset ký tự đầu mỗi đoạn
  const offsets = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const p of paragraphs) {
      out.push(acc);
      if (p != null) acc += p.length + 1; // +1 for \n
    }
    return out;
  }, [paragraphs]);

  // Tìm đoạn chứa charIndex hiện tại
  const activeIdx = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < offsets.length; i++) {
      if (charIndex >= offsets[i]) idx = i;
      else break;
    }
    return idx;
  }, [offsets, charIndex]);

  useEffect(() => {
    if (!visible || !follow) return;
    try {
      listRef.current?.scrollToIndex({
        index: activeIdx,
        animated: true,
        viewPosition: 0.4,
      });
    } catch (_e) {
      // ignore — out of view momentarily
    }
  }, [activeIdx, visible, follow]);

  return (
    <SheetModal visible={visible} onClose={onClose} heightPct={0.88}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {chapter ? `Chương ${currentIndex + 1}. ${chapter.title}` : 'Xem chữ'}
        </Text>
        <Pressable
          onPress={() => setFollow((v) => !v)}
          style={[styles.followBtn, { backgroundColor: follow ? t.primary : t.bgSubtle, borderColor: t.border }]}
        >
          <Text style={{ color: follow ? t.primaryText : t.textMuted, fontSize: 12 }}>
            {follow ? '↓ Theo dõi' : 'Theo dõi'}
          </Text>
        </Pressable>
      </View>
      <FlatList
        ref={listRef as any}
        data={paragraphs as any}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => {
          if (item == null || item === '') return <View style={{ height: 8 }} />;
          const isActive = index === activeIdx;
          return (
            <Text
              style={[
                styles.para,
                { color: isActive ? t.primary : t.text },
                isActive && { backgroundColor: t.bgSubtle, borderRadius: 4 },
              ]}
            >
              {item}
            </Text>
          );
        }}
        onScrollToIndexFailed={() => {}}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: '700', flex: 1 },
  followBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  para: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

type Paragraph = string | null;
