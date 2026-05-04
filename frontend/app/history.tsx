import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme, muscleColors } from "../src/theme";
import { api, Workout } from "../src/api";

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    try {
      const w = await api.listWorkouts();
      setWorkouts(w);
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

  const remove = (id: string) => {
    Alert.alert("Delete workout?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.deleteWorkout(id);
          setWorkouts((w) => w.filter((x) => x.id !== id));
        },
      },
    ]);
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
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {workouts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={48} color={theme.colors.textTertiary} />
          <Text style={styles.emptyText}>No workouts logged yet.</Text>
        </View>
      ) : (
        workouts.map((w) => {
          const isOpen = expanded === w.id;
          const d = new Date(w.date);
          const dateStr = d.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          const setCount = w.exercises.reduce((s, e) => s + e.sets.length, 0);
          const vol = w.exercises.reduce(
            (s, e) => s + e.sets.reduce((ss, st) => ss + (st.weight || 0) * (st.reps || 0), 0),
            0
          );
          return (
            <View key={w.id} style={styles.card} testID={`history-card-${w.id}`}>
              <TouchableOpacity
                style={styles.cardHeader}
                activeOpacity={0.7}
                onPress={() => setExpanded(isOpen ? null : w.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardDate}>{dateStr.toUpperCase()}</Text>
                  <Text style={styles.cardTitle}>
                    {w.title || "TRAINING SESSION"}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {w.exercises.length} exercise{w.exercises.length !== 1 ? "s" : ""} · {setCount} sets ·{" "}
                    {Math.round(vol)} vol
                  </Text>
                </View>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={22}
                  color={theme.colors.textTertiary}
                />
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.details}>
                  {w.exercises.map((ex, i) => {
                    const color = muscleColors[ex.muscle_group || "other"] || muscleColors.other;
                    return (
                      <View key={i} style={styles.exRow}>
                        <View style={[styles.exDot, { backgroundColor: color }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.exName}>{ex.name}</Text>
                          <Text style={styles.exSets}>
                            {ex.sets
                              .map((s) => `${s.weight}×${s.reps}`)
                              .join("  ·  ")}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => remove(w.id)}
                    testID={`delete-${w.id}`}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.deleteBtnText}>DELETE</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: theme.colors.textTertiary, fontSize: 14, marginTop: 12 },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    marginBottom: 10,
  },
  cardHeader: { padding: 16, flexDirection: "row", alignItems: "center" },
  cardDate: {
    color: theme.colors.primary,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "800",
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  cardMeta: { color: theme.colors.textTertiary, fontSize: 12, marginTop: 4 },
  details: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 16,
  },
  exRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  exDot: { width: 10, height: 10, borderRadius: 5 },
  exName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" },
  exSets: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deleteBtnText: {
    color: theme.colors.primary,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
});
