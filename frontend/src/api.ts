const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function req(path: string, options: RequestInit = {}) {
  const url = `${BASE}/api${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status}: ${t}`);
  }
  return res.json();
}

export type ProfileData = {
  id: string;
  name: string;
  goal: string;
  experience: string;
  equipment: string[];
  units: string;
};

export type WorkoutSet = {
  weight: number;
  reps: number;
  rpe?: number | null;
  notes?: string | null;
};

export type WorkoutExercise = {
  name: string;
  muscle_group?: string | null;
  sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  date: string;
  title?: string | null;
  exercises: WorkoutExercise[];
  duration_minutes?: number | null;
  notes?: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  aliases: string[];
};

export const api = {
  getProfile: () => req("/profile") as Promise<ProfileData>,
  updateProfile: (u: Partial<ProfileData>) =>
    req("/profile", { method: "PUT", body: JSON.stringify(u) }) as Promise<ProfileData>,

  listExercises: () => req("/exercises") as Promise<Exercise[]>,

  listWorkouts: () => req("/workouts") as Promise<Workout[]>,
  getWorkout: (id: string) => req(`/workouts/${id}`) as Promise<Workout>,
  createWorkout: (w: Partial<Workout>) =>
    req("/workouts", { method: "POST", body: JSON.stringify(w) }) as Promise<Workout>,
  deleteWorkout: (id: string) => req(`/workouts/${id}`, { method: "DELETE" }),

  statsOverview: () => req("/stats/overview"),

  parseWorkout: (text: string) =>
    req("/parse_workout", { method: "POST", body: JSON.stringify({ text }) }),

  getChat: () => req("/chat/messages") as Promise<ChatMessage[]>,
  sendChat: (message: string) =>
    req("/chat/send", { method: "POST", body: JSON.stringify({ message }) }) as Promise<ChatMessage>,
  clearChat: () => req("/chat/messages", { method: "DELETE" }),

  generateInsights: () => req("/insights/generate", { method: "POST" }),
  getInsights: () => req("/insights"),

  transcribe: async (uri: string, mime: string, ext: string) => {
    const form = new FormData();
    // React Native FormData
    // @ts-ignore
    form.append("file", { uri, name: `audio.${ext}`, type: mime });
    const res = await fetch(`${BASE}/api/transcribe`, { method: "POST", body: form as any });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`${res.status}: ${t}`);
    }
    return res.json() as Promise<{ text: string }>;
  },
};
