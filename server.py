"""
Project Jugaad — Voice Game Server

Audio flow:
    Browser mic (linear16 16kHz) -> WebSocket -> Deepgram STT -> OpenAI ->
    ElevenLabs TTS (mp3_44100_128) -> WebSocket -> Browser Audio playback

Usage:
    uvicorn server:app --host 0.0.0.0 --port 8000
"""

import asyncio
import json
import logging
import os
from functools import partial

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI

from personas import get_mode, list_modes, BASE_SYSTEM, CO2_PER_EXCHANGE

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Jugaad — The Art of Survival")
app.mount("/static", StaticFiles(directory="static"), name="static")

_openai_client: OpenAI | None = None


def get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key or api_key == "your-openai-key-here":
            raise RuntimeError("OPENAI_API_KEY not set in .env")
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


@app.get("/")
async def index():
    return FileResponse("static/index.html")


@app.get("/game")
async def game():
    return FileResponse("static/game.html")


@app.get("/api/modes")
async def api_modes():
    return list_modes()


@app.websocket("/ws")
async def websocket_handler(ws: WebSocket):
    await ws.accept()
    logger.info("Browser WebSocket connected")

    session: GameSession | None = None

    try:
        while True:
            msg = await ws.receive()

            if msg.get("type") == "websocket.disconnect":
                break

            if "bytes" in msg and msg["bytes"] and session:
                await session.feed_audio(msg["bytes"])
                continue

            if "text" in msg and msg["text"]:
                data = json.loads(msg["text"])
                cmd = data.get("type", "")

                if cmd == "start":
                    mode_key = data.get("mode", "garden")
                    if session:
                        await session.close()
                    session = GameSession(
                        ws=ws,
                        mode_key=mode_key,
                        openai_client=get_openai_client(),
                    )
                    await session.start()

                elif cmd == "start_recording":
                    if session:
                        session._user_recording = True
                        logger.info("User started recording")

                elif cmd == "stop_recording":
                    if session:
                        await session.flush_transcript()
                        session._user_recording = False
                        logger.info("User stopped recording")

                elif cmd == "stop":
                    if session:
                        await session.close()
                        session = None

    except WebSocketDisconnect:
        logger.info("Browser WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
    finally:
        if session:
            await session.close()


class GameSession:
    """
    Manages a single Jugaad game session.

    Phases:
        0 = greeting (Assembler introduces, asks first question)
        1 = question 1 response received, ask question 2
        2 = question 2 response received, trigger reveal
        3 = revealed (game over)
    """

    def __init__(self, ws: WebSocket, mode_key: str, openai_client: OpenAI):
        self.ws = ws
        self.mode_key = mode_key
        self.mode = get_mode(mode_key)
        self.client = openai_client
        self.phase = 0
        self.exchange_count = 0
        self.co2_total = 0.0
        self.memory_cards: list[str] = []

        self.messages: list[dict] = [
            {"role": "system", "content": BASE_SYSTEM}
        ]

        self._llm_lock = asyncio.Lock()
        self._ws_lock = asyncio.Lock()
        self._dg = None
        self._closed = False
        self._user_recording = False

    async def start(self):
        from audio import DeepgramStream

        dg_key = os.getenv("DEEPGRAM_API_KEY", "")
        self._dg = DeepgramStream(
            api_key=dg_key,
            on_transcript=self._on_transcript,
            encoding="linear16",
            sample_rate=16000,
        )
        await self._dg.connect()

        # Send greeting via TTS
        greeting = self.mode["greeting"]
        self.messages.append({"role": "assistant", "content": greeting})

        await self._send_json({"type": "assembler_text", "text": greeting})
        await self._stream_tts(greeting)
        await self._send_json({"type": "ready"})

        self.phase = 1
        self.co2_total += CO2_PER_EXCHANGE  # greeting costs CO2 too

    async def feed_audio(self, audio_bytes: bytes):
        if self._dg:
            await self._dg.send_audio(audio_bytes)

    async def flush_transcript(self):
        """Force Deepgram to emit any accumulated transcript (push-to-talk)."""
        logger.info("Flushing Deepgram transcript buffer")
        if self._dg:
            await self._dg.flush()

    async def _on_transcript(self, text: str, is_final: bool):
        if self._closed:
            return

        # Only process transcripts while user is actively recording;
        # ambient audio keeps Deepgram alive but is ignored.
        if not self._user_recording:
            return

        if not is_final or not text.strip():
            await self._send_json({
                "type": "transcript",
                "text": text,
                "is_final": is_final,
            })
            return

        async with self._llm_lock:
            await self._send_json({"type": "user_text", "text": text})

            self.messages.append({"role": "user", "content": text})
            self.exchange_count += 1
            self.co2_total += CO2_PER_EXCHANGE

            # Create memory card from user's words
            card_text = text[:200]  # Truncate long responses
            self.memory_cards.append(card_text)
            await self._send_json({
                "type": "memory_card",
                "text": card_text,
                "co2": f"{self.co2_total:.1f}",
                "card_number": len(self.memory_cards),
            })

            logger.info(f"User (exchange {self.exchange_count}): {text}")

            if self.phase == 1:
                # After first answer, ask the second question
                question = self.mode["questions"][0]
                self.messages.append({"role": "assistant", "content": question})

                await self._send_json({"type": "assembler_text", "text": question})
                await self._stream_tts(question)
                self.phase = 2
                self.co2_total += CO2_PER_EXCHANGE

            elif self.phase == 2:
                # After second answer, trigger the reveal
                self.co2_total += CO2_PER_EXCHANGE
                reveal_text = self.mode["reveal"].format(co2=self.co2_total)
                self.messages.append({"role": "assistant", "content": reveal_text})

                await self._send_json({"type": "reveal_start"})
                await asyncio.sleep(1.5)  # Let the glitch animation play

                await self._send_json({"type": "assembler_text", "text": reveal_text})
                await self._stream_tts(reveal_text)
                await self._send_json({
                    "type": "reveal_complete",
                    "co2_total": f"{self.co2_total:.1f}",
                    "memories": self.memory_cards,
                })
                self.phase = 3

            else:
                # Post-reveal: use LLM for freeform conversation
                response = await self._get_llm_response()
                self.messages.append({"role": "assistant", "content": response})
                await self._send_json({"type": "assembler_text", "text": response})
                await self._stream_tts(response)

    async def _get_llm_response(self) -> str:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            partial(
                self.client.chat.completions.create,
                model="gpt-4o-mini",
                messages=self.messages,
                temperature=0.8,
                max_tokens=200,
            ),
        )
        return response.choices[0].message.content

    async def _stream_tts(self, text: str):
        from audio import ElevenLabsTTS

        el_key = os.getenv("ELEVENLABS_API_KEY", "")
        voice_id = self.mode.get("voice_id", "onwK4e9ZLuTAKqWW03F9")
        tts = ElevenLabsTTS(
            api_key=el_key,
            voice_id=voice_id,
            output_format="mp3_44100_128",
        )
        try:
            await self._send_json({"type": "tts_start"})
            mp3_chunks = []
            async for chunk in tts.stream_tts(text):
                mp3_chunks.append(chunk)
            if mp3_chunks:
                await self._send_bytes(b"".join(mp3_chunks))
            await self._send_json({"type": "tts_end"})
        finally:
            await tts.close()

    async def _send_json(self, data: dict):
        async with self._ws_lock:
            await self.ws.send_json(data)

    async def _send_bytes(self, data: bytes):
        async with self._ws_lock:
            await self.ws.send_bytes(data)

    async def close(self):
        if self._closed:
            return
        self._closed = True
        if self._dg:
            await self._dg.close()
        logger.info(f"Game session closed (mode={self.mode_key}, exchanges={self.exchange_count})")
