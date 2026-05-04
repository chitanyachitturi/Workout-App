import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useAudioRecorder,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import { theme } from "../../src/theme";
import { api, WorkoutExercise, WorkoutSet } from "../../src/api";

type Mode = "nl" | "manual";

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("nl");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          // permission may be requested on first use again
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      } catch (e) {
        console.log("audio setup err", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.25,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [isRecording, pulse]);

  const startRecord = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow microphone access to use voice logging.");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (e: any) {
      Alert.alert("Recording error", String(e?.message || e));
    }
  };

  const stopRecord = async () => {
    try {
      setIsRecording(false);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        Alert.alert("No audio", "Recording was empty.");
        return;
      }
      setTranscribing(true);
      const ext = uri.split(".").pop()?.toLowerCase() || "m4a";
      const mime =
        ext === "m4a" ? "audio/m4a" : ext === "wav" ? "audio/wav" : ext === "webm" ? "audio/webm" : "audio/mpeg";
      const res = await api.transcribe(uri, mime, ext);
      setText((t) => (t ? t + " " + res.text : res.text));
    } catch (e: any) {
      Alert.alert("Transcription failed", String(e?.message || e));
    } finally {
      setTranscribing(false);
    }
  };

  const handleParse = async () => {
    if (!text.trim()) {
      Alert.alert("Empty", "Type or speak your workout first.");
      return;
    }
    setParsing(true);
    try {
      const parsed = await api.parseWorkout(text);
      setExercises(parsed.exercises || []);
      if (parsed.title && !title) setTitle(parsed.title);
      if (!parsed.exercises || parsed.exercises.length === 0) {
        Alert.alert("No exercises detected", "Try something like: '4x8 bench press at 185'");
      }
    } catch (e: any) {
      Alert.alert("Parse failed", String(e?.message || e));
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    if (exercises.length === 0) {
      Alert.alert("Nothing to save", "Parse or add exercises first.");
      return;
    }
    setSaving(true);
    try {
      await api.createWorkout({
        title: title || undefined,
        exercises,
      } as any);
      setExercises([]);
      setText("");
      setTitle("");
      Alert.alert("Logged", "Workout saved.", [
        { text: "OK", onPress: () => router.push("/") },
      ]);
    } catch (e: any) {
      Alert.alert("Save failed", String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const addManualExercise = () => {
    setExercises([
      ...exercises,
      { name: "", muscle_group: null, sets: [{ weight: 0, reps: 0 }] },
    ]);
  };

  const updateExerciseName = (i: number, name: string) => {
    const next = [...exercises];
    next[i].name = name;
    setExercises(next);
  };

  const addSet = (i: number) => {
    const next = [...exercises];
    const last = next[i].sets[next[i].sets.length - 1];
    next[i].sets.push({ weight: last?.weight || 0, reps: last?.reps || 0 });
    setExercises(next);
  };

  const removeSet = (i: number, j: number) => {
    const next = [...exercises];
    next[i].sets.splice(j, 1);
    if (next[i].sets.length === 0) next.splice(i, 1);
    setExercises(next);
  };

  const updateSet = (i: number, j: number, field: keyof WorkoutSet, value: string) => {
    const next = [...exercises];
    const num = Number(value) || 0;
    (next[i].sets[j] as any)[field] = num;
    setExercises(next);
  };

  const removeExercise = (i: number) => {
    const next = [...exercises];
    next.splice(i, 1);
    setExercises(next);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>LOG WORKOUT</Text>

        <View style={styles.segment}>
          <SegmentBtn active={mode === "nl"} onPress={() => setMode("nl")} label="NATURAL" testID="mode-nl" />
          <SegmentBtn active={mode === "manual"} onPress={() => setMode("manual")} label="MANUAL" testID="mode-manual" />
        </View>

        {mode === "nl" && (
          <View style={styles.card}>
            <Text style={styles.cardKicker}>SPEAK OR TYPE</Text>
            <Text style={styles.helper}>
              e.g. &ldquo;4 sets of squats, 185 lbs, 8 8 7 6, last set was a grind&rdquo;
            </Text>
            <TextInput
              style={styles.textArea}
              multiline
              placeholder="Describe your workout..."
              placeholderTextColor={theme.colors.textTertiary}
              value={text}
              onChangeText={setText}
              testID="nl-input"
            />
            <View style={styles.voiceRow}>
              <Animated.View style={{ transform: [{ scale: pulse }] }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.voiceBtn,
                    isRecording && styles.voiceBtnActive,
                  ]}
                  onPress={isRecording ? stopRecord : startRecord}
                  disabled={transcribing}
                  testID="voice-btn"
                >
                  {transcribing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons
                      name={isRecording ? "stop" : "mic"}
                      size={28}
                      color="#fff"
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.voiceHint}>
                {transcribing
                  ? "Transcribing..."
                  : isRecording
                  ? "Recording... tap to stop"
                  : "Tap to record"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.parseBtn, parsing && { opacity: 0.6 }]}
              onPress={handleParse}
              disabled={parsing}
              activeOpacity={0.8}
              testID="parse-btn"
            >
              {parsing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={styles.parseBtnText}>PARSE WITH AI</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {mode === "manual" && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={addManualExercise}
            activeOpacity={0.7}
            testID="add-exercise-btn"
          >
            <Ionicons name="add" size={20} color={theme.colors.primary} />
            <Text style={styles.addBtnText}>ADD EXERCISE</Text>
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.titleInput}
          placeholder="Workout title (optional)"
          placeholderTextColor={theme.colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          testID="title-input"
        />

        {exercises.map((ex, i) => (
          <View key={i} style={styles.exCard} testID={`ex-card-${i}`}>
            <View style={styles.exHeader}>
              <TextInput
                style={styles.exName}
                placeholder="Exercise name"
                placeholderTextColor={theme.colors.textTertiary}
                value={ex.name}
                onChangeText={(v) => updateExerciseName(i, v)}
              />
              <TouchableOpacity onPress={() => removeExercise(i)} testID={`remove-ex-${i}`}>
                <Ionicons name="close" size={22} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
            {ex.muscle_group && (
              <Text style={styles.muscleChip}>{ex.muscle_group.toUpperCase()}</Text>
            )}
            <View style={styles.setHeader}>
              <Text style={[styles.setHeaderText, { flex: 1 }]}>SET</Text>
              <Text style={[styles.setHeaderText, { width: 76, textAlign: "center" }]}>WEIGHT</Text>
              <Text style={[styles.setHeaderText, { width: 64, textAlign: "center" }]}>REPS</Text>
              <View style={{ width: 30 }} />
            </View>
            {ex.sets.map((s, j) => (
              <View key={j} style={styles.setRow}>
                <Text style={styles.setNum}>{j + 1}</Text>
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  value={String(s.weight || "")}
                  onChangeText={(v) => updateSet(i, j, "weight", v)}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textTertiary}
                  testID={`set-weight-${i}-${j}`}
                />
                <TextInput
                  style={[styles.setInput, { width: 64 }]}
                  keyboardType="numeric"
                  value={String(s.reps || "")}
                  onChangeText={(v) => updateSet(i, j, "reps", v)}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textTertiary}
                  testID={`set-reps-${i}-${j}`}
                />
                <TouchableOpacity onPress={() => removeSet(i, j)} testID={`remove-set-${i}-${j}`}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addSetBtn}
              onPress={() => addSet(i)}
              testID={`add-set-${i}`}
            >
              <Ionicons name="add" size={16} color={theme.colors.textPrimary} />
              <Text style={styles.addSetBtnText}>ADD SET</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {exercises.length > 0 && (
        <View style={[styles.saveBar, { paddingBottom: 24 }]}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            testID="save-workout-btn"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={22} color="#fff" />
                <Text style={styles.saveBtnText}>
                  SAVE WORKOUT · {exercises.reduce((s, e) => s + e.sets.length, 0)} SETS
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function SegmentBtn({
  active,
  onPress,
  label,
  testID,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  testID: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.segBtn, active && styles.segBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={testID}
    >
      <Text style={[styles.segBtnText, active && styles.segBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  h1: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 16,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.button,
    padding: 4,
    marginBottom: 16,
  },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  segBtnActive: { backgroundColor: theme.colors.primary },
  segBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "800",
  },
  segBtnTextActive: { color: "#fff" },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 16,
  },
  cardKicker: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "800",
  },
  helper: { color: theme.colors.textTertiary, fontSize: 12, marginTop: 6, marginBottom: 10 },
  textArea: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    color: theme.colors.textPrimary,
    fontSize: 15,
    minHeight: 110,
    padding: 12,
    textAlignVertical: "top",
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 12,
  },
  voiceBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBtnActive: {
    backgroundColor: "#E11",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  voiceHint: { color: theme.colors.textSecondary, fontSize: 13, flex: 1 },
  parseBtn: {
    marginTop: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  parseBtnText: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 1.5 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.primary,
    borderRadius: 10,
    padding: 14,
    gap: 8,
    marginBottom: 14,
  },
  addBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "800",
  },
  titleInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.textPrimary,
    fontSize: 15,
    marginBottom: 14,
  },
  exCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 14,
    marginBottom: 12,
  },
  exHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  exName: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  muscleChip: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primaryMuted,
    color: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 6,
    overflow: "hidden",
  },
  setHeader: { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 6 },
  setHeaderText: {
    color: theme.colors.textTertiary,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 8,
  },
  setNum: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  setInput: {
    width: 76,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    color: theme.colors.textPrimary,
    fontSize: 15,
    textAlign: "center",
    paddingVertical: 8,
    fontWeight: "700",
  },
  addSetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
    marginTop: 8,
  },
  addSetBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 86,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.bg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1.5 },
});
