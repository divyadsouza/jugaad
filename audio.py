"""
Async audio clients for Project Jugaad.
Deepgram WebSocket STT and ElevenLabs streaming TTS.

Adapted from the ClearOne Advantage negotiator project.
"""

import asyncio
import json
import logging
from typing import Callable, Awaitable

import httpx
import websockets
from websockets.protocol import State as WsState

logger = logging.getLogger(__name__)


class DeepgramStream:
    """
    Persistent WebSocket connection to Deepgram's streaming STT API.
    Accepts raw linear16 16kHz audio bytes from the browser mic
    and fires an async callback when a complete utterance is ready.
    """

    STT_URL = "wss://api.deepgram.com/v1/listen"

    def __init__(
        self,
        api_key: str,
        on_transcript: Callable[[str, bool], Awaitable[None]],
        *,
        encoding: str = "linear16",
        sample_rate: int = 16000,
        utterance_end_ms: int = 1500,
        endpointing: int = 500,
    ):
        self.api_key = api_key
        self.on_transcript = on_transcript
        self._ws = None
        self._recv_task = None
        self._utterance_parts: list[str] = []
        self._interim_text = ""

        self._params = {
            "encoding": encoding,
            "sample_rate": str(sample_rate),
            "channels": "1",
            "model": "nova-2",
            "punctuate": "true",
            "smart_format": "true",
            "utterance_end_ms": str(utterance_end_ms),
            "endpointing": str(endpointing),
            "interim_results": "true",
        }

    async def connect(self):
        query = "&".join(f"{k}={v}" for k, v in self._params.items())
        url = f"{self.STT_URL}?{query}"
        headers = {"Authorization": f"Token {self.api_key}"}
        self._ws = await websockets.connect(url, additional_headers=headers)
        self._recv_task = asyncio.create_task(self._receive_loop())
        logger.info("Deepgram WebSocket connected")

    async def send_audio(self, audio_bytes: bytes):
        if self._ws and self._ws.state == WsState.OPEN:
            await self._ws.send(audio_bytes)

    async def flush(self):
        """Force-fire the callback with any accumulated transcript parts.

        Call this when the user explicitly stops recording — don't wait
        for Deepgram's UtteranceEnd which requires sustained silence audio.
        """
        if self._utterance_parts:
            full_text = " ".join(self._utterance_parts)
            self._utterance_parts.clear()
            self._interim_text = ""
            logger.info(f"Flush: firing transcript: {full_text}")
            await self.on_transcript(full_text, True)
        else:
            logger.info("Flush: no accumulated utterance parts")

    async def close(self):
        if self._ws and self._ws.state == WsState.OPEN:
            await self._ws.send(json.dumps({"type": "CloseStream"}))
            await self._ws.close()
        if self._recv_task:
            self._recv_task.cancel()
            try:
                await self._recv_task
            except asyncio.CancelledError:
                pass
        logger.info("Deepgram WebSocket closed")

    async def _receive_loop(self):
        try:
            async for raw_msg in self._ws:
                msg = json.loads(raw_msg)
                msg_type = msg.get("type", "")

                if msg_type == "Results":
                    alt = msg.get("channel", {}).get("alternatives", [{}])[0]
                    transcript = alt.get("transcript", "").strip()
                    is_final = msg.get("is_final", False)

                    if is_final and transcript:
                        self._utterance_parts.append(transcript)
                        self._interim_text = ""
                    elif not is_final and transcript:
                        self._interim_text = transcript
                        preview = " ".join(self._utterance_parts + [transcript])
                        await self.on_transcript(preview, False)

                elif msg_type == "UtteranceEnd":
                    if self._utterance_parts:
                        full_text = " ".join(self._utterance_parts)
                        self._utterance_parts.clear()
                        self._interim_text = ""
                        await self.on_transcript(full_text, True)

        except websockets.ConnectionClosed:
            logger.info("Deepgram WebSocket connection closed")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Deepgram receive error: {e}")


class ElevenLabsTTS:
    """
    Async ElevenLabs TTS client using the streaming HTTP endpoint.
    Streams MP3 audio for browser playback.
    """

    TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"

    def __init__(
        self,
        api_key: str,
        voice_id: str = "onwK4e9ZLuTAKqWW03F9",  # Daniel — calm, authoritative
        model_id: str = "eleven_flash_v2_5",
        output_format: str = "mp3_44100_128",
    ):
        self.api_key = api_key
        self.voice_id = voice_id
        self.model_id = model_id
        self.output_format = output_format
        self._client = httpx.AsyncClient(timeout=30.0)

    async def stream_tts(self, text: str):
        url = self.TTS_URL.format(voice_id=self.voice_id)
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": self.model_id,
            "output_format": self.output_format,
        }

        async with self._client.stream(
            "POST", url, json=payload, headers=headers
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                logger.error(f"ElevenLabs TTS error {response.status_code}: {body}")
                return

            async for data in response.aiter_bytes(4096):
                yield data

    async def close(self):
        await self._client.aclose()
