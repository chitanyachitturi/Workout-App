import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { theme } from "../../src/theme";
import { api, ChatMessage } from "../../src/api";

const SUGGESTIONS = [
  "What should I train today?",
  "Build me a 4-day upper/lower split",
  "Why am I stalling on bench?",
  "Suggest dumbbell alternatives for lat pulldown",
];

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const load = async () => {
    try {
      const msgs = await api.getChat();
      setMessages(msgs);
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

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length]);

  const send = async (msg?: string) => {
    const text = (msg ?? input).trim();
    if (!text || sending) return;
    setInput("");
    // optimistic user message
    const pending: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, pending]);
    setSending(true);
    try {
      const reply = await api.sendChat(text);
      // reload to pull canonical
      const msgs = await api.getChat();
      setMessages(msgs);
    } catch (e: any) {
      Alert.alert("Chat failed", String(e?.message || e));
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    Alert.alert("Clear chat?", "This removes the entire conversation.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await api.clearChat();
          setMessages([]);
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 86 : 0}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.orb}>
          <Ionicons name="pulse" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>FORGE</Text>
          <Text style={styles.headerSub}>AI Strength Coach · always on</Text>
        </View>
        <TouchableOpacity onPress={clear} testID="clear-chat-btn">
          <Ionicons name="trash-outline" size={20} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
      >
        {loading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />}
        {!loading && messages.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>READY WHEN YOU ARE.</Text>
            <Text style={styles.emptySub}>
              Ask for a program, troubleshoot a stall, or get today&apos;s session idea.
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestChip}
                  onPress={() => send(s)}
                  testID={`suggestion-${s.slice(0, 12)}`}
                >
                  <Text style={styles.suggestChipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {sending && (
          <View style={styles.aiBubble}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: 24 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message Forge..."
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          testID="chat-input"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
          onPress={() => send()}
          disabled={!input.trim() || sending}
          activeOpacity={0.8}
          testID="chat-send-btn"
        >
          <Ionicons name="arrow-up" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleWrap, { alignItems: isUser ? "flex-end" : "flex-start" }]}>
      {!isUser && (
        <Text style={styles.aiLabel}>FORGE</Text>
      )}
      <View style={isUser ? styles.userBubble : styles.aiBubble}>
        <Text style={isUser ? styles.userText : styles.aiText}>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  orb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  headerSub: { color: theme.colors.textTertiary, fontSize: 11, letterSpacing: 0.5 },
  messages: { flex: 1 },
  empty: { paddingVertical: 24 },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
  },
  emptySub: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 6, marginBottom: 20 },
  suggestions: { gap: 8 },
  suggestChip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  suggestChipText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" },
  bubbleWrap: { marginBottom: 12 },
  aiLabel: {
    color: theme.colors.primary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
    marginBottom: 4,
    marginLeft: 2,
  },
  userBubble: {
    maxWidth: "82%",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 21 },
  aiBubble: {
    maxWidth: "88%",
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiText: { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 22 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: theme.colors.textPrimary,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
