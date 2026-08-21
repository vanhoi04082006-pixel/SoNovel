import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, TYPO, RADIUS, SPACING } from '../theme';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Icon } from '../components/ui/Icon';
import { LoginCTA } from '../components/ui/LoginCTA';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../lib/session';
import { statsReading, statsStreak, statsAchievements, statsChallenge } from '../lib/progress';
import { RootStackParamList } from '../navigation/types';
import { useMiniPlayerPad } from '../lib/useMiniPlayerPad';

function fmtMin(sec: number): string {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return `${m} phút`;
  return `${Math.floor(m / 60)}g${m % 60 ? ' ' + (m % 60) + 'p' : ''}`;
}

export function StatsScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const pad = useMiniPlayerPad(true);
  const [reading, setReading] = useState<any>(null);
  const [streak, setStreak] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ unlocked: 0, total: 0, progress: 0 });
  const [challenges, setChallenges] = useState<any[]>([]);
  const [challengeSummary, setChallengeSummary] = useState<any>({ unlocked: 0, total: 0, daysLeft: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!auth.session) { setLoading(false); return; }
    setLoading(true);
    try {
      const [r, s, a, ch] = await Promise.all([
        statsReading(), statsStreak(), statsAchievements(), statsChallenge(),
      ]);
      setReading(r.stats);
      setStreak(s.stats);
      setAchievements(a.achievements ?? []);
      setSummary(a.summary ?? { unlocked: 0, total: 0, progress: 0 });
      setChallenges(ch.challenges ?? []);
      setChallengeSummary(ch.summary ?? { unlocked: 0, total: 0, daysLeft: 0 });
    } catch (_e) {
    } finally {
      setLoading(false);
    }
  }, [auth.session]);

  useEffect(() => { load(); }, [load]);

  if (!auth.session) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Thống kê" />
        <LoginCTA
          title="Đăng nhập để xem thống kê"
          message="Theo dõi thời gian nghe, chuỗi ngày và thành tích của bạn."
          onCta={() => nav.navigate('Login')}
        />
      </Screen>
    );
  }

  const stats = reading ?? { totalListenMin: 0, chaptersCompleted: 0, seriesFollowing: 0, favoritesCount: 0, historyCount: 0, bookmarksCount: 0 };

  return (
    <Screen edges={['top']} scroll refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[t.primary]} tintColor={t.primary} />}>
      <ScreenHeader title="Thống kê" />

      {/* Stat cards */}
      <View style={styles.cards}>
        <StatCard t={t} icon="time-outline" label="Thời gian nghe" value={fmtMin(stats.totalListenSec)} />
        <StatCard t={t} icon="checkmark-done-outline" label="Chương xong" value={String(stats.chaptersCompleted ?? 0)} />
        <StatCard t={t} icon="book-outline" label="Đang theo dõi" value={String(stats.seriesFollowing ?? 0)} />
        <StatCard t={t} icon="heart-outline" label="Yêu thích" value={String(stats.favoritesCount ?? 0)} />
      </View>

      {/* Streak */}
      {streak ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[TYPO.title, { color: t.text }]}>🔥 Chuỗi ngày nghe</Text>
          <View style={styles.streakRow}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[TYPO.h2, { color: t.primary }]}>{streak.currentStreak ?? 0}</Text>
              <Text style={[TYPO.caption, { color: t.textMuted }]}>Hiện tại</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[TYPO.h2, { color: t.text }]}>{streak.longestStreak ?? 0}</Text>
              <Text style={[TYPO.caption, { color: t.textMuted }]}>Dài nhất</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[TYPO.h2, { color: t.text }]}>{streak.totalDays ?? 0}</Text>
              <Text style={[TYPO.caption, { color: t.textMuted }]}>Tổng ngày</Text>
            </View>
          </View>
          <Heatmap t={t} days={(streak.heatmap ?? []) as { date: string; listened: boolean }[]} />
        </View>
      ) : null}

      {/* Achievements */}
      {achievements.length > 0 ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[TYPO.title, { color: t.text }]}>🏆 Thành tích</Text>
          <Text style={[TYPO.caption, { color: t.textMuted }]}>
            Đã mở {summary.unlocked}/{summary.total} huy hiệu · {summary.progress}%
          </Text>
          <View style={styles.achGrid}>
            {achievements.map((a: any) => {
              const unlocked = !!a.unlocked;
              return (
                <View key={a.id} style={[styles.ach, { backgroundColor: unlocked ? t.primarySoft : t.bgSubtle, borderColor: unlocked ? t.primary : t.border }]}>
                  <Text style={{ fontSize: 18, opacity: unlocked ? 1 : 0.4 }}>{a.icon}</Text>
                  <Text numberOfLines={1} style={[TYPO.caption, { color: unlocked ? t.primarySoftText : t.textMuted, fontWeight: '600' }]}>{a.title}</Text>
                  <View style={[styles.progressTrack, { backgroundColor: t.border }]}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, a.progress / Math.max(1, a.goal) * 100)}%`, backgroundColor: unlocked ? t.success : t.primary }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Weekly challenge */}
      {challenges.length > 0 ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[TYPO.title, { color: t.text }]}>🎯 Thử thách tuần</Text>
          <Text style={[TYPO.caption, { color: t.textMuted }]}>
            Đã hoàn thành {challengeSummary.unlocked}/{challengeSummary.total} · còn {challengeSummary.daysLeft ?? 0} ngày
          </Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {challenges.map((c: any) => {
              const unlocked = !!c.unlocked;
              const pct = Math.min(100, (c.progress / Math.max(1, c.goal)) * 100);
              return (
                <View key={c.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[TYPO.bodySm, { color: t.text }]}>{c.icon} {c.title}</Text>
                    <Text style={[TYPO.caption, { color: unlocked ? t.success : t.textMuted }]}>
                      {unlocked ? '✓ Hoàn thành' : `${c.progress}/${c.goal} ${c.unit}`}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: t.border, marginTop: 4 }]}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: unlocked ? t.success : t.primary }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ height: pad }} />
    </Screen>
  );
}

function StatCard({ t, icon, label, value }: { t: ReturnType<typeof useTheme>; icon: any; label: string; value: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Icon name={icon} size={18} color={t.primary} />
      <Text style={[TYPO.title, { color: t.text }]}>{value}</Text>
      <Text style={[TYPO.caption, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

function Heatmap({ t, days }: { t: ReturnType<typeof useTheme>; days: { date: string; listened: boolean }[] }) {
  return (
    <View style={styles.heatmap}>
      {days.map((d) => (
        <View
          key={d.date}
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            backgroundColor: d.listened ? t.primary : t.bgSubtle,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  statCard: {
    width: '48%',
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 4,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    gap: 6,
  },
  streakRow: { flexDirection: 'row', paddingVertical: 8 },
  heatmap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 4,
    maxWidth: 220,
  },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  ach: {
    width: '48%',
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 2 },
});
