# Project Jugaad — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a voice-controlled environmental awareness game where "The Assembler" AI collects nature memories via voice, then reveals it's archiving them because the physical world is dying.

**Architecture:** FastAPI WebSocket server with Deepgram STT + ElevenLabs TTS + OpenAI GPT-4o-mini pipeline. Single-page HTML/CSS/JS frontend with premium iERTQA-inspired dark aesthetic. Game runs 1-2 minutes across 3 modes (Garden, Ocean, Sky) with a dramatic UI-glitch reveal.

**Tech Stack:** Python 3.11+, FastAPI, Deepgram SDK (WebSocket STT), ElevenLabs (HTTP streaming TTS), OpenAI API, vanilla HTML/CSS/JS

---

### Task 1: Audio Module (audio.py)

**Files:**
- Create: `audio.py`

Adapt `DeepgramStream` and `ElevenLabsTTS` from the negotiator project (`C:\Users\mukho\Desktop\CS 490 Senior Teams\negotiator\twilio_audio.py`). These are framework-agnostic async classes. Copy them with minimal changes — only need `linear16/16000` for Deepgram and `mp3_44100_128` for ElevenLabs.

**Commit:** `feat: add audio module with Deepgram STT and ElevenLabs TTS`

---

### Task 2: Persona Module (personas.py)

**Files:**
- Create: `personas.py`

Define The Assembler persona with 3 mode variants (Garden, Ocean, Sky). Each mode has:
- A system prompt defining The Assembler's personality and the mode's theme
- 2 scripted questions (nature memory prompts)
- A reveal monologue template
- A unique accent color for the frontend

**Commit:** `feat: add Assembler persona with 3 game modes`

---

### Task 3: Game Server (server.py)

**Files:**
- Create: `server.py`

FastAPI app with:
- `GET /` — serve static/index.html
- `GET /api/modes` — return available game modes as JSON
- `WS /ws` — WebSocket handler with game session management

WebSocket protocol:
- Client sends: `{"type":"start","mode":"garden"}`, binary audio, `{"type":"stop"}`
- Server sends: `{"type":"ready"}`, `{"type":"assembler_text","text":"..."}`, `{"type":"memory_card","text":"...","co2":"..."}`, `{"type":"reveal"}`, `{"type":"tts_start"}`, `{"type":"tts_end"}`, binary MP3 audio

Game session tracks: current phase (greeting/question1/question2/reveal), exchange count, CO2 accumulator, conversation history.

**Commit:** `feat: add FastAPI game server with WebSocket session management`

---

### Task 4: Config Files

**Files:**
- Create: `requirements.txt`
- Create: `.env.example`

**Commit:** `chore: add requirements and env template`

---

### Task 5: Frontend HTML (static/index.html)

**Files:**
- Create: `static/index.html`

Three-section layout:
1. Landing screen with mode selection cards + pulsing orb + "Speak to the Earth"
2. Game screen with waveform visualizer + memory card gallery + transcript
3. Reveal screen (same page, triggered by CSS class swap)

**Commit:** `feat: add game HTML structure`

---

### Task 6: Frontend CSS (static/css/styles.css)

**Files:**
- Create: `static/css/styles.css`

iERTQA-inspired premium dark aesthetic:
- Deep forest teal (#022b23) backgrounds with gold (#ffd8a2) accents
- Cormorant Garamond + Inter typography
- Glassmorphism cards with backdrop blur
- Floating glow orbs with parallax drift animation
- Memory card fade-in animations
- Glitch/corruption effect for the reveal (chromatic aberration, scan lines, color shift)
- Terminal mode (green-on-black) for "Save Energy" mode
- Responsive design

**Commit:** `feat: add premium dark CSS with glitch reveal effects`

---

### Task 7: Frontend JS (static/js/app.js)

**Files:**
- Create: `static/js/app.js`

Modules:
1. **State** — game phase, mode, WebSocket, mic, cards array
2. **Waveform** — canvas audio visualizer (organic sine wave in idle, frequency bars when active)
3. **Audio** — mic capture (linear16 16kHz) + MP3 playback
4. **Connection** — WebSocket lifecycle, message routing
5. **UI** — DOM rendering, screen transitions, card generation
6. **Reveal** — glitch animation sequence, terminal mode toggle
7. **Init** — bootstrap, mode selection, start button

**Commit:** `feat: add game JavaScript with voice interaction and reveal mechanics`

---

### Task 8: Integration Test + Polish

- Run `uvicorn server:app --host 0.0.0.0 --port 8000`
- Test full flow: select mode → speak → get response → reveal
- Verify glitch animation timing
- Verify Save Energy terminal mode

**Commit:** `polish: final integration and cleanup`
