import re
from typing import AsyncGenerator, Dict, Any

class SentenceChunker:
    """
    Buffers streaming LLM tokens and yields complete conversational phrases
    at natural spoken boundaries (periods, commas, question marks, exclamation marks).
    Enables instant Time-To-First-Audio (TTFA) streaming to TTS.
    """
    # Strong sentence boundaries: . ! ? newline or Devanagari/Indic danda ।
    STRONG_BOUNDARY_REGEX = re.compile(r'([.?!।\n]+)')
    # Pause boundaries: , ; :
    PAUSE_BOUNDARY_REGEX = re.compile(r'([,;:]+)')

    def __init__(self, min_chunk_words: int = 2, max_chunk_words: int = 14):
        self.min_chunk_words = min_chunk_words
        self.max_chunk_words = max_chunk_words
        self.buffer = ""

    def process_token(self, token: str) -> list[str]:
        """
        Add token to buffer and return any complete chunks ready for TTS.
        """
        self.buffer += token
        ready_chunks = []

        while self.buffer:
            strong_match = self.STRONG_BOUNDARY_REGEX.search(self.buffer)
            pause_match = self.PAUSE_BOUNDARY_REGEX.search(self.buffer)

            earliest_match = None
            is_strong = False

            if strong_match and pause_match:
                if strong_match.start() <= pause_match.start():
                    earliest_match = strong_match
                    is_strong = True
                else:
                    earliest_match = pause_match
                    is_strong = False
            elif strong_match:
                earliest_match = strong_match
                is_strong = True
            elif pause_match:
                earliest_match = pause_match
                is_strong = False

            if earliest_match:
                end_pos = earliest_match.end()
                potential_chunk = self.buffer[:end_pos].strip()
                words = potential_chunk.split()
                word_count = len(words)

                # Strong boundaries (. ? ! \n) are complete spoken thoughts: emit if >= 1 word
                if is_strong and word_count >= 1:
                    ready_chunks.append(potential_chunk)
                    self.buffer = self.buffer[end_pos:].lstrip()
                    continue
                # Pause boundaries (, ; :) emit if enough words gathered (>= 3 words)
                elif not is_strong and word_count >= 3:
                    ready_chunks.append(potential_chunk)
                    self.buffer = self.buffer[end_pos:].lstrip()
                    continue
                elif word_count >= self.max_chunk_words:
                    ready_chunks.append(potential_chunk)
                    self.buffer = self.buffer[end_pos:].lstrip()
                    continue
                else:
                    # Weak boundary with too few words; wait for more words or punctuation
                    break

            # If no punctuation, check if buffer reached max words
            words = self.buffer.strip().split()
            if len(words) >= self.max_chunk_words:
                split_idx = self.buffer.rfind(" ")
                if split_idx != -1:
                    chunk = self.buffer[:split_idx].strip()
                    self.buffer = self.buffer[split_idx:].lstrip()
                    if chunk:
                        ready_chunks.append(chunk)
                else:
                    ready_chunks.append(self.buffer.strip())
                    self.buffer = ""
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

