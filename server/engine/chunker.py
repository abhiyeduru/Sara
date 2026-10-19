import re
from typing import AsyncGenerator, Dict, Any

class SentenceChunker:
    """
    Buffers streaming LLM tokens and yields complete conversational phrases
    at natural spoken sentence boundaries (. ! ? \\n ।).
    Eliminates mid-speech silence gaps by never breaking on commas for short phrases,
    ensuring each audio chunk has sufficient duration to buffer smoothly.
    """
    # Strong sentence boundaries: . ! ? newline or Devanagari/Indic danda ।
    STRONG_BOUNDARY_REGEX = re.compile(r'([.?!।\n]+)')
    # Pause boundaries: , ; : used for natural clauses when phrase has 5+ words
    PAUSE_BOUNDARY_REGEX = re.compile(r'([,;:]+)')

    def __init__(self, min_chunk_words: int = 4, max_chunk_words: int = 18):
        self.min_chunk_words = min_chunk_words
        self.max_chunk_words = max_chunk_words
        self.buffer = ""
        self.is_first_chunk = True

    def process_token(self, token: str) -> list[str]:
        """
        Add token to buffer and return complete phrase chunks ready for TTS.
        Ensures prompt Time-To-First-Audio while preserving complete phrase integrity.
        """
        self.buffer += token
        ready_chunks = []

        while self.buffer:
            min_strong = 1 if self.is_first_chunk else self.min_chunk_words
            # Check for strong sentence boundaries (. ! ? \n ।)
            strong_matches = list(self.STRONG_BOUNDARY_REGEX.finditer(self.buffer))
            found_chunk = False

            for m in strong_matches:
                end_pos = m.end()
                potential_chunk = self.buffer[:end_pos].strip()
                words = potential_chunk.split()
                word_count = len(words)

                if word_count >= min_strong:
                    ready_chunks.append(potential_chunk)
                    self.buffer = self.buffer[end_pos:].lstrip()
                    self.is_first_chunk = False
                    found_chunk = True
                    break

            if found_chunk:
                continue

            # Check for natural clause pause boundaries (, ; :) - fast initial delivery for conversation
            min_pause = 2 if self.is_first_chunk else 5
            pause_matches = list(self.PAUSE_BOUNDARY_REGEX.finditer(self.buffer))
            for pm in pause_matches:
                end_pos = pm.end()
                potential_chunk = self.buffer[:end_pos].strip()
                words = potential_chunk.split()
                word_count = len(words)

                if word_count >= min_pause:
                    ready_chunks.append(potential_chunk)
                    self.buffer = self.buffer[end_pos:].lstrip()
                    self.is_first_chunk = False
                    found_chunk = True
                    break

            if found_chunk:
                continue

            # If no boundary matched, check if buffer exceeds max_chunk_words limit (18 words)
            words = self.buffer.strip().split()
            if len(words) >= self.max_chunk_words:
                # Split at ~12-14 words to keep both sides balanced
                target_words = words[:12]
                split_text = " ".join(target_words)
                split_idx = self.buffer.find(split_text) + len(split_text)
                if split_idx > 0 and split_idx < len(self.buffer):
                    chunk = self.buffer[:split_idx].strip()
                    self.buffer = self.buffer[split_idx:].lstrip()
                    if chunk:
                        ready_chunks.append(chunk)
                        self.is_first_chunk = False
                        continue
            break

        return ready_chunks

    def flush(self) -> list[str]:
        """
        Flush any remaining text in the buffer.
        """
        remaining = self.buffer.strip()
        self.buffer = ""
        if remaining:
            return [remaining]
        return []

