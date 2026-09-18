from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, Optional, List

class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, language_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio bytes to text.
        Returns dict with keys: 'transcript', 'detected_language', 'confidence', 'latency_ms'
        """
        pass

class LLMProvider(ABC):
    @abstractmethod
    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.6,
        max_tokens: int = 150
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Yields chunks with: {'token': str, 'first_token': bool, 'ttft_ms': float, 'done': bool}
        """
        pass

class TTSProvider(ABC):
    @abstractmethod
    async def synthesize_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: Optional[str] = "en"
    ) -> bytes:
        """
        Synthesize text into audio bytes (WAV/MP3).
        """
        pass

    @abstractmethod
    def list_voices(self, gender: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Return available voices from provider.
        """
        pass
