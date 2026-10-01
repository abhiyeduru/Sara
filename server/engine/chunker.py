import re
from typing import AsyncGenerator, Dict, Any

class SentenceChunker:
    """
    Buffers streaming LLM tokens and yields complete conversational phrases
    at natural spoken boundaries (periods, commas, question marks, exclamation marks).
    Enables instant Time-To-First-Audio (TTFA) streaming to TTS.
    """
    # Boundary characters that represent natural spoken pauses
    PUNCTUATION_REGEX = re.compile(r'([.?!;:\n]+|,\s*)')

    def __init__(self, min_chunk_words: int = 2, max_chunk_words: int = 12):
        self.min_chunk_words = min_chunk_words
        self.max_chunk_words = max_chunk_words
        self.buffer = ""

    def process_token(self, token: str) -> list[str]:
        """
        Add token to buffer and return any complete chunks ready for TTS.
        """
        self.buffer += token
        ready_chunks = []

        # Check if buffer has sentence boundaries
        while True:
            # Look for sentence-ending punctuation or pause punctuation
            match = self.PUNCTUATION_REGEX.search(self.buffer)
            if not match:
                # If buffer gets long without punctuation, force split at word boundary
                words = self.buffer.strip().split()
                if len(words) >= self.max_chunk_words:
                    split_idx = self.buffer.rfind(" ")
                    if split_idx != -1:
                        chunk = self.buffer[:split_idx].strip()
                        self.buffer = self.buffer[split_idx:].lstrip()
                        if chunk:
                            ready_chunks.append(chunk)
                break

            end_pos = match.end()
            potential_chunk = self.buffer[:end_pos].strip()
            word_count = len(potential_chunk.split())

            # Emit on natural spoken boundaries without chopping words abruptly
            is_strong_boundary = any(p in match.group() for p in [".", "?", "!", "\n", "।"])
            is_pause_boundary = any(p in match.group() for p in [",", ";", ":"])
            if (is_strong_boundary and word_count >= 3) or (is_pause_boundary and word_count >= 5) or (word_count >= self.max_chunk_words):
                ready_chunks.append(potential_chunk)
                self.buffer = self.buffer[end_pos:].lstrip()
            else:
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
