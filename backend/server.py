from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import json
import logging
import tempfile
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from collections import defaultdict

import anthropic
from openai import AsyncOpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

CLAUDE_API_KEY = os.environ['CLAUDE_API_KEY']
OPENAI_API_KEY = os.environ['OPENAI_API_KEY']

anthropic_client = anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ---------- Seeds ----------
DEFAULT_EXERCISES = [
    {"name": "Bench Press", "muscle_group": "chest", "equipment": "barbell", "aliases": ["bp", "bench"]},
    {"name": "Incline Bench Press", "muscle_group": "chest", "equipment": "barbell", "aliases": ["incline bench"]},
    {"name": "Dumbbell Bench Press", "muscle_group": "chest", "equipment": "dumbbell", "aliases": ["db bench"]},
    {"name": "Dumbbell Fly", "muscle_group": "chest", "equipment": "dumbbell", "aliases": ["fly"]},
    {"name": "Push Up", "muscle_group": "chest", "equipment": "bodyweight", "aliases": ["pushup"]},
    {"name": "Cable Fly", "muscle_group": "chest", "equipment": "cable", "aliases": []},
    {"name": "Deadlift", "muscle_group": "back", "equipment": "barbell", "aliases": ["dl"]},
    {"name": "Pull Up", "muscle_group": "back", "equipment": "bodyweight", "aliases": ["pullup"]},
    {"name": "Barbell Row", "muscle_group": "back", "equipment": "barbell", "aliases": ["bb row"]},
    {"name": "Lat Pulldown", "muscle_group": "back", "equipment": "cable", "aliases": ["pulldown"]},
    {"name": "Seated Cable Row", "muscle_group": "back", "equipment": "cable", "aliases": ["cable row"]},
    {"name": "Dumbbell Row", "muscle_group": "back", "equipment": "dumbbell", "aliases": ["db row"]},
    {"name": "Squat", "muscle_group": "legs", "equipment": "barbell", "aliases": ["back squat"]},
    {"name": "Front Squat", "muscle_group": "legs", "equipment": "barbell", "aliases": []},
    {"name": "Romanian Deadlift", "muscle_group": "legs", "equipment": "barbell", "aliases": ["rdl"]},
    {"name": "Leg Press", "muscle_group": "legs", "equipment": "machine", "aliases": []},
    {"name": "Leg Curl", "muscle_group": "legs", "equipment": "machine", "aliases": ["hamstring curl"]},
    {"name": "Leg Extension", "muscle_group": "legs", "equipment": "machine", "aliases": []},
    {"name": "Lunge", "muscle_group": "legs", "equipment": "dumbbell", "aliases": ["lunges"]},
    {"name": "Calf Raise", "muscle_group": "legs", "equipment": "machine", "aliases": []},
    {"name": "Overhead Press", "muscle_group": "shoulders", "equipment": "barbell", "aliases": ["ohp", "military press"]},
    {"name": "Dumbbell Shoulder Press", "muscle_group": "shoulders", "equipment": "dumbbell", "aliases": ["db press"]},
    {"name": "Lateral Raise", "muscle_group": "shoulders", "equipment": "dumbbell", "aliases": ["side raise"]},
    {"name": "Face Pull", "muscle_group": "shoulders", "equipment": "cable", "aliases": []},
    {"name": "Barbell Curl", "muscle_group": "arms", "equipment": "barbell", "aliases": ["bb curl"]},
    {"name": "Dumbbell Curl", "muscle_group": "arms", "equipment": "dumbbell", "aliases": ["db curl"]},
    {"name": "Hammer Curl", "muscle_group": "arms", "equipment": "dumbbell", "aliases": []},
    {"name": "Tricep Pushdown", "muscle_group": "arms", "equipment": "cable", "aliases": ["pushdown"]},
    {"name": "Skull Crusher", "muscle_group": "arms", "equipment": "barbell", "aliases": ["lying tricep extension"]},
    {"name": "Dip", "muscle_group": "arms", "equipment": "bodyweight", "aliases": ["dips"]},
    {"name": "Plank", "muscle_group": "core", "equipment": "bodyweight", "aliases": []},
    {"name": "Hanging Leg Raise", "muscle_group": "core", "equipment": "bodyweight", "aliases": []},
    {"name": "Ab Wheel", "muscle_group": "core", "equipment": "bodyweight", "aliases": []},
]


# ---------- Models ----------
class Profile(BaseModel):
    id: str = "default"
    name: str = "Athlete"
    goal: str = "strength"
    experience: str = "intermediate"
    equipment: List[str] = Field(default_factory=lambda: ["barbell", "dumbbell", "cable", "machine", "bodyweight"])
    units: str = "lbs"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    experience: Optional[str] = None
    equipment: Optional[List[str]] = None
    units: Optional[str] = None


class Exercise(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    muscle_group: str
    equipment: str
    aliases: List[str] = Field(default_factory=list)


class WorkoutSet(BaseModel):
    weight: float = 0
    reps: int = 0
    rpe: Optional[float] = None
    notes: Optional[str] = None


class WorkoutExercise(BaseModel):
    name: str
    muscle_group: Optional[str] = None
    sets: List[WorkoutSet] = Field(default_factory=list)


class Workout(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    title: Optional[str] = None
    exercises: List[WorkoutExercise] = Field(default_factory=list)
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WorkoutCreate(BaseModel):
    date: Optional[datetime] = None
    title: Optional[str] = None
    exercises: List[WorkoutExercise] = Field(default_factory=list)
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatRequest(BaseModel):
    message: str


class ParseRequest(BaseModel):
    text: str


# ---------- Helpers ----------
def _clean(doc: Dict[str, Any]) -> Dict[str, Any]:
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


async def _ensure_seed():
    count = await db.exercises.count_documents({})
    if count == 0:
        seeded = [Exercise(**e).dict() for e in DEFAULT_EXERCISES]
        await db.exercises.insert_many(seeded)
        logger.info(f"Seeded {len(seeded)} exercises")


async def _get_profile() -> Profile:
    doc = await db.profile.find_one({"id": "default"})
    if not doc:
        p = Profile()
        await db.profile.insert_one(p.dict())
        return p
    return Profile(**_clean(doc))


async def _recent_workouts_summary(limit: int = 20) -> str:
    cursor = db.workouts.find({}, {"_id": 0}).sort("date", -1).limit(limit)
    workouts = await cursor.to_list(limit)
    if not workouts:
        return "No workouts logged yet."
    lines = []
    for w in workouts:
        d = w.get("date")
        d_str = d.strftime("%Y-%m-%d") if isinstance(d, datetime) else str(d)[:10]
        ex_parts = []
        for ex in w.get("exercises", []):
            sets = ex.get("sets", [])
            if not sets:
                continue
            set_str = ", ".join(f"{s.get('weight',0)}x{s.get('reps',0)}" for s in sets)
            ex_parts.append(f"{ex['name']}: {set_str}")
        if ex_parts:
            lines.append(f"[{d_str}] " + " | ".join(ex_parts))
    return "\n".join(lines) if lines else "No logged sets yet."


async def _call_claude(system: str, user: str, max_tokens: int = 2048) -> str:
    message = await anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return message.content[0].text


async def _call_claude_with_history(system: str, messages: list, max_tokens: int = 2048) -> str:
    message = await anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    return message.content[0].text


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "AI Workout Tracker API"}


@api_router.get("/profile", response_model=Profile)
async def get_profile():
    return await _get_profile()


@api_router.put("/profile", response_model=Profile)
async def update_profile(update: ProfileUpdate):
    current = await _get_profile()
    data = current.dict()
    for k, v in update.dict(exclude_unset=True).items():
        if v is not None:
            data[k] = v
    await db.profile.update_one({"id": "default"}, {"$set": data}, upsert=True)
    return Profile(**data)


@api_router.get("/exercises", response_model=List[Exercise])
async def list_exercises():
    await _ensure_seed()
    docs = await db.exercises.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return [Exercise(**d) for d in docs]


@api_router.post("/workouts", response_model=Workout)
async def create_workout(payload: WorkoutCreate):
    w = Workout(**payload.dict(exclude_unset=True))
    ex_map = {e["name"].lower(): e for e in await db.exercises.find({}, {"_id": 0}).to_list(500)}
    for ex in w.exercises:
        if not ex.muscle_group:
            found = ex_map.get(ex.name.lower())
            if found:
                ex.muscle_group = found["muscle_group"]
    await db.workouts.insert_one(w.dict())
    return w


@api_router.get("/workouts", response_model=List[Workout])
async def list_workouts(limit: int = 100):
    docs = await db.workouts.find({}, {"_id": 0}).sort("date", -1).limit(limit).to_list(limit)
    return [Workout(**d) for d in docs]


@api_router.get("/workouts/{workout_id}", response_model=Workout)
async def get_workout(workout_id: str):
    doc = await db.workouts.find_one({"id": workout_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Workout not found")
    return Workout(**doc)


@api_router.delete("/workouts/{workout_id}")
async def delete_workout(workout_id: str):
    res = await db.workouts.delete_one({"id": workout_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workout not found")
    return {"ok": True}


@api_router.get("/stats/overview")
async def stats_overview():
    workouts = await db.workouts.find({}, {"_id": 0}).sort("date", -1).to_list(500)
    total_workouts = len(workouts)
    today = datetime.now(timezone.utc).date()
    dates = set()
    for w in workouts:
        d = w.get("date")
        if isinstance(d, datetime):
            dates.add(d.date())
    streak = 0
    cur = today
    while cur in dates:
        streak += 1
        cur = cur - timedelta(days=1)
    if streak == 0 and (today - timedelta(days=1)) in dates:
        cur = today - timedelta(days=1)
        while cur in dates:
            streak += 1
            cur = cur - timedelta(days=1)
    cutoff = datetime.utcnow() - timedelta(days=30)
    volume_by_muscle: Dict[str, float] = defaultdict(float)
    sets_count = 0
    total_volume = 0.0
    prs: Dict[str, float] = {}
    for w in workouts:
        wdate = w.get("date")
        if not isinstance(wdate, datetime):
            continue
        if wdate.tzinfo is not None:
            wdate = wdate.replace(tzinfo=None)
        in_window = wdate >= cutoff
        for ex in w.get("exercises", []):
            mg = ex.get("muscle_group") or "other"
            for s in ex.get("sets", []):
                wt = float(s.get("weight") or 0)
                reps = int(s.get("reps") or 0)
                vol = wt * reps
                if in_window:
                    volume_by_muscle[mg] += vol
                    sets_count += 1
                    total_volume += vol
                if wt > 0 and reps > 0:
                    e1rm = wt * (1 + reps / 30.0)
                    name = ex.get("name")
                    if name and (name not in prs or e1rm > prs[name]):
                        prs[name] = round(e1rm, 1)
    weekly = defaultdict(float)
    for w in workouts:
        wdate = w.get("date")
        if not isinstance(wdate, datetime):
            continue
        if wdate.tzinfo is not None:
            wdate = wdate.replace(tzinfo=None)
        week_key = wdate.date() - timedelta(days=wdate.weekday())
        for ex in w.get("exercises", []):
            for s in ex.get("sets", []):
                weekly[week_key] += float(s.get("weight") or 0) * int(s.get("reps") or 0)
    weekly_sorted = sorted(weekly.items())[-8:]
    weekly_trend = [{"week": k.isoformat(), "volume": round(v, 1)} for k, v in weekly_sorted]
    top_prs = sorted(prs.items(), key=lambda x: -x[1])[:5]
    return {
        "total_workouts": total_workouts,
        "streak_days": streak,
        "sets_last_30d": sets_count,
        "volume_last_30d": round(total_volume, 1),
        "volume_by_muscle": {k: round(v, 1) for k, v in volume_by_muscle.items()},
        "weekly_volume_trend": weekly_trend,
        "top_prs": [{"exercise": n, "estimated_1rm": v} for n, v in top_prs],
    }


@api_router.post("/parse_workout")
async def parse_workout(req: ParseRequest):
    exercises_doc = await db.exercises.find({}, {"_id": 0, "name": 1, "aliases": 1, "muscle_group": 1}).to_list(500)
    ex_context = "\n".join(f"- {e['name']} ({e['muscle_group']})" for e in exercises_doc)
    system = (
        "You are a strict workout-log parser. The user describes a workout in free-form text. "
        "Extract structured data and return ONLY valid JSON (no markdown, no explanation).\n\n"
        "JSON schema:\n"
        "{\n"
        '  "title": string | null,\n'
        '  "exercises": [\n'
        "    {\n"
        '      "name": string,\n'
        '      "muscle_group": string,\n'
        '      "sets": [ { "weight": number, "reps": number, "rpe": number|null, "notes": string|null } ]\n'
        "    }\n"
        "  ],\n"
        '  "notes": string | null\n'
        "}\n\n"
        "Rules:\n"
        "- Weight in whatever unit user mentioned; just use the number (default lbs).\n"
        "- If reps listed per set (e.g. '8,8,7,6'), create one set per value with the same weight.\n"
        "- Prefer exact exercise name from this list:\n"
        f"{ex_context}\n"
        "- If no exercise mentioned, return exercises: [].\n"
        "- Return JSON only."
    )
    try:
        response = await _call_claude(system=system, user=req.text, max_tokens=1024)
    except Exception as e:
        logger.exception("parse_workout failed")
        raise HTTPException(status_code=500, detail=f"AI parse failed: {str(e)}")
    raw = response.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        start = raw.index("{")
        end = raw.rindex("}")
        data = json.loads(raw[start:end + 1])
    except Exception:
        raise HTTPException(status_code=500, detail="Could not parse AI response")
    exercises_out = []
    for ex in data.get("exercises", []):
        name = ex.get("name", "").strip()
        if not name:
            continue
        sets = []
        for s in ex.get("sets", []) or []:
            try:
                sets.append({
                    "weight": float(s.get("weight") or 0),
                    "reps": int(s.get("reps") or 0),
                    "rpe": float(s["rpe"]) if s.get("rpe") not in (None, "") else None,
                    "notes": s.get("notes"),
                })
            except Exception:
                continue
        exercises_out.append({"name": name, "muscle_group": ex.get("muscle_group"), "sets": sets})
    return {"title": data.get("title"), "exercises": exercises_out, "notes": data.get("notes")}


@api_router.get("/chat/messages", response_model=List[ChatMessage])
async def get_chat_messages(limit: int = 200):
    docs = await db.chat_messages.find({}, {"_id": 0}).sort("created_at", 1).limit(limit).to_list(limit)
    return [ChatMessage(**d) for d in docs]


@api_router.delete("/chat/messages")
async def clear_chat():
    await db.chat_messages.delete_many({})
    return {"ok": True}


@api_router.post("/chat/send", response_model=ChatMessage)
async def chat_send(req: ChatRequest):
    profile = await _get_profile()
    summary = await _recent_workouts_summary(30)
    stats = await stats_overview()
    system = (
        "You are Forge, an elite AI strength & conditioning coach embedded in a workout app.\n"
        f"The athlete's profile: name={profile.name}, goal={profile.goal}, experience={profile.experience}, "
        f"units={profile.units}, available equipment={', '.join(profile.equipment)}.\n"
        "You speak with confidence, concision, and data-driven insight. Prefer short paragraphs and bulleted lists.\n"
        "Use the athlete's recent training data when answering. Cite numbers. Be pragmatic.\n"
        "When they ask for a program, present a clean weekly split with day-by-day exercises, sets x reps, RPE.\n"
        "When recommending substitutions, respect their available equipment.\n"
        "Do not fabricate data. If data is missing, say so and suggest what to log.\n\n"
        f"RECENT 30-DAY STATS:\n"
        f"- Workouts: {stats['total_workouts']}, streak: {stats['streak_days']} day(s)\n"
        f"- Sets last 30d: {stats['sets_last_30d']}, volume last 30d: {stats['volume_last_30d']}\n"
        f"- Volume by muscle: {stats['volume_by_muscle']}\n"
        f"- Top PRs (est 1RM): {stats['top_prs']}\n\n"
        f"RECENT WORKOUT LOGS (most recent first):\n{summary}\n"
    )
    history = await db.chat_messages.find({}, {"_id": 0}).sort("created_at", 1).to_list(100)
    user_msg_doc = ChatMessage(role="user", content=req.message)
    await db.chat_messages.insert_one(user_msg_doc.dict())
    messages = []
    for m in history[-10:]:
        role = m.get("role", "user")
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": m.get("content", "")})
    messages.append({"role": "user", "content": req.message})
    try:
        response = await _call_claude_with_history(system=system, messages=messages, max_tokens=2048)
    except Exception as e:
        logger.exception("chat_send failed")
        raise HTTPException(status_code=500, detail=f"AI chat failed: {str(e)}")
    assistant_doc = ChatMessage(role="assistant", content=response.strip())
    await db.chat_messages.insert_one(assistant_doc.dict())
    return assistant_doc


@api_router.post("/insights/generate")
async def generate_insights():
    workouts = await db.workouts.find({}, {"_id": 0}).sort("date", -1).limit(60).to_list(60)
    if len(workouts) < 2:
        return {"insights": [{"title": "Log more sessions", "detail": "Log at least 3 workouts so your AI coach can detect patterns."}]}
    summary = await _recent_workouts_summary(40)
    stats = await stats_overview()
    system = (
        "You are a sports scientist. Given an athlete's recent workouts and summary stats, "
        "produce 3-6 concrete INSIGHTS they wouldn't notice manually. "
        "Return ONLY JSON of the form: "
        '{ "insights": [ { "title": string, "detail": string, "severity": "info"|"warn"|"good" } ] }. '
        "Titles are short (max 8 words). Details are 1-2 sentences with numbers where possible."
    )
    user = (
        f"STATS:\n{json.dumps(stats, default=str)}\n\nRECENT WORKOUTS:\n{summary}\n\n"
        "Find plateaus, volume drops, muscle imbalances, day-of-week patterns, or positive trends."
    )
    try:
        response = await _call_claude(system=system, user=user, max_tokens=1024)
    except Exception as e:
        logger.exception("insights failed")
        raise HTTPException(status_code=500, detail=f"AI insights failed: {str(e)}")
    raw = response.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        start = raw.index("{")
        end = raw.rindex("}")
        data = json.loads(raw[start:end + 1])
    except Exception:
        return {"insights": [{"title": "Analysis complete", "detail": raw[:300], "severity": "info"}]}
    out = data.get("insights", [])
    await db.insights.delete_many({})
    await db.insights.insert_one({"generated_at": datetime.now(timezone.utc), "insights": out})
    return {"insights": out}


@api_router.get("/insights")
async def get_cached_insights():
    doc = await db.insights.find_one({}, {"_id": 0}, sort=[("generated_at", -1)])
    if not doc:
        return {"insights": [], "generated_at": None}
    return doc


@api_router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    ext = Path(file.filename).suffix.lstrip(".").lower()
    valid_exts = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}
    if ext not in valid_exts:
        ct = (file.content_type or "").lower()
        if "mp4" in ct or "m4a" in ct:
            ext = "m4a"
        elif "wav" in ct:
            ext = "wav"
        elif "webm" in ct:
            ext = "webm"
        elif "mpeg" in ct or "mp3" in ct:
            ext = "mp3"
        else:
            ext = "m4a"
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as f:
            transcript = await openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="json"
            )
        text = transcript.text if hasattr(transcript, "text") else ""
        return {"text": text}
    except Exception as e:
        logger.exception("transcribe failed")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await _ensure_seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
