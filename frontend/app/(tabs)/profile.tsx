import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../src/theme";
import { api, ProfileData } from "../../src/api";

const GOALS = ["strength", "hypertrophy", "weight_loss", "endurance"];
const EXPERIENCE = ["beginner", "intermediate", "advanced"];
const EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "kettlebell"];
const UNITS = ["lbs", "kg"];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getProfile();
        setProfile(p);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const p = await api.updateProfile(profile);
      setProfile(p);
      Alert.alert("Saved", "Profile updated.");
    } catch (e: any) {
      Alert.alert("Save failed", String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const toggleEquipment = (eq: string) => {
    if (!profile) return;
    const set = new Set(profile.equipment);
    if (set.has(eq)) set.delete(eq);
    else set.add(eq);
    setProfile({ ...profile, equipment: Array.from(set) });
  };

  if (loading || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 }}
    >
      <Text style={styles.h1}>PROFILE</Text>

      <View style={styles.card}>
        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={styles.input}
          value={profile.name}
          onChangeText={(v) => setProfile({ ...profile, name: v })}
          placeholder="Athlete"
          placeholderTextColor={theme.colors.textTertiary}
          testID="profile-name-input"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>PRIMARY GOAL</Text>
        <View style={styles.chipRow}>
          {GOALS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, profile.goal === g && styles.chipActive]}
              onPress={() => setProfile({ ...profile, goal: g })}
              testID={`goal-${g}`}
            >
              <Text
                style={[styles.chipText, profile.goal === g && styles.chipTextActive]}
              >
                {g.replace("_", " ").toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>EXPERIENCE</Text>
        <View style={styles.chipRow}>
          {EXPERIENCE.map((e) => (
            <TouchableOpacity
              key={e}
              style={[styles.chip, profile.experience === e && styles.chipActive]}
              onPress={() => setProfile({ ...profile, experience: e })}
              testID={`exp-${e}`}
            >
              <Text
                style={[styles.chipText, profile.experience === e && styles.chipTextActive]}
              >
                {e.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>AVAILABLE EQUIPMENT</Text>
        <View style={styles.chipRow}>
          {EQUIPMENT.map((eq) => (
            <TouchableOpacity
              key={eq}
              style={[
                styles.chip,
                profile.equipment.includes(eq) && styles.chipActive,
              ]}
              onPress={() => toggleEquipment(eq)}
              testID={`equip-${eq}`}
            >
              <Text
                style={[
                  styles.chipText,
                  profile.equipment.includes(eq) && styles.chipTextActive,
                ]}
              >
                {eq.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>UNITS</Text>
        <View style={styles.chipRow}>
          {UNITS.map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.chip, profile.units === u && styles.chipActive]}
              onPress={() => setProfile({ ...profile, units: u })}
              testID={`unit-${u}`}
            >
              <Text style={[styles.chipText, profile.units === u && styles.chipTextActive]}>
                {u.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={save}
        disabled={saving}
        activeOpacity={0.85}
        testID="profile-save-btn"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>SAVE PROFILE</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.footer}>Local device profile · no account required</Text>
    </ScrollView>
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
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "800",
    marginBottom: 10,
  },
  input: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  chipTextActive: { color: "#fff" },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 1.5 },
  footer: {
    textAlign: "center",
    color: theme.colors.textTertiary,
    fontSize: 12,
    marginTop: 18,
  },
});
