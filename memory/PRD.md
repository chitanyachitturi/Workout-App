# Forge — AI Workout Tracker

## Overview
Mobile-first (Expo/React Native) AI-powered workout tracker with premium dark athletic design. Backend FastAPI + MongoDB. AI powered by Claude Sonnet 4.5 + OpenAI Whisper via Emergent LLM Key.

## MVP Scope (current)
- **Profile (local)**: name, goal, experience, available equipment, units (no login)
- **Workout Logging**:
  - Natural Language input (text + voice via OpenAI Whisper → Claude parses into structured sets)
  - Manual form: exercises + sets (weight/reps)
- **Workout History**: expandable session cards with delete
- **Home Dashboard**: snapshot stats (workouts, streak, sets, volume 30d), volume-by-muscle bars, top estimated 1RMs, recent sessions
- **Insights**: AI pattern detection (plateaus, imbalances, volume drops), weekly volume trend line chart
- **AI Coach (Forge)**: conversational chat with context of user's recent workouts/stats; suggestion chips
- **Design**: Performance Pro dark theme — #0A0A0A / #FF3B30 accent, Ionicons, large touch targets

## Architecture
- Backend: FastAPI, Motor (async Mongo), emergentintegrations (LlmChat + OpenAISpeechToText)
- Frontend: Expo Router tabs (Home / Log / Insights / Coach / Profile) + Stack history screen
- MongoDB collections: profile, exercises (seeded with 33 common lifts), workouts, chat_messages, insights

## Phase 2 (post-MVP)
- Adaptive weekly program generation stored as user's active plan
- Goal projections (regression + AI) with timeline
- Deload recommendations based on training load
- Exercise substitution inline during workout logging

## Key Endpoints (/api)
- GET/PUT /profile
- GET /exercises  
- GET/POST/DELETE /workouts, GET /workouts/{id}
- GET /stats/overview
- POST /parse_workout  (NL → structured)
- POST /transcribe  (audio → text)
- GET/POST /chat/messages, POST /chat/send, DELETE /chat/messages
- POST /insights/generate, GET /insights
