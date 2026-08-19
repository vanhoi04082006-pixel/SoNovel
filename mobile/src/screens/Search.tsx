import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { SeriesCard } from '../components/ui/SeriesCard';
import { Chip } from '../components/ui/Chip';
import { listSeries, SeriesRow } from '../lib/progress';
import {
  addRecentSearch,
  getRecentSearches,
  removeRecentSearch,
} from '../lib/recentSearch';
import { consumeSearchFilter, peekSearchFilter } from '../lib/searchFilter';
import { useMiniPlayerPad } from '../lib/useMiniPlayerPad';

const COLS = 3;
const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - 16 * 2 - 8 * (COLS - 1)) / COLS;

type Sort = 'new' | 'title' | 'chapters';

export function SearchScreen() {
  const t = useTheme();
  const pad = useMiniPlayerPad(true);

  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('new');
  const [results, setResults] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // Debounce 350ms
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);

  // Load recent searches + facets on mount
  useEffect(() => {
    getRecentSearches().then(setRecents);
    listSeries({ limit: 500 }).then((rows) => {
      const gSet = new Set<string>();
      const tSet = new Set<string>();
      rows.forEach((r) => {
        (r.genres ?? []).forEach((g) => gSet.add(g));
        (r.tags ?? []).forEach((tg) => tSet.add(tg));
      });
      setGenres(Array.from(gSet).sort());
      setTags(Array.from(tSet).sort());
    }).catch(() => {});
  }, []);

  // Consume pending filter from Home chip tap
  useFocusEffect(useCallback(() => {
    const peeked = peekSearchFilter();
    if (peeked.genre || peeked.tag) {
      const c = consumeSearchFilter();
      if (c.genre) setGenre(c.genre);
      if (c.tag) setTag(c.tag);
    }
  }, []));

  const fetchResults = useCallback(async (reset: boolean) => {
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const data = await listSeries({
        limit: 24,
        offset: newOffset,
        orderBy: sort === 'title' ? 'title' : sort === 'chapters' ? 'word_count' : 'updated_at',
        ascending: sort === 'title',
        search: debounced || undefined,
        genre: genre ?? undefined,
        tag: tag ?? undefined,
      });
      setResults(reset ? data : [...results, ...data]);
      setOffset(newOffset + data.length);
      setTotal((prev) => (reset ? data.length : prev + data.length));
    } catch (_e) {
    } finally {
      setLoading(false);
    }
  }, [debounced, genre, tag, sort, offset, results]);

  // Re-fetch when filters change
  useEffect(() => {
    fetchResults(true);
  }, [debounced, genre, tag, sort]);

  // Save recent search when query finalized
  useEffect(() => {
    if (debounced && results.length > 0) {
      addRecentSearch(debounced).then(() => getRecentSearches().then(setRecents));
    }
  }, [debounced, results.length]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={[styles.head, { borderBottomColor: t.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: t.bgSubtle, color: t.text, borderColor: t.border }]}
          placeholder="Tìm theo tên truyện, tác giả…"
          placeholderTextColor={t.textMuted}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
        />
      </View>

      {/* Recents */}
      {!debounced && recents.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Tìm kiếm gần đây</Text>
            <Pressable onPress={() => { setRecents([]); getRecentSearches().then(async () => { /* keep storage */ }); }}>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>Xóa</Text>
            </Pressable>
          </View>
          <View style={styles.chipsRow}>
            {recents.map((r) => (
              <Chip
                key={r}
                label={r}
                onPress={() => setQ(r)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Facets */}
      {(genres.length > 0 || tags.length > 0) ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Thể loại</Text>
          <View style={styles.chipsRow}>
            {genres.slice(0, 16).map((g) => (
              <Chip key={g} label={g} selected={genre === g} onPress={() => setGenre(genre === g ? null : g)} />
            ))}
          </View>
          {tags.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: t.text, marginTop: 12 }]}>Tag</Text>
              <View style={styles.chipsRow}>
                {tags.slice(0, 16).map((tg) => (
                  <Chip key={tg} label={tg} prefix="#" selected={tag === tg} onPress={() => setTag(tag === tg ? null : tg)} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Sort */}
      <View style={styles.sortRow}>
        {(['new', 'title', 'chapters'] as Sort[]).map((s) => (
          <Chip
            key={s}
            label={s === 'new' ? 'Mới' : s === 'title' ? 'Tiêu đề' : 'Nhiều chương'}
            selected={sort === s}
            onPress={() => setSort(s)}
          />
        ))}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: pad + 16, gap: 8 }}
        columnWrapperStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <View style={{ width: CARD_W }}>
            <SeriesCard series={item} />
          </View>
        )}
        onEndReached={() => { if (results.length >= 24 && !loading) fetchResults(false); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loading ? <ActivityIndicator color={t.primary} style={{ padding: 12 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={{ color: t.textMuted, fontSize: 13, paddingVertical: 16 }}>Không tìm thấy truyện phù hợp.</Text> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    fontSize: 14,
  },
  section: { paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
});
