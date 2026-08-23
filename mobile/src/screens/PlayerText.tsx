import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, TYPO, RADIUS } from '../theme';
import { getNowPlaying, onTtsEvent, seekToTts, ensureChapterContent } from '../lib/tts';
import { useReaderSettings, setFontSize } from '../lib/readerSettings';
import { Icon } from '../components/ui/Icon';
import { RootStackParamList } from '../navigation/types';

const SCREEN_H = Dimensions.get('window').height;

/**
 * Màn XEM CHỮ độc lập (tách khỏi sheet của player):
 * nội dung chương theo cài đặt chữ, auto-cuộn theo giọng đọc, bấm đoạn để nhảy tới.
 */
export function PlayerTextScreen() {
  const t = useTheme();
  const rs = useReaderSettings();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [np, setNp] = useState(getNowPlaying());
  const [follow, setFollow] = useState(true);
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    const unsub = onTtsEvent('nowPlaying', () => setNp(getNowPlaying()));
    return unsub;
  }, []);

  // Đảm bảo nội dung chương đã tải
  useEffect(() => {
    ensureChapterContent(np.currentIndex).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [np.currentIndex]);

  const chapter = np.chapters[np.currentIndex] ?? null;

  const paragraphs: string[] = useMemo(() => {
    if (!chapter?.content) return [];
    return chapter.content.replace(/\r\n/g, '\n').split('\n');
  }, [chapter]);

  const offsets = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const p of paragraphs) {
      out.push(acc);
      acc += p.length + 1;
    }
    return out;
  }, [paragraphs]);

  const activeIdx = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < offsets.length; i++) {
      if (np.currentChar >= offsets[i]) idx = i;
      else break;
    }
    return idx;
  }, [offsets, np.currentChar]);

  // Chiều cao ước tính mỗi đoạn để getItemLayout hoạt động (tránh freeze khi cuộn xa)
  const PARA_HEIGHT = rs.fontSize * rs.lineHeight + 16;

  useEffect(() => {
    if (!follow || paragraphs.length === 0) return;
    const idx = Math.min(activeIdx, paragraphs.length - 1);
    try {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.4 });
    } catch (_e) {
      try {
        listRef.current?.scrollToOffset({
          offset: Math.max(0, idx * PARA_HEIGHT - SCREEN_H * 0.3),
          animated: true,
        });
      } catch (_e2) {}
    }
  }, [activeIdx, follow, paragraphs.length, PARA_HEIGHT]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* Header */}
      <View style={[styles.head, { borderBottomColor: t.border }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Quay lại">
          <Icon name="arrow-back" size={22} color={t.text} />
        </Pressable>
        <Text style={[TYPO.bodySm, { color: t.text, fontWeight: '600', flex: 1, marginHorizontal: 12 }]} numberOfLines={1}>
          {chapter ? `Chương ${np.currentIndex + 1}. ${chapter.title}` : 'Xem chữ'}
        </Text>
        {/* Cỡ chữ nhanh */}
        <Pressable
          onPress={() => setFontSize(rs.fontSize - 1)}
          style={styles.fontBtn}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Giảm cỡ chữ"
        >
          <Icon name="text-outline" size={13} color={t.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => setFontSize(rs.fontSize + 1)}
          style={styles.fontBtn}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Tăng cỡ chữ"
        >
          <Icon name="text" size={18} color={t.text} />
        </Pressable>
        <Pressable
          onPress={() => setFollow((v) => !v)}
          style={[styles.followBtn, { backgroundColor: follow ? t.primary : t.bgSubtle }]}
          accessibilityRole="button"
          accessibilityLabel="Tự cuộn theo giọng đọc"
        >
          <Icon name={follow ? 'sync' : 'sync-outline'} size={13} color={follow ? t.primaryText : t.textMuted} />
          <Text style={{ color: follow ? t.primaryText : t.textMuted, fontSize: 12, fontWeight: '600' }}>
            {follow ? 'Đang theo dõi' : 'Tự cuộn'}
          </Text>
        </Pressable>
      </View>

      {!chapter?.content ? (
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
          <Text style={[TYPO.label, { color: t.textMuted, marginTop: 8 }]}>Đang tải nội dung…</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef as any}
          data={paragraphs}
          keyExtractor={(_, i) => String(i)}
          getItemLayout={(_, index) => ({
            length: PARA_HEIGHT,
            offset: PARA_HEIGHT * index,
            index,
          })}
          initialScrollIndex={Math.min(activeIdx, Math.max(0, paragraphs.length - 1))}
          onScrollBeginDrag={() => {
            if (follow) setFollow(false);
          }}
          onScrollToIndexFailed={({ highestMeasuredFrameIndex }) => {
            try {
              listRef.current?.scrollToIndex({
                index: highestMeasuredFrameIndex,
                animated: false,
              });
            } catch (_e) {}
          }}
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16, paddingBottom: 40 }}
          renderItem={({ item, index }) => {
            if (item.trim() === '') return <View style={{ height: 8 }} />;
            const isActive = index === activeIdx;
            const paraStart = offsets[index] ?? 0;
            return (
              <Pressable
                onPress={() => seekToTts(paraStart)}
                style={[styles.paraWrap, isActive && { backgroundColor: t.primarySoft, borderRadius: RADIUS.md }]}
              >
                <View style={[styles.paraBar, { backgroundColor: isActive ? t.primary : 'transparent' }]} />
                <Text
                  style={[
                    styles.para,
                    {
                      color: isActive ? t.primarySoftText : t.text,
                      fontSize: rs.fontSize,
                      lineHeight: rs.fontSize * rs.lineHeight,
                    },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  fontBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
    flex: 1,
    paddingRight: 12,
    paddingVertical: 4,
  },
});
