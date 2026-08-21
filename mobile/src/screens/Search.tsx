import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, TYPO, SPACING, RADIUS } from '../theme';
import { SeriesCard } from '../components/ui/SeriesCard';
import { Chip } from '../components/ui/Chip';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { SheetModal } from '../components/ui/SheetModal';
import { listSeries, SeriesRow } from '../lib/progress';
import { addRecentSearch, getRecentSearches, removeRecentSearch, clearRecentSearches } from '../lib/recentSearch';
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
  const [error, setError] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);

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
    setError(false);
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
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [debounced, genre, tag, sort, offset, results]);

  useEffect(() => {
    fetchResults(true);
  }, [debounced, genre, tag, sort]);

  useEffect(() => {
    if (debounced && results.length > 0) {
      addRecentSearch(debounced).then(() => getRecentSearches().then(setRecents));
    }
  }, [debounced, results.length]);

  const removeRecent = async (r: string) => {
    await removeRecentSearch(r);
    getRecentSearches().then(setRecents);
  };

  const clearAll = async () => {
    await clearRecentSearches();
    setRecents([]);
  };

  const hasFilter = genre || tag || debounced;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* Search bar */}
      <View style={[styles.head, { borderBottomColor: t.border }]}>
        <View style={[styles.inputWrap, { backgroundColor: t.bgSubtle, borderColor: hasFilter ? t.primary : 'transparent' }]}>
          <Icon name="search" size={18} color={t.textMuted} />
          <TextInput
            style={[styles.input, { color: t.text }]}
            placeholder="Tìm theo tên truyện, tác giả…"
            placeholderTextColor={t.textMuted}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
            autoCorrect={false}
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Icon name="close-circle" size={18} color={t.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Active filter chips */}
      {(genre || tag) ? (
        <View style={styles.activeRow}>
          {genre ? (
            <Chip label={genre} icon="pricetag" selected onPress={() => setGenre(null)} />
          ) : null}
          {tag ? (
            <Chip label={tag} prefix="#" selected onPress={() => setTag(null)} />
          ) : null}
        </View>
      ) : null}

      {/* Recents */}
      {!debounced && recents.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={[TYPO.title, { color: t.text }]}>Tìm kiếm gần đây</Text>
            <Pressable onPress={clearAll} hitSlop={8}>
              <Text style={[TYPO.label, { color: t.textMuted }]}>Xóa hết</Text>
            </Pressable>
          </View>
          <View style={styles.chipsRow}>
            {recents.map((r) => (
              <Pressable key={r} onPress={() => setQ(r)}>
                <View style={[styles.recentChip, { backgroundColor: t.bgSubtle, borderColor: t.border }]}>
                  <Icon name="time-outline" size={13} color={t.textMuted} />
                  <Text style={[TYPO.bodySm, { color: t.text }]} numberOfLines={1}>{r}</Text>
                  <Pressable onPress={() => removeRecent(r)} hitSlop={8}>
                    <Icon name="close" size={14} color={t.textMuted} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Sort + filter */}
      <View style={styles.sortRow}>
        {(['new', 'title', 'chapters'] as Sort[]).map((s) => (
          <Chip
            key={s}
            label={s === 'new' ? 'Mới' : s === 'title' ? 'Tiêu đề' : 'Nhiều chương'}
            selected={sort === s}
            variant={sort === s ? 'filled' : 'soft'}
            onPress={() => setSort(s)}
          />
        ))}
        <Pressable
          onPress={() => setFilterOpen(true)}
          hitSlop={8}
          style={[styles.filterBtn, { backgroundColor: t.bgSubtle, borderColor: (genre || tag) ? t.primary : t.border }]}
        >
          <Icon name="options-outline" size={18} color={(genre || tag) ? t.primary : t.textMuted} />
          {(genre || tag) ? <View style={[styles.filterDot, { backgroundColor: t.primary }]} /> : null}
        </Pressable>
      </View>

      {/* Filter sheet */}
      <SheetModal visible={filterOpen} onClose={() => setFilterOpen(false)} heightPct={0.7}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={[TYPO.title, { color: t.text }]}>Bộ lọc</Text>
          {genres.length > 0 ? (
            <>
              <Text style={[TYPO.label, { color: t.textMuted, marginTop: SPACING.md, marginBottom: 8 }]}>Thể loại</Text>
              <View style={styles.chipsRow}>
                {genres.map((g) => (
                  <Chip key={g} label={g} icon="pricetag-outline" iconSize={12} selected={genre === g} onPress={() => setGenre(genre === g ? null : g)} />
                ))}
              </View>
            </>
          ) : null}
          {tags.length > 0 ? (
            <>
              <Text style={[TYPO.label, { color: t.textMuted, marginTop: SPACING.md, marginBottom: 8 }]}>Tag</Text>
              <View style={styles.chipsRow}>
                {tags.map((tg) => (
                  <Chip key={tg} label={tg} prefix="#" selected={tag === tg} onPress={() => setTag(tag === tg ? null : tg)} />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      </SheetModal>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: pad + 16, gap: 8 }}
        columnWrapperStyle={{ gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={loading && results.length > 0}
            onRefresh={() => fetchResults(true)}
            colors={[t.primary]}
            tintColor={t.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={{ width: CARD_W }}>
            <SeriesCard series={item} />
          </View>
        )}
        onEndReached={() => { if (results.length >= 24 && !loading) fetchResults(false); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loading ? <ActivityIndicator color={t.primary} style={{ padding: 12 }} /> : null}
        ListEmptyComponent={
          !loading ? (
            error ? (
              <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                <Icon name="cloud-offline-outline" size={40} color={t.textMuted} />
                <Text style={[TYPO.bodySm, { color: t.textMuted }]}>Không tải được kết quả tìm kiếm.</Text>
                <Pressable onPress={() => fetchResults(true)} style={[styles.retryBtn, { backgroundColor: t.primary }]}>
                  <Text style={{ color: t.primaryText, fontSize: 13, fontWeight: '600' }}>Thử lại</Text>
                </Pressable>
              </View>
            ) : debounced || genre || tag ? (
              <EmptyState icon="search-outline" title="Không tìm thấy truyện" message="Thử từ khóa khác hoặc bỏ bớt bộ lọc." />
            ) : null
          ) : null
        }
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  activeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  section: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    maxWidth: 220,
  },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterBtn: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  filterDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
});