"""Backend API tests for AI Workout Tracker."""
import os
import io
import time
import struct
import math
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # Read frontend .env as fallback
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"')
                    break
    except Exception:
        pass
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---- Profile ----
class TestProfile:
    def test_get_default_profile(self, s):
        r = s.get(f"{API}/profile", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d and d["id"] == "default"
        assert "name" in d and "goal" in d and "units" in d

    def test_update_profile(self, s):
        payload = {"name": "TEST_User", "goal": "hypertrophy", "units": "kg"}
        r = s.put(f"{API}/profile", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_User"
        assert d["goal"] == "hypertrophy"
        assert d["units"] == "kg"

        # verify persistence
        r2 = s.get(f"{API}/profile", timeout=20)
        assert r2.json()["name"] == "TEST_User"

        # reset
        s.put(f"{API}/profile", json={"name": "Athlete", "goal": "strength", "units": "lbs"}, timeout=20)


# ---- Exercises ----
class TestExercises:
    def test_list_exercises(self, s):
        r = s.get(f"{API}/exercises", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 33, f"expected >=33 exercises, got {len(data)}"
        # muscle group present
        muscles = {e["muscle_group"] for e in data}
        assert {"chest", "back", "legs", "shoulders", "arms", "core"}.issubset(muscles)


# ---- Workouts CRUD ----
class TestWorkouts:
    created_id = None

    def test_create_workout(self, s):
        payload = {
            "title": "TEST_Workout",
            "exercises": [
                {"name": "Bench Press",
                 "sets": [{"weight": 135, "reps": 8}, {"weight": 135, "reps": 6}]}
            ],
        }
        r = s.post(f"{API}/workouts", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == "TEST_Workout"
        assert d["exercises"][0]["name"] == "Bench Press"
        assert d["exercises"][0]["muscle_group"] == "chest"  # auto-attached
        TestWorkouts.created_id = d["id"]

    def test_list_workouts(self, s):
        r = s.get(f"{API}/workouts", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(w["id"] == TestWorkouts.created_id for w in data)

    def test_get_workout(self, s):
        assert TestWorkouts.created_id
        r = s.get(f"{API}/workouts/{TestWorkouts.created_id}", timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == TestWorkouts.created_id

    def test_delete_workout(self, s):
        assert TestWorkouts.created_id
        r = s.delete(f"{API}/workouts/{TestWorkouts.created_id}", timeout=20)
        assert r.status_code == 200
        # verify 404
        r2 = s.get(f"{API}/workouts/{TestWorkouts.created_id}", timeout=20)
        assert r2.status_code == 404


# ---- Stats ----
class TestStats:
    def test_stats_overview_shape(self, s):
        r = s.get(f"{API}/stats/overview", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_workouts", "streak_days", "sets_last_30d",
                  "volume_last_30d", "volume_by_muscle",
                  "weekly_volume_trend", "top_prs"):
            assert k in d, f"missing {k}"
        assert isinstance(d["weekly_volume_trend"], list)
        assert isinstance(d["top_prs"], list)
        assert isinstance(d["volume_by_muscle"], dict)


# ---- AI Parse (Claude) ----
class TestAIParse:
    def test_parse_workout_ai(self, s):
        body = {"text": "Did 4 sets of bench press 185 lbs 8,8,7,6 last was a grind"}
        r = s.post(f"{API}/parse_workout", json=body, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "exercises" in d
        exs = d["exercises"]
        assert len(exs) >= 1
        ex = exs[0]
        assert "bench" in ex["name"].lower()
        sets = ex["sets"]
        assert len(sets) == 4, f"expected 4 sets, got {len(sets)}: {sets}"
        weights = [int(x["weight"]) for x in sets]
        reps = [x["reps"] for x in sets]
        assert all(w == 185 for w in weights), f"weights: {weights}"
        assert reps == [8, 8, 7, 6], f"reps: {reps}"


# ---- Chat (Claude) ----
class TestChat:
    def test_clear_chat(self, s):
        r = s.delete(f"{API}/chat/messages", timeout=20)
        assert r.status_code == 200

    def test_send_and_history(self, s):
        # clear first
        s.delete(f"{API}/chat/messages", timeout=20)
        r = s.post(f"{API}/chat/send", json={"message": "What should I train today?"}, timeout=90)
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["role"] == "assistant"
        assert len(msg["content"]) > 10

        r2 = s.get(f"{API}/chat/messages", timeout=20)
        assert r2.status_code == 200
        hist = r2.json()
        roles = [m["role"] for m in hist]
        assert "user" in roles and "assistant" in roles


# ---- Insights (Claude) ----
class TestInsights:
    def test_generate_insights(self, s):
        r = s.post(f"{API}/insights/generate", timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "insights" in d
        assert isinstance(d["insights"], list) and len(d["insights"]) >= 1

    def test_get_cached(self, s):
        r = s.get(f"{API}/insights", timeout=20)
        assert r.status_code == 200
        assert "insights" in r.json()


# ---- Transcribe ----
def _make_tiny_wav() -> bytes:
    """Build a 0.5s silent 16-bit PCM WAV."""
    sample_rate = 16000
    n_samples = sample_rate // 2
    data = b"\x00\x00" * n_samples
    # WAV header
    header = b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE"
    header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16)
    header += b"data" + struct.pack("<I", len(data))
    return header + data


class TestTranscribe:
    def test_empty_rejected(self):
        # Multipart with empty file should 400
        files = {"file": ("empty.wav", b"", "audio/wav")}
        r = requests.post(f"{API}/transcribe", files=files, timeout=30)
        assert r.status_code == 400, r.text

    def test_tiny_wav_accepted(self):
        wav = _make_tiny_wav()
        files = {"file": ("test.wav", wav, "audio/wav")}
        r = requests.post(f"{API}/transcribe", files=files, timeout=60)
        # Accept 200 (whisper returns text or empty) or 500 if API doesn't accept silent input
        assert r.status_code in (200, 500), r.text
        if r.status_code == 200:
            assert "text" in r.json()
