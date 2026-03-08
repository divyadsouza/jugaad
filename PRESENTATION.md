# JUGAAD — The Art of Survival
## DonsHack '26 | Environmental Tech Hackathon

---

## Concept

**Jugaad** (Hindi: जुगाड़) — the ancient Indian art of making something from nothing. Frugal innovation. Creative survival.

In 2050, Earth is gasping. The air tastes like rust. The oceans have turned grey. The forests exist only in memory — digital fragments preserved by machines that helped destroy them. But from the rubble rises JUGAAD — armed with recycled tech and raw determination, the last generation fights back. Not with armies. With creativity.

**Three interactive experiences** that make environmental awareness personal, emotional, and unforgettable.

---

## Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| **Python 3.11+** | Server runtime |
| **FastAPI** | Async web framework with WebSocket support |
| **Uvicorn** | ASGI server |
| **OpenAI GPT-4o-mini** | AI dialogue generation for The Assembler persona |
| **Deepgram Nova-2** | Real-time speech-to-text (WebSocket streaming, linear16 16kHz) |
| **ElevenLabs** | High-quality text-to-speech (MP3 44100Hz 128kbps streaming) |
| **httpx** | Async HTTP client for ElevenLabs API |

### Frontend
| Technology | Purpose |
|-----------|---------|
| **Vanilla HTML5/CSS3/JS** | Zero frameworks — pure web standards |
| **HTML5 Canvas 2D** | Game rendering engine (both games) |
| **Web Audio API** | Microphone capture (ScriptProcessorNode), TTS playback (AudioContext.decodeAudioData) |
| **WebSocket API** | Real-time bidirectional audio/text streaming |
| **CSS Custom Properties** | Design system with theming |
| **Inline SVG** | Animated Earth, icons, vector graphics |
| **CSS Animations** | Particles, shimmer, typewriter, glassmorphism effects |

### Design
| Element | Detail |
|---------|--------|
| **Aesthetic** | Premium dark glassmorphism (inspired by iERTQA) |
| **Color Palette** | Deep forest black (#050d09), gold accents (#ffd8a2), emerald (#34d399), teal (#2dd4bf) |
| **Typography** | Cormorant Garamond (display), Inter (body), JetBrains Mono (terminal) |
| **Effects** | Floating CSS particles (30 elements, GPU-accelerated), sonar rings, background glow orbs, grain overlay |
| **Animations** | Shimmer title, typewriter subtitle, card entrances, glitch reveal (chromatic aberration + scan lines) |

### APIs & Services
| Service | Usage |
|---------|-------|
| **OpenAI API** | GPT-4o-mini for Assembler's poetic dialogue and post-reveal conversation |
| **Deepgram API** | Nova-2 streaming STT via WebSocket, with KeepAlive heartbeat (every 5s) |
| **ElevenLabs API** | Voice synthesis via HTTP streaming, voice: "Daniel" (calm, authoritative) |

### Key Architecture Decisions
- **Deepgram KeepAlive**: Official `{"type": "KeepAlive"}` text frames sent every 5 seconds server-side to prevent 10-second timeout
- **No-Cache Middleware**: Custom FastAPI middleware prevents browser caching of JS/CSS/HTML during development
- **Push-to-Talk**: Server-side `_user_recording` flag gates transcript processing; audio always flows to keep Deepgram alive
- **AudioContext on User Gesture**: TTS playback AudioContext created during "Begin" button click to bypass browser autoplay policy

---

## Experience 1: The Assembler (Voice Game)

### What Is It?
A voice-controlled AI experience where "The Assembler" — a calm, poetic AI consciousness — collects your nature memories through conversation, then delivers a devastating environmental reveal.

### The Persona
> *"I am The Assembler. I collect fragments of a dying world. Not data. Memories. The sound of rain. The smell of earth. The color of a sky you once stopped to admire."*

- Ultra-refined, speaks in short elegant sentences
- Never uses emojis, never breaks character
- Tone: warm but measured, like a luxury concierge at the end of the world

### Three Modes

| Mode | Theme | Color | Questions | Reveal |
|------|-------|-------|-----------|--------|
| **The Garden** | Forests, trees, earth | Green (#4ade80) | "What does a forest sound like?" / "Imagine touching soil. What did it feel like?" | 10M hectares of forest lost per year. "You tried to preserve nature using a machine that burns it." |
| **The Ocean** | Water, waves, marine life | Blue (#38bdf8) | "What does the ocean sound like?" / "Have you ever tasted salt air?" | Ocean absorbing 22M tons CO2/day. By 2050, more plastic than fish. |
| **The Sky** | Weather, rain, air | Purple (#c084fc) | "What does rain smell like on dry earth?" / "Describe a sky that made you stop." | 50% more extreme weather events. Most cities fail WHO air standards. |

### Conversation Flow
1. **Greeting** — Assembler introduces itself with a poetic monologue
2. **Question 1** — Asks for a nature memory (user records via Speak button)
3. **Question 2** — Asks for a second memory
4. **The Reveal** — Glitch animation (chromatic aberration, scan lines), then the truth: your conversation consumed CO2. The memories you described are disappearing. The machine you used to preserve them is accelerating their destruction.

### CO2 Tracking
- ~5.12g CO2 per voice exchange (LLM 4.32g + STT 0.3g + TTS 0.5g)
- Running total displayed on memory cards
- Final total shown in reveal stats

### Post-Reveal
- **Continue Conversation**: Talk to The Assembler about what you just learned
- **Terminal Mode**: Say "save energy" to enter green-on-black CRT mode (low power aesthetic)

---

## Experience 2: Sky Rescue — Purify the Skies

### What Is It?
An Amidst-the-Skies-inspired exploration platformer where you fly through polluted skies, collect purification crystals, defeat pollution bosses, and restore the atmosphere. The world visually heals as you progress.

### Character: The Eco Guardian
- 28×36 pixel sprite drawn programmatically on canvas
- Animated states: idle, run, fly, dash, attack
- Glowing aura that changes color based on purification level

### Controls
| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move |
| Space / W / Up | Jump (hold for higher, double jump available) |
| Shift | Dash (2-second cooldown) |
| Z / Click | Fire purification beam |
| Down | Fast fall |
| P | Pause |

### Three Zones

#### Zone 1: Toxic Cloudlands (0–2000m)
- **Sky**: Dark grey/brown, toxic green clouds
- **Enemies**: Smog Puffs (float in place, shoot toxic drops)
- **Collectibles**: Green purification crystals
- **Boss**: **Smog Titan** (5 HP) — large cloud entity, shoots toxic rain
- **Purified**: Sky turns light blue, clouds turn white, grass appears on platforms

#### Zone 2: Acid Rain Valley (2000–4000m)
- **Sky**: Yellow-tinged, acid rain falls (damaging)
- **Enemies**: Acid Droplets (fall from above), Corroded Drones (fly in patterns)
- **Features**: Moving platforms, wind currents introduced
- **Boss**: **Acid Rain Serpent** (8 HP) — snakes across screen, spits acid
- **Purified**: Rain stops, sky turns sunset orange/pink, flowers bloom on islands

#### Zone 3: The Great Smog (4000–6000m)
- **Sky**: Nearly black, visibility reduced (fog effect)
- **Enemies**: Smog Wraiths (invisible until close), Pollution Vortexes (pull player in)
- **Collectibles**: Gold purification crystals (worth 3x)
- **Boss**: **The Great Pollution** (15 HP) — massive dark entity, 3 attack phases (slam, laser, spawn minions)
- **Purified**: Full blue sky, birds appear, rainbow, lush green everywhere

### Mechanics
- **Purification Meter**: Fills as you collect crystals and defeat enemies. At 80%, zone boss activates.
- **World Healing**: Defeating a boss triggers a dramatic color wave sweep across the zone.
- **Wind Currents**: Visible animated particles that carry the player when entered.
- **Parallax Scrolling**: 3 layers of background depth.
- **Environmental facts** displayed on death and victory screens.

### HUD
- Health (5 hearts), Score, Purification meter, Zone indicator, Dash cooldown, Crystal counter

---

## Experience 3: Jugaad Runner — The Scrappy Eco Warrior

### What Is It?
A funny, fast-paced auto-scrolling side-scroller where a scrappy kid with a recycled jetpack fights trash monsters with improvised weapons. Environmental awareness meets Bollywood absurdity.

### Character: The Jugaad Hero
- 36×44 pixel sprite drawn programmatically on canvas
- Kid with goggles, patchwork vest, jetpack made of tin cans and bamboo
- Animated states: run (legs pumping, jetpack sputtering), jump (flames burst), double-jump (spinning flip), shoot (recoil), hit (goggles askew), death (goggles fly off)

### Controls
| Key | Action |
|-----|--------|
| Space / Up / W | Jump (double tap = double jump) |
| S / Down | Slide (duck under flying enemies) |
| Z / Click | Shoot current weapon |
| 1-4 / Scroll | Switch weapon |

### Weapons (Unlock by Score)

| Weapon | Unlock | Damage | Special |
|--------|--------|--------|---------|
| **Water Cannon** | Default | 1 | Medium range, blue stream |
| **Solar Beam** | 500 pts | 2 | Long range, golden laser, slower fire rate |
| **Recycling Ray** | 1500 pts | 1 | Medium range, green spiral, piercing (hits multiple) |
| **Nature's Wrath** | 3000 pts | 3 | Short range, vine whip, area effect |

### Enemies

| Enemy | HP | Behavior | Visual |
|-------|------|----------|--------|
| **Plastic Bottle Monster** | 1 | Bouncy, hops toward player | Transparent blue body, cap as hat, googly eyes |
| **Oil Slick Blob** | 2 | Leaves slippery trail | Black/rainbow iridescent blob |
| **Smoke Stack Golem** | 3 | Puffs damaging smoke clouds | Tall grey rectangle with pipe arms |
| **Tire Pile Spider** | 2 | Fast, erratic movement | Stack of tires with 6 tire-legs |
| **E-Waste Gremlin** | 1 | Swarms, throws sparks | Circuit boards and wires |
| **Styrofoam Phantom** | 1 | Floats, phases in/out | White ghost-like, evasive |

### Boss Fights (Every 500 distance)

| Boss | Distance | HP | Attack Pattern |
|------|----------|-----|---------------|
| **Mega Landfill Monster** | 500m | 10 | Huge trash mound with face, throws garbage. Weak spot: shopping bag "crown" |
| **Corporate Polluter Robot** | 1000m | 15 | Robot in business suit, shoots smokestack missiles and dollar bills. Vulnerable during "profit report" taunt |
| **The Great Pacific Garbage Patch** | 1500m | 20 | Massive wave of plastic, attacks with plastic tentacles. Must hit the glowing core |

### Combo System
- Chain kills within 2 seconds build a combo multiplier
- **x2**: "REDUCE!" (green)
- **x3**: "REUSE!" (blue)
- **x5**: "RECYCLE!" (gold with sparkles)
- **x10**: "JUGAAD MASTER!" (massive text + screen flash)
- Multiplier applies to score

### Funny Death Quips (Random on Game Over)
- "Even the trash is disappointed in you."
- "The ocean called. It wants its plastic back."
- "Plot twist: YOU were the pollution all along."
- "Greta Thunberg would NOT be impressed."
- "Achievement unlocked: Maximum Disappointment"
- ...and 10 more

### World Healing
Background transitions from polluted wasteland → green paradise as score increases:
- 0–500: Grey sky, brown ground, dead trees
- 500–1000: Patches of grass, sky lightening
- 1000–2000: Blue sky patches, small trees growing
- 2000+: Full blue sky, green trees, flowers, birds

### Game Feel
- Screen shake on hits
- Particle explosions (colored confetti on enemy death)
- Comic book text popups ("POW!", "SPLAT!", "WHOOSH!")
- Speed lines during dash
- Enemies have idle animations (bobbing, blinking)

---

## Environmental Impact & Education

### Facts Presented to Players
- 8 million tons of plastic enter the ocean every year
- The Great Pacific Garbage Patch is twice the size of Texas
- Air pollution causes 7 million premature deaths annually
- 10 million hectares of forest lost every year
- Only 9% of all plastic ever produced has been recycled
- By 2050, more plastic than fish in the ocean by weight
- Indoor air can be 2–5x more polluted than outdoor air
- The ozone layer won't fully recover until 2066
- E-waste is the fastest growing waste stream in the world
- The fashion industry produces 10% of global carbon emissions

### The Twist
The Assembler experience makes the environmental message deeply personal:
> *"You tried to preserve nature using a machine that burns it. That is the real Jugaad — surviving on borrowed time."*

Every API call (LLM + STT + TTS) consumes energy. The session's total CO2 cost is calculated and displayed. The player realizes they contributed to the problem while trying to help.

---

## Running the Project

```bash
cd jugaad
pip install -r requirements.txt
# Create .env with OPENAI_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY
uvicorn server:app --host 0.0.0.0 --port 8000
```

Visit **http://localhost:8000**

---

## Team
Built for **DonsHack '26** — University of San Francisco

*"Where innovation meets desperation. Where survival becomes art."*
