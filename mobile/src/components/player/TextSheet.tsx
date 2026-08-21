import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme, TYPO, RADIUS } from '../../theme';
import { SheetModal } from '../ui/SheetModal';
import { Icon } from '../ui/Icon';

type ChapterText = {
  title?: string;
  content?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  chapter: ChapterText | null;
  currentIndex: number;
  charIndex: number;
};

const SCREEN_H = Dimensions.get('window').height;

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

  const offsets = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const p of paragraphs) {
      out.push(acc);
      if (p != null) acc += p.length + 1;
    }
    return out;
  }, [paragraphs]);

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
    }
  }, [activeIdx, visible, follow]);

  return (
    <SheetModal visible={visible} onClose={onClose} heightPct={0.88}>
      <View style={styles.head}>
        <View style={styles.titleWrap}>
          <Text style={[TYPO.title, { color: t.text }]} numberOfLines={1}>
            {chapter ? `Chương ${currentIndex + 1}. ${chapter.title}` : 'Xem chữ'}
          </Text>
        </View>
        <Pressable
          onPress={() => setFollow((v) => !v)}
          style={[styles.followBtn, { backgroundColor: follow ? t.primary : t.bgSubtle }]}
        >
          <Icon name={follow ? 'arrow-down' : 'arrow-down-outline'} size={13} color={follow ? t.primaryText : t.textMuted} />
          <Text style={{ color: follow ? t.primaryText : t.textMuted, fontSize: 12, fontWeight: '600' }}>
            {follow ? 'Theo dõi' : 'Tự cuộn'}
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
            <View
              style={[
                styles.paraWrap,
                isActive && { backgroundColor: t.primarySoft, borderRadius: RADIUS.md },
              ]}
            >
              <View style={[styles.paraBar, { backgroundColor: isActive ? t.primary : 'transparent' }]} />
              <Text
                style={[
                  styles.para,
                  { color: isActive ? t.primarySoftText : t.text },
                ]}
              >
                {item}
              </Text>
            </View>
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
  titleWrap: { flex: 1 },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  paraWrap: {
    flexDirection: 'row',
    marginVertical: 1,
  },
  paraBar: {
    width: 3,
    borderRadius: 2,
    marginLeft: 6,
    marginRight: 8,
    marginTop: 5,
    marginBottom: 5,
  },
  para: {
    fontSize: 15,
    lineHeight: 24,
    paddingVertical: 4,
    paddingRight: 12,
    flex: 1,
  },
});

type Paragraph = string | null;