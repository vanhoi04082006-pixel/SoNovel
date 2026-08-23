import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, TYPO, RADIUS } from '../theme';
import { getNowPlaying, onTtsEvent, playChapterTts } from '../lib/tts';
import { useReadMarkers } from '../lib/readMarkers';
import { Icon } from '../components/ui/Icon';
import { RootStackParamList } from '../navigation/types';

/**
 * Màn DANH SÁCH CHƯƠNG độc lập (tách khỏi sheet của player).
 * Đọc trực tiếp trạng thái TTS toàn cục — bấm chương là phát và quay lại player.
 */
export function PlayerChaptersScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [np, setNp] = useState(getNowPlaying());
  const [q, setQ] = useState('');

  useEffect(() => {
    const unsub = onTtsEvent('nowPlaying', () => setNp(getNowPlaying()));
    return unsub;
  }, []);

  const readSet = useReadMarkers(np.seriesId);

  const filtered = useMemo(() => {
    const list = np.chapters.map((c, i) => ({ c, i }));
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter(({ c, i }) =>
      c.title.toLowerCase().includes(needle) || String(i + 1) === needle
    );
  }, [q, np.chapters]);

  const onSelect = useCallback((idx: number) => {
    playChapterTts(idx, 0);
    nav.goBack();
  }, [nav]);

  const renderItem = useCallback(
    ({ item }: { item: { c: { id: string; title: string }; i: number } }) => {
      const { c, i } = item;
      const isCur = i === np.currentIndex;
      const isRead = !!readSet?.has(c.id);
      return (
        <Pressable
          onPress={() => onSelect(i)}
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
    [np.currentIndex, readSet, onSelect, t]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* Header */}
      <View style={[styles.head, { borderBottomColor: t.border }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Quay lại">
          <Icon name="arrow-back" size={22} color={t.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[TYPO.h3, { color: t.text }]} numberOfLines={1}>Danh sách chương</Text>
          {!!np.seriesTitle && (
            <Text style={[TYPO.caption, { color: t.textMuted }]} numberOfLines={1}>{np.seriesTitle} · {np.chapters.length} chương</Text>
          )}
        </View>
      </View>

      {/* Tìm chương */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
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
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.c.id}
        renderItem={renderItem}
        initialNumToRender={30}
        maxToRenderPerBatch={30}
        windowSize={11}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          <Text style={[TYPO.caption, { color: t.textMuted, textAlign: 'center', paddingVertical: 24 }]}>
            Không có chương phù hợp.
          </Text>
        }
      />
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
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
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
