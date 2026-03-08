/* ==========================================================================
   Project Jugaad — The Art of Survival
   Game Engine

   Modules:
     1. State         — mutable app state
     2. Waveform      — canvas audio visualizer
     3. Audio         — mic capture + MP3 playback
     4. Connection    — WebSocket lifecycle
     5. UI            — DOM rendering, screen transitions
     6. Cards         — memory card generation
     7. Reveal        — glitch animation + terminal mode
     8. Modes         — fetch + render mode selection
     9. Game          — start/end orchestration
    10. Init          — bootstrap
   ========================================================================== */

/* ---------- 1. State ---------- */
const State = {
    ws: null,
    selectedMode: null,
    micStream: null,
    micProcessor: null,
    analyserNode: null,
    isInGame: false,
    isTTSPlaying: false,
    isSessionReady: false,
    isRevealed: false,
    isRecording: false,
    isTerminalMode: false,
    terminalMessages: [],
};

/* ---------- 2. Waveform ---------- */
const Waveform = {
    canvas: null,
    ctx: null,
    animId: null,
    bars: 80,
    _mode: 'idle',

    init() {
        this.canvas = document.getElementById('waveform-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this._resize();
        window.addEventListener('resize', () => this._resize());
        this._animate();
    },

    _resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this._w = rect.width;
        this._h = rect.height;
    },

    setMode(mode) {
        this._mode = mode;
        const label = document.getElementById('waveform-label');
        if (label) {
            label.textContent = mode === 'idle' ? 'THE ASSEMBLER' : '';
            label.classList.toggle('hidden', mode !== 'idle');
        }
    },

    _animate() {
        const draw = () => {
            this.animId = requestAnimationFrame(draw);
            if (!this.ctx) return;
            const { ctx, _w: w, _h: h } = this;
            ctx.clearRect(0, 0, w, h);

            if (this._mode === 'idle') this._drawIdle(w, h);
            else if (this._mode === 'listening') this._drawLive(w, h, '#ffd8a2', 0.5);
            else if (this._mode === 'speaking') this._drawLive(w, h, '#ffd8a2', 1.0);
        };
        draw();
    },

    _drawIdle(w, h) {
        const { ctx } = this;
        const t = Date.now() / 1000;
        const barW = w / this.bars;
        const mid = h / 2;

        for (let i = 0; i < this.bars; i++) {
            const x = i * barW;
            const wave = Math.sin(t * 0.6 + i * 0.12) * 3 + 3;
            ctx.fillStyle = `rgba(255, 216, 162, ${0.06 + Math.sin(t + i * 0.15) * 0.03})`;
            ctx.fillRect(x + 1, mid - wave, barW - 2, wave * 2);
        }
    },

    _drawLive(w, h, color, intensity) {
        const { ctx } = this;
        const barW = w / this.bars;
        const mid = h / 2;
        const t = Date.now() / 1000;

        let dataArray = null;
        if (State.analyserNode) {
            dataArray = new Uint8Array(State.analyserNode.frequencyBinCount);
            State.analyserNode.getByteFrequencyData(dataArray);
        }

        for (let i = 0; i < this.bars; i++) {
            const x = i * barW;
            let barH;

            if (dataArray) {
                const index = Math.floor(i * dataArray.length / this.bars);
                barH = (dataArray[index] / 255) * (h * 0.4) * intensity;
            } else {
                barH = (Math.sin(t * 3 + i * 0.3) * 0.5 + 0.5) * h * 0.2 * intensity;
            }

            barH = Math.max(barH, 1);
            const alpha = 0.2 + (barH / (h * 0.4)) * 0.8;

            ctx.fillStyle = color;
            ctx.globalAlpha = alpha;
            ctx.fillRect(x + 1, mid - barH, barW - 2, barH * 2);
        }
        ctx.globalAlpha = 1;
    },

    stop() {
        if (this.animId) cancelAnimationFrame(this.animId);
    },
};

/* ---------- 3. Audio ---------- */
const AudioEngine = {
    _current: null,
    _playbackCtx: null,  // Dedicated AudioContext for TTS playback

    _getPlaybackCtx() {
        if (!this._playbackCtx || this._playbackCtx.state === 'closed') {
            this._playbackCtx = new AudioContext();
        }
        if (this._playbackCtx.state === 'suspended') {
            this._playbackCtx.resume();
        }
        return this._playbackCtx;
    },

    async startMic() {
        State.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        const micCtx = new AudioContext({ sampleRate: 16000 });
        const source = micCtx.createMediaStreamSource(State.micStream);

        const analyser = micCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        State.analyserNode = analyser;

        const processor = micCtx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
            if (!State.ws || State.ws.readyState !== WebSocket.OPEN) return;
            if (!State.isSessionReady) return;
            // Always send audio — server-side _user_recording flag controls
            // whether transcripts are processed, and the Deepgram KeepAlive
            // loop on the server prevents the 10s timeout (NET-0001).
            // Skipping during TTS avoids echo but still keeps the connection fed.
            if (State.isTTSPlaying) return;

            const float32 = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
                const s = Math.max(-1, Math.min(1, float32[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            State.ws.send(int16.buffer);
        };

        source.connect(processor);
        const silentGain = micCtx.createGain();
        silentGain.gain.value = 0;
        processor.connect(silentGain);
        silentGain.connect(micCtx.destination);

        State.micProcessor = { processor, source, ctx: micCtx };
    },

    stopMic() {
        State.analyserNode = null;
        if (State.micProcessor) {
            State.micProcessor.processor.disconnect();
            State.micProcessor.source.disconnect();
            State.micProcessor.ctx.close();
            State.micProcessor = null;
        }
        if (State.micStream) {
            State.micStream.getTracks().forEach(t => t.stop());
            State.micStream = null;
        }
    },

    playMP3(arrayBuffer) {
        this.stopPlayback();

        const ctx = this._getPlaybackCtx();
        // decodeAudioData needs a copy since it detaches the buffer
        const copy = arrayBuffer.slice(0);

        ctx.decodeAudioData(copy, (audioBuffer) => {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);

            source.onended = () => {
                this._current = null;
                State.isTTSPlaying = false;
                if (State.isInGame && !State.isRevealed) {
                    UI.setStatus('listening', 'Your turn — press Speak');
                    Waveform.setMode('listening');
                    SpeakBtn.enable();
                }
            };

            this._current = source;
            source.start(0);
        }, (err) => {
            console.error('Audio decode error:', err);
            State.isTTSPlaying = false;
            SpeakBtn.enable();
        });
    },

    stopPlayback() {
        if (this._current) {
            try { this._current.stop(); } catch (e) { /* already stopped */ }
            this._current = null;
        }
    },

};

/* ---------- 4. Connection ---------- */
const Connection = {
    open() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        State.ws = new WebSocket(`${protocol}//${location.host}/ws`);
        State.ws.binaryType = 'arraybuffer';

        State.ws.onopen = () => {
            UI.setStatus('active', 'Connected...');
            State.ws.send(JSON.stringify({
                type: 'start',
                mode: State.selectedMode.key,
            }));
        };

        State.ws.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                AudioEngine.playMP3(event.data);
                return;
            }
            this._handleMessage(JSON.parse(event.data));
        };

        State.ws.onclose = () => {
            if (State.isInGame) Game.end(false);
        };

        State.ws.onerror = () => {
            UI.addMessage('System', 'Connection error.', 'system');
        };
    },

    sendStop() {
        if (State.ws && State.ws.readyState === WebSocket.OPEN) {
            State.ws.send(JSON.stringify({ type: 'stop' }));
            setTimeout(() => { if (State.ws) State.ws.close(); }, 3000);
        }
    },

    _handleMessage(msg) {
        switch (msg.type) {
            case 'ready':
                State.isSessionReady = true;
                // Don't enable Speak yet — wait for greeting TTS to finish playing.
                // The Speak button is enabled in AudioEngine.playMP3 → source.onended.
                break;

            case 'transcript':
                if (!msg.is_final) UI.updateInterim(msg.text);
                break;

            case 'user_text':
                UI.clearInterim();
                UI.addMessage('You', msg.text, 'user');
                UI.setStatus('active', 'Processing...');
                State.isRecording = false;
                SpeakBtn.disable();
                SpeakBtn.resetVisual();
                State.terminalMessages.push({ speaker: 'You', text: msg.text });

                // Check for "save energy" command
                if (msg.text.toLowerCase().includes('save energy')) {
                    Reveal.enterTerminal();
                }
                break;

            case 'assembler_text':
                UI.addMessage('The Assembler', msg.text, 'assembler');
                State.terminalMessages.push({ speaker: 'Assembler', text: msg.text });
                break;

            case 'memory_card':
                Cards.add(msg.text, msg.co2, msg.card_number);
                UI.updateCO2(msg.co2);
                break;

            case 'tts_start':
                State.isTTSPlaying = true;
                State.isRecording = false;
                SpeakBtn.disable();
                UI.setStatus('speaking', 'The Assembler is speaking...');
                Waveform.setMode('speaking');
                break;

            case 'tts_end':
                break;

            case 'reveal_start':
                Reveal.start();
                break;

            case 'reveal_complete':
                Reveal.showImpact(msg.co2_total, msg.memories);
                break;

            case 'error':
                UI.addMessage('System', msg.message, 'system');
                break;
        }
    },
};

/* ---------- 5. UI ---------- */
const UI = {
    els: {},
    _interimDiv: null,

    init() {
        this.els = {
            screenLanding: document.getElementById('screen-landing'),
            screenGame: document.getElementById('screen-game'),
            modeGrid: document.getElementById('mode-grid'),
            btnLaunch: document.getElementById('btn-launch'),
            statusDot: document.getElementById('status-dot'),
            statusText: document.getElementById('status-text'),
            transcript: document.getElementById('transcript'),
            co2Value: document.getElementById('co2-value'),
            revealOverlay: document.getElementById('reveal-overlay'),
            revealImpact: document.getElementById('reveal-impact'),
            cardsGallery: document.getElementById('cards-gallery'),
            terminalOverlay: document.getElementById('terminal-overlay'),
            terminalBody: document.getElementById('terminal-body'),
        };

        this.els.btnLaunch.addEventListener('click', () => Game.start());
    },

    switchScreen(from, to) {
        from.classList.remove('active');
        to.classList.add('active');
        window.scrollTo(0, 0);
    },

    setStatus(state, text) {
        const dot = this.els.statusDot;
        if (dot) {
            dot.className = 'status-dot';
            if (state) dot.classList.add(state);
        }
        if (this.els.statusText) {
            this.els.statusText.textContent = text;
        }
    },

    addMessage(speaker, text, type) {
        const empty = this.els.transcript.querySelector('.transcript-empty');
        if (empty) empty.style.display = 'none';

        const div = document.createElement('div');
        div.className = `msg ${type}`;
        div.innerHTML = `<div class="msg-speaker">${this._esc(speaker)}</div><div class="msg-text">${this._esc(text)}</div>`;
        this.els.transcript.appendChild(div);
        this.els.transcript.scrollTop = this.els.transcript.scrollHeight;
    },

    updateInterim(text) {
        if (!this._interimDiv) {
            this._interimDiv = document.createElement('div');
            this._interimDiv.className = 'msg user interim';
            this._interimDiv.innerHTML = '<div class="msg-speaker">You (listening...)</div><div class="msg-text"></div>';
            this.els.transcript.appendChild(this._interimDiv);
        }
        this._interimDiv.querySelector('.msg-text').textContent = text;
        this.els.transcript.scrollTop = this.els.transcript.scrollHeight;
    },

    clearInterim() {
        if (this._interimDiv) {
            this._interimDiv.remove();
            this._interimDiv = null;
        }
    },

    updateCO2(value) {
        const el = this.els.co2Value;
        if (!el) return;
        el.textContent = value + 'g';
        const num = parseFloat(value);
        el.className = 'co2-value';
        if (num > 15) el.classList.add('danger');
        else if (num > 8) el.classList.add('warning');
    },

    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};

/* ---------- 6. Cards ---------- */
const Cards = {
    add(text, co2, number) {
        const gallery = UI.els.cardsGallery;
        if (!gallery) return;

        const card = document.createElement('div');
        card.className = 'memory-card';
        card.innerHTML = `
            <div class="memory-card-number">Memory ${number}</div>
            <div class="memory-card-text">"${UI._esc(text)}"</div>
            <div class="memory-card-co2">CO2: ${co2}g</div>
        `;
        gallery.appendChild(card);
        card.scrollIntoView({ behavior: 'smooth', inline: 'end' });
    },
};

/* ---------- 7. Reveal ---------- */
const Reveal = {
    start() {
        State.isRevealed = true;

        // Trigger glitch animation
        document.body.classList.add('glitching');

        const overlay = UI.els.revealOverlay;
        overlay.classList.add('active');

        // After glitch frames, apply dark theme
        setTimeout(() => {
            document.body.classList.remove('glitching');
            document.body.classList.add('revealed');
            overlay.classList.add('glitching');
            Waveform.setMode('speaking');
        }, 1000);
    },

    showImpact(co2Total, memories) {
        const impact = UI.els.revealImpact;
        if (!impact) return;

        impact.innerHTML = `
            <div class="impact-stat">
                <div class="impact-num">${co2Total}g</div>
                <div class="impact-label">CO2 This Session</div>
            </div>
            <div class="impact-stat">
                <div class="impact-num">${memories.length}</div>
                <div class="impact-label">Memories Archived</div>
            </div>
            <div class="impact-stat">
                <div class="impact-num">10M</div>
                <div class="impact-label">Hectares Lost / Year</div>
            </div>
        `;

        UI.setStatus('', 'The truth has been revealed.');
    },

    enterTerminal() {
        State.isTerminalMode = true;
        const overlay = UI.els.terminalOverlay;
        const body = UI.els.terminalBody;

        let html = '<p class="t-dim">// True Jugaad: use exactly what is necessary. No more, no less.</p>';
        html += '<p class="t-dim">// All visual effects disabled. Raw data only.</p>';
        html += '<p>&nbsp;</p>';

        State.terminalMessages.forEach(m => {
            const cls = m.speaker === 'You' ? 't-bright' : '';
            html += `<p><span class="t-dim">[${m.speaker}]</span> <span class="${cls}">${UI._esc(m.text)}</span></p>`;
        });

        body.innerHTML = html;
        overlay.classList.add('active');
    },

    exitTerminal() {
        State.isTerminalMode = false;
        UI.els.terminalOverlay.classList.remove('active');
    },
};

/* ---------- 8. Modes ---------- */
const Modes = {
    ICONS: {
        leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 17 3.5s4 2 4 9-9.6 7-9.6 7z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
        waves: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>',
        cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>',
    },

    async load() {
        const resp = await fetch('/api/modes');
        const modes = await resp.json();
        const grid = UI.els.modeGrid;
        grid.innerHTML = '';

        modes.forEach(m => {
            const card = document.createElement('div');
            card.className = 'mode-card';
            card.style.setProperty('--card-color', m.color);

            card.innerHTML = `
                <div class="mode-icon" style="color:${m.color}">${this.ICONS[m.icon] || ''}</div>
                <div class="mode-name">${m.name}</div>
                <div class="mode-desc">${m.description}</div>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                State.selectedMode = m;
                UI.els.btnLaunch.disabled = false;

                // Update CSS custom properties for mode color
                document.documentElement.style.setProperty('--mode-color', m.color);
            });

            grid.appendChild(card);
        });
    },
};

/* ---------- 9. Speak Button (Push-to-Talk) ---------- */
const SpeakBtn = {
    btn: null,
    label: null,
    hint: null,

    init() {
        this.btn = document.getElementById('btn-speak');
        this.label = document.getElementById('btn-speak-label');
        this.hint = document.getElementById('speak-hint');
        if (!this.btn) return;

        this.btn.addEventListener('click', () => this.toggle());
    },

    toggle() {
        if (State.isTTSPlaying || !State.isSessionReady) return;

        if (State.isRecording) {
            // Stop recording — tell server to flush Deepgram's buffer
            State.isRecording = false;
            this.resetVisual();
            this.disable();
            UI.setStatus('active', 'Processing...');
            Waveform.setMode('idle');

            if (State.ws && State.ws.readyState === WebSocket.OPEN) {
                State.ws.send(JSON.stringify({ type: 'stop_recording' }));
            }
        } else {
            // Start recording
            State.isRecording = true;
            this.btn.classList.add('recording');
            this.label.textContent = 'Stop';
            this.hint.textContent = 'Recording... press again to stop';
            this.hint.classList.add('recording');
            UI.setStatus('listening', 'Recording...');
            Waveform.setMode('listening');
            
            // Tell server we're starting recording
            if (State.ws && State.ws.readyState === WebSocket.OPEN) {
                State.ws.send(JSON.stringify({ type: 'start_recording' }));
            }
        }
    },

    enable() {
        if (this.btn) this.btn.disabled = false;
    },

    disable() {
        if (this.btn) this.btn.disabled = true;
    },

    resetVisual() {
        if (!this.btn) return;
        this.btn.classList.remove('recording');
        if (this.label) this.label.textContent = 'Speak';
        if (this.hint) {
            this.hint.textContent = 'Press to record your memory';
            this.hint.classList.remove('recording');
        }
    },
};

/* ---------- 10. Game ---------- */
const Game = {
    async start() {
        if (!State.selectedMode) return;

        State.isInGame = true;
        State.isTTSPlaying = false;
        State.isSessionReady = false;
        State.isRevealed = false;
        State.isRecording = false;
        State.isTerminalMode = false;
        State.terminalMessages = [];

        // Reset UI
        UI.els.cardsGallery.innerHTML = '';
        UI.els.revealOverlay.classList.remove('active', 'glitching');
        UI.els.terminalOverlay.classList.remove('active');
        document.body.classList.remove('glitching', 'revealed');

        const empty = UI.els.transcript.querySelector('.transcript-empty');
        UI.els.transcript.querySelectorAll('.msg').forEach(m => m.remove());
        if (empty) empty.style.display = '';

        UI.updateCO2('0.0');
        SpeakBtn.resetVisual();
        SpeakBtn.disable();

        // Initialize playback context on user gesture (avoids autoplay block)
        AudioEngine._getPlaybackCtx();

        // Switch to game screen
        UI.switchScreen(UI.els.screenLanding, UI.els.screenGame);
        Waveform.init();
        Waveform.setMode('idle');
        UI.setStatus('active', 'Connecting...');

        await AudioEngine.startMic();
        Connection.open();
    },

    end(sendStop = true) {
        State.isInGame = false;
        if (sendStop) Connection.sendStop();
        AudioEngine.stopMic();
        AudioEngine.stopPlayback();
        UI.clearInterim();
        Waveform.setMode('idle');
    },
};

/* ---------- 10. Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    SpeakBtn.init();
    Modes.load();
});
