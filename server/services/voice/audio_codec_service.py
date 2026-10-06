"""
SARA AI — Audio Codec Service
Provides high-performance, zero-external-dependency audio transcoding:
- Twilio G.711 μ-law (8kHz mono) <-> Linear PCM 16-bit
- Resampling (24kHz / 16kHz <-> 8kHz)
- Twilio media packet chunking (20ms frames = 160 bytes)
- Base64 encoding/decoding for Twilio Bidirectional Media Streams
"""
import base64
import struct
from typing import List, Tuple

# Precompute ITU-T G.711 μ-law <-> PCM tables for sub-millisecond execution
BIAS = 0x84
CLIP = 32635

# 1. μ-law (uint8) -> Linear PCM 16-bit (signed int16)
MULAW_TO_PCM = []
for b in range(256):
    inverted = ~b & 0xFF
    sign = -1 if (inverted & 0x80) else 1
    exponent = (inverted >> 4) & 0x07
    mantissa = inverted & 0x0F
    sample = (mantissa << 3) + 0x84
    sample <<= exponent
    sample -= 0x84
    sample *= sign
    MULAW_TO_PCM.append(sample)

# Pack into pre-formed binary struct for instantaneous decoding
_MULAW_DECODE_STRUCT = struct.Struct('<' + 'h' * 256)
_MULAW_LOOKUP_BYTES = [struct.pack('<h', s) for s in MULAW_TO_PCM]


# 2. Linear PCM 16-bit (signed int16) -> μ-law (uint8)
def _pcm_sample_to_ulaw(sample: int) -> int:
    sign = 0x80 if sample < 0 else 0
    if sample < 0:
        sample = -sample
    if sample > CLIP:
        sample = CLIP
    sample += BIAS
    exponent = 7
    for exp in range(7, -1, -1):
        if sample & (1 << (exp + 7)):
            exponent = exp
            break
    mantissa = (sample >> (exponent + 3)) & 0x0F
    return (~(sign | (exponent << 4) | mantissa)) & 0xFF

PCM_TO_MULAW_TABLE = bytearray(65536)
for i in range(65536):
    s = i - 32768
    PCM_TO_MULAW_TABLE[i] = _pcm_sample_to_ulaw(s)


class AudioCodecService:
    """
    Real-time audio transcoding for Twilio Programmable Voice Media Streams,
    Deepgram STT streaming, and Cartesia TTS streaming.
    """

    @staticmethod
    def decode_mulaw_to_pcm16(mulaw_bytes: bytes) -> bytes:
        """
        Convert G.711 μ-law (8kHz mono) bytes into 16-bit signed PCM (8kHz mono).
        """
        if not mulaw_bytes:
            return b""
        return b"".join(_MULAW_LOOKUP_BYTES[b] for b in mulaw_bytes)

    @staticmethod
    def encode_pcm16_to_mulaw(pcm16_bytes: bytes) -> bytes:
        """
        Convert 16-bit signed linear PCM bytes to 8-bit G.711 μ-law bytes.
        """
        if not pcm16_bytes:
            return b""
        # Unpack 16-bit signed samples
        count = len(pcm16_bytes) // 2
        samples = struct.unpack(f'<{count}h', pcm16_bytes[:count * 2])
        # Fast table lookup using sample + 32768
        return bytes(PCM_TO_MULAW_TABLE[s + 32768] for s in samples)

    @staticmethod
    def resample_pcm16(pcm16_bytes: bytes, in_rate: int, out_rate: int) -> bytes:
        """
        Resample 16-bit mono linear PCM from in_rate to out_rate using linear interpolation.
        """
        if not pcm16_bytes or in_rate == out_rate:
            return pcm16_bytes

        count = len(pcm16_bytes) // 2
        if count == 0:
            return b""

        samples = struct.unpack(f'<{count}h', pcm16_bytes[:count * 2])
        out_count = int(count * (out_rate / in_rate))
        if out_count == 0:
            return b""

        ratio = (count - 1) / max(1, out_count - 1) if out_count > 1 else 0
        out_samples = []

        for i in range(out_count):
            src_idx = i * ratio
            idx_int = int(src_idx)
            frac = src_idx - idx_int

            if idx_int >= count - 1:
                val = samples[-1]
            else:
                val = int(samples[idx_int] * (1.0 - frac) + samples[idx_int + 1] * frac)

            # Clamp to int16 range
            val = max(-32768, min(32767, val))
            out_samples.append(val)

        return struct.pack(f'<{len(out_samples)}h', *out_samples)

    @classmethod
    def convert_cartesia_to_twilio(cls, audio_bytes: bytes, source_format: str = "pcm_s16le", source_rate: int = 24000) -> bytes:
        """
        Convert Cartesia TTS output (either raw PCM, WAV, or already μ-law) to Twilio μ-law 8kHz.
        """
        if not audio_bytes:
            return b""

        # Check if the audio already has a WAV header; strip it if present
        data = audio_bytes
        if data.startswith(b'RIFF'):
            data_pos = data.find(b'data')
            if data_pos != -1 and len(data) > data_pos + 8:
                data = data[data_pos + 8:]

        # If already mulaw 8000Hz, return directly
        if source_format in ["pcm_mulaw", "mulaw"] and source_rate == 8000:
            return data

        # If PCM 16-bit at a higher rate (e.g., 24kHz or 16kHz), resample to 8kHz then encode to μ-law
        if source_rate != 8000:
            pcm_8k = cls.resample_pcm16(data, source_rate, 8000)
        else:
            pcm_8k = data

        return cls.encode_pcm16_to_mulaw(pcm_8k)

    @staticmethod
    def chunk_mulaw(mulaw_bytes: bytes, chunk_size: int = 160) -> List[bytes]:
        """
        Chunk μ-law audio into frames (default 160 bytes = 20ms of 8kHz audio)
        suitable for Twilio media streaming payloads.
        """
        if not mulaw_bytes:
            return []
        return [mulaw_bytes[i:i + chunk_size] for i in range(0, len(mulaw_bytes), chunk_size)]

    @staticmethod
    def encode_base64_payload(raw_bytes: bytes) -> str:
        """Encode audio bytes into base64 string for Twilio media message."""
        return base64.b64encode(raw_bytes).decode("ascii")

    @staticmethod
    def decode_base64_payload(b64_str: str) -> bytes:
        """Decode base64 payload from Twilio media message into raw bytes."""
        return base64.b64decode(b64_str)

    @classmethod
    def pcm_to_wav(cls, pcm_bytes: bytes, sample_rate: int = 8000, num_channels: int = 1) -> bytes:
        """Wrap raw PCM 16-bit bytes into a standard RIFF/WAV container."""
        byte_rate = sample_rate * num_channels * 2
        block_align = num_channels * 2
        data_size = len(pcm_bytes)
        riff_size = data_size + 36

        header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF',
            riff_size,
            b'WAVE',
            b'fmt ',
            16,             # Subchunk1Size for PCM
            1,              # AudioFormat 1 = PCM
            num_channels,
            sample_rate,
            byte_rate,
            block_align,
            16,             # BitsPerSample
            b'data',
            data_size
        )
        return header + pcm_bytes
