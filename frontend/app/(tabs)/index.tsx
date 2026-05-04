import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme, muscleColors } from "../../src/theme";
import { api, ProfileData, Workout } from "../../src/api";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [p, s, w] = await Promise.all([
        api.getProfile(),
        api.statsOverview(),
        api.listWorkouts(),
      ]);
      setProfile(p);
      setStats(s);
      setRecent(w.slice(0, 3));
    } catch (e) {
      console.log("Home load error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  useEffect(() => {
    load();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "GOOD MORNING";
    if (h < 18) return "GOOD AFTERNOON";
    return "GOOD EVENING";
  })();

  const totalVol = stats?.volume_last_30d || 0;
  const totalSets = stats?.sets_last_30d || 0;
  const streak = stats?.streak_days || 0;
  const totalWorkouts = stats?.total_workouts || 0;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={theme.colors.primary}
        />
      }
      testID="home-scroll"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>{greeting}</Text>
          <Text style={styles.name} testID="home-name">
            {profile?.name?.toUpperCase() || "ATHLETE"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.historyBtn}
          activeOpacity={0.7}
          onPress={() => router.push("/history")}
          testID="open-history-btn"
        >
          <Ionicons name="time-outline" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Start workout hero card */}
      <TouchableOpacity
        style={styles.heroCard}
        activeOpacity={0.85}
        onPress={() => router.push("/log")}
        testID="start-workout-btn"
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroKicker}>START NOW</Text>
          <Text style={styles.heroTitle}>LOG TODAY&apos;S WORKOUT</Text>
          <Text style={styles.heroSub}>Type, speak, or log manually — AI will structure it.</Text>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="flash" size={36} color={theme.colors.textPrimary} />
        </View>
      </TouchableOpacity>

      {/* Stats grid */}
      <Text style={styles.sectionTitle}>SNAPSHOT · 30 DAYS</Text>
      <View style={styles.statsGrid}>
        <StatCard label="WORKOUTS" value={String(totalWorkouts)} testID="stat-workouts" />
        <StatCard label="STREAK" value={`${streak}d`} testID="stat-streak" />
        <StatCard label="SETS" value={String(totalSets)} testID="stat-sets" />
        <StatCard
          label={`VOLUME (${profile?.units || "lbs"})`}
          value={totalVol >= 10000 ? `${(totalVol / 1000).toFixed(1)}k` : String(Math.round(totalVol))}
          testID="stat-volume"
        />
      </View>

      {/* Volume by muscle */}
      {stats?.volume_by_muscle && Object.keys(stats.volume_by_muscle).length > 0 && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>VOLUME BY MUSCLE</Text>
          <MuscleBars data={stats.volume_by_muscle} />
        </View>
      )}

      {/* Top PRs */}
      {stats?.top_prs && stats.top_prs.length > 0 && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>TOP ESTIMATED 1RM</Text>
          {stats.top_prs.map((pr: any) => (
            <View key={pr.exercise} style={styles.prRow}>
              <Text style={styles.prName}>{pr.exercise}</Text>
              <Text style={styles.prValue}>
                {pr.estimated_1rm}
                <Text style={styles.prUnit}> {profile?.units || "lbs"}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Recent */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
        <TouchableOpacity onPress={() => router.push("/history")} testID="see-all-history">
          <Text style={styles.link}>SEE ALL</Text>
        </TouchableOpacity>
      </View>
      {recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="barbell-outline" size={36} color={theme.colors.textTertiary} />
          <Text style={styles.emptyText}>No sessions yet. Log your first workout.</Text>
        </View>
      ) : (
        recent.map((w) => <RecentCard key={w.id} workout={w} />)
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.statCard} testID={testID}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MuscleBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <View>
      {entries.map(([muscle, vol]) => {
        const pct = (vol / max) * 100;
        const color = muscleColors[muscle] || muscleColors.other;
        return (
          <View key={muscle} style={styles.barRow}>
            <Text style={styles.barLabel}>{muscle.toUpperCase()}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.barValue}>{Math.round(vol)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function RecentCard({ workout }: { workout: Workout }) {
  const router = useRouter();
  const d = new Date(workout.date);
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const exCount = workout.exercises.length;
  const setCount = workout.exercises.reduce((s, e) => s + e.sets.length, 0);
  const volume = workout.exercises.reduce(
    (sum, e) => sum + e.sets.reduce((s, st) => s + (st.weight || 0) * (st.reps || 0), 0),
    0
  );
  return (
    <TouchableOpacity
      style={styles.recentCard}
      activeOpacity={0.7}
      onPress={() => router.push("/history")}
      testID={`recent-card-${workout.id}`}
    >
      <View style={styles.recentLeft}>
        <Text style={styles.recentDate}>{dateStr.toUpperCase()}</Text>
        <Text style={styles.recentTitle}>{workout.title || "TRAINING SESSION"}</Text>
        <View style={styles.recentMeta}>
          <Text style={styles.recentMetaText}>
            {exCount} exercise{exCount !== 1 ? "s" : ""} · {setCount} sets
          </Text>
        </View>
      </View>
      <View style={styles.recentRight}>
        <Text style={styles.recentVolume}>{Math.round(volume)}</Text>
        <Text style={styles.recentVolumeLabel}>VOL</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  hello: { color: theme.colors.textTertiary, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  name: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 4,
  },
  historyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.card,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  heroContent: { flex: 1, paddingRight: 12 },
  heroKicker: {
    color: "#fff",
    opacity: 0.85,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  heroSub: { color: "#fff", opacity: 0.85, fontSize: 13, marginTop: 8 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "800",
    marginBottom: 10,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 10,
  },
  link: {
    color: theme.colors.primary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    width: "48.5%",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 10,
  },
  statValue: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statLabel: {
    color: theme.colors.textTertiary,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginTop: 4,
  },
  cardBlock: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "800",
    marginBottom: 12,
  },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  barLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "700",
    width: 72,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 4,
    overflow: "hidden",
    marginHorizontal: 8,
  },
  barFill: { height: "100%", borderRadius: 4 },
  barValue: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    width: 50,
    textAlign: "right",
  },
  prRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  prName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" },
  prValue: { color: theme.colors.primary, fontSize: 18, fontWeight: "900" },
  prUnit: { color: theme.colors.textTertiary, fontSize: 12, fontWeight: "600" },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: theme.colors.textTertiary,
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
  recentCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  recentLeft: { flex: 1 },
  recentDate: {
    color: theme.colors.primary,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "800",
  },
  recentTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  recentMeta: { marginTop: 6 },
  recentMetaText: { color: theme.colors.textTertiary, fontSize: 12 },
  recentRight: { alignItems: "flex-end" },
  recentVolume: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "900" },
  recentVolumeLabel: {
    color: theme.colors.textTertiary,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
});
