import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { theme } from "../../src/theme";
import { api } from "../../src/api";

type Insight = { title: string; detail: string; severity?: "info" | "warn" | "good" };

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<any>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    try {
      const [s, ins] = await Promise.all([api.statsOverview(), api.getInsights()]);
      setStats(s);
      setInsights(ins.insights || []);
      setGeneratedAt(ins.generated_at || null);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
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

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.generateInsights();
      setInsights(res.insights || []);
      setGeneratedAt(new Date().toISOString());
    } catch (e: any) {
      Alert.alert("AI error", String(e?.message || e));
    } finally {
      setGenerating(false);
    }
  };

  const width = Dimensions.get("window").width - 32 - 32;
  const trend = stats?.weekly_volume_trend || [];
  const chartData = {
    labels: trend.slice(-6).map((t: any) => {
      const d = new Date(t.week);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }),
    datasets: [
      {
        data: trend.length > 0 ? trend.slice(-6).map((t: any) => t.volume) : [0],
        color: () => theme.colors.primary,
        strokeWidth: 3,
      },
    ],
  };

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
    >
      <Text style={styles.h1}>INSIGHTS</Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.generateBtn, generating && { opacity: 0.6 }]}
          onPress={generate}
          disabled={generating}
          activeOpacity={0.8}
          testID="generate-insights-btn"
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.generateBtnText}>ANALYZE WITH AI</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      {generatedAt && (
        <Text style={styles.generatedAt}>
          Updated {new Date(generatedAt).toLocaleString()}
        </Text>
      )}

      {/* Chart */}
      {trend.length > 0 && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>WEEKLY VOLUME TREND</Text>
          <LineChart
            data={chartData}
            width={width}
            height={180}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLines={false}
            withHorizontalLabels={true}
            chartConfig={{
              backgroundGradientFrom: theme.colors.surface,
              backgroundGradientTo: theme.colors.surface,
              decimalPlaces: 0,
              color: () => theme.colors.primary,
              labelColor: () => theme.colors.textTertiary,
              propsForDots: {
                r: "4",
                strokeWidth: "2",
                stroke: theme.colors.primary,
              },
              fillShadowGradient: theme.colors.primary,
              fillShadowGradientOpacity: 0.25,
            }}
            bezier
            style={{ marginLeft: -12 }}
          />
        </View>
      )}

      {/* AI Insights */}
      <Text style={styles.sectionTitle}>AI PATTERNS</Text>
      {insights.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="analytics-outline" size={36} color={theme.colors.textTertiary} />
          <Text style={styles.emptyText}>
            Tap &ldquo;Analyze with AI&rdquo; to uncover patterns the manual eye misses.
          </Text>
        </View>
      ) : (
        insights.map((ins, i) => <InsightCard key={i} insight={ins} />)
      )}

      {/* Volume breakdown */}
      {stats?.volume_by_muscle && Object.keys(stats.volume_by_muscle).length > 0 && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>30-DAY VOLUME BY MUSCLE</Text>
          {Object.entries(stats.volume_by_muscle)
            .sort(([, a]: any, [, b]: any) => b - a)
            .map(([m, v]: any) => (
              <View key={m} style={styles.row2}>
                <Text style={styles.muscleName}>{m.toUpperCase()}</Text>
                <Text style={styles.muscleVal}>{Math.round(v)}</Text>
              </View>
            ))}
        </View>
      )}
    </ScrollView>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const sev = insight.severity || "info";
  const color =
    sev === "good" ? theme.colors.success : sev === "warn" ? theme.colors.warning : theme.colors.primary;
  const icon =
    sev === "good"
      ? "trending-up"
      : sev === "warn"
      ? "warning"
      : "bulb";
  return (
    <View style={[styles.insightCard, { borderLeftColor: color }]}>
      <View style={styles.insightHeader}>
        <View style={[styles.insightIcon, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <Text style={styles.insightTitle}>{insight.title}</Text>
      </View>
      <Text style={styles.insightDetail}>{insight.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 16,
  },
  row: { flexDirection: "row", marginBottom: 8 },
  generateBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  generateBtnText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  generatedAt: { color: theme.colors.textTertiary, fontSize: 11, marginBottom: 12, marginTop: 4 },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 10,
  },
  cardBlock: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 16,
    marginTop: 10,
  },
  cardTitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "800",
    marginBottom: 10,
  },
  row2: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  muscleName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" },
  muscleVal: { color: theme.colors.primary, fontSize: 16, fontWeight: "800" },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 28,
    alignItems: "center",
  },
  emptyText: {
    color: theme.colors.textTertiary,
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  insightCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
    borderRadius: theme.radius.card,
    padding: 14,
    marginBottom: 10,
  },
  insightHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  insightDetail: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },
});
