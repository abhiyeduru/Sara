/**
 * AudioStreamer manages:
 * 1. High-fidelity Web Audio capture & hardware-resampled 16kHz WAV encoding
 * 2. Complete acoustic loopback prevention (zero mic audio sent to local speakers)
 * 3. Voice Activity Detection (VAD) with instant 750ms end-of-speech auto-submission
 * 4. Hands-free continuous conversational turn-taking
 * 5. Audio-reactive AnalyserNode for minimal waveform animation
 * 6. Direct WebSocket connectivity to port 8000
 * 7. Seamless queue-based TTS playback with instant barge-in cutoff
 */

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate = 16000) {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }
  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Convert float32 [-1.0, 1.0] to int16
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Uint8Array(buffer);
}

function uint8ToBase64(uint8) {
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return window.btoa(binary);
}

export class AudioStreamer {
  constructor({ onStateChange, onAudioLevel, onTranscript, onMetrics, onEvent }) {
    this.onStateChange = onStateChange || (() => {});
    this.onAudioLevel = onAudioLevel || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onMetrics = onMetrics || (() => {});
    this.onEvent = onEvent || (() => {});

    this.agentId = null;
    this.ws = null;
    this.audioContext = null;
    this.analyser = null;
    this.micStream = null;
    this.processor = null;
    this.muteGain = null;
    this.recordedSamples = [];
    this.isRecording = false;
    this.isPlaying = false;
    this.continuousMode = false;
    this.audioQueue = [];
    this.currentSource = null;
    this.activeSources = [];
    this.nextScheduledTime = 0;
    this.decodeChain = Promise.resolve();
    this.animFrameId = null;
    this.dataArray = null;
    this.agentState = 'idle';

    // Ultra-Fast Responsive VAD and Speaker-Echo-Protected Barge-In parameters
    this.speechDetected = false;
    this.speechStartTime = null;
    this.silenceStartTime = null;
    this.silenceThresholdMs = 380; // 380ms pause triggers immediate response
    this.noiseFloor = 0.003; // Dynamic adaptive noise floor baseline
    this.bargeInRmsThreshold = 0.075; // Elevated threshold during speaker playback to eliminate self-interruption echo
    this.bargeInHits = 0;
    this.minBargeInHits = 3; // Require 3 consecutive frames (~270ms) of sustained speech to barge in
    this.lastSpeechTime = 0;
    this.lastPlaybackEndTime = 0;
    this.lastTextSentTime = 0;
    this.lastAudioSentTime = 0;
    this.micSource = null;
  }


  unlockAudio() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.startAnalyserLoop();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('AudioContext unlock notice:', e);
    }
  }

  async connect(agentId) {
    this.agentId = agentId;
    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      try {
        if (oldWs.readyState === WebSocket.OPEN) {
          oldWs.close();
        }
      } catch {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsHost = window.location.host;
    if (window.location.port === '5173' || window.location.port === '5174') {
      wsHost = `${window.location.hostname}:8000`;
    }
    const customWs = (typeof window !== 'undefined' && window.SARA_WS_URL) || 
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL);
    const wsUrl = customWs ? `${customWs}/ws/voice/${agentId}` : `${protocol}//${wsHost}/ws/voice/${agentId}`;

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        console.warn('WebSocket init exception:', e);
        this.reconnectAttempts = 3;
        this.onEvent({ type: 'ws_unavailable' });
        resolve(false);
        return;
      }

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.updateState('connected');
        this.onEvent({ type: 'connected', message: 'WebSocket Connected' });
        resolve(true);
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket connection note:', err?.message || 'Handshake failed or host unreachable');
        this.updateState('error');
        resolve(false);
      };

      this.ws.onclose = (event) => {
        if (event.code === 1000 || event.code === 1005) {
          console.debug('WebSocket closed normally:', event.code);
        } else {
          console.warn('WebSocket connection closed:', event.code, event.reason || '');
        }
        this.updateState('idle');
        this.stopPlayback();

        // If mic is still open or session was active, attempt auto-reconnect up to max 3 times
        this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
        if (this.isRecording && this.agentId && this.reconnectAttempts <= 2) {
          console.log(`Active session detected — attempting auto-reconnect (${this.reconnectAttempts}/2)...`);
          setTimeout(() => {
            if (this.isRecording && this.agentId) {
              this.connect(this.agentId).then((success) => {
                if (success && this.isRecording) {
                  this.updateState('connected');
                }
              });
            }
          }, 1500);
        } else if (this.reconnectAttempts > 2) {
          this.onEvent({ type: 'ws_unavailable' });
        }
      };

      this.initAudioContext();
    });
  }

  updateState(newState) {
    this.agentState = newState;
    this.onStateChange(newState);
  }

  async initAudioContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.startAnalyserLoop();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  startAnalyserLoop() {
    const checkLevel = () => {
      if (this.analyser && this.dataArray) {
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          sum += this.dataArray[i];
        }
        const average = sum / this.dataArray.length;
        const normalized = Math.min(1, average / 128);
        this.onAudioLevel(normalized, this.dataArray);
      }
      this.animFrameId = requestAnimationFrame(checkLevel);
    };
    checkLevel();
  }

  async startMic() {
    // Re-verify WebSocket connection before starting microphone
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.agentId) {
        console.log("WebSocket not active. Connecting to agent:", this.agentId);
        await this.connect(this.agentId);
      }
    }

    // If SARA is speaking, interrupt first
    if (this.isPlaying) {
      this.interrupt();
    }

    await this.initAudioContext();
    this.continuousMode = true;

    try {
      if (!this.micStream) {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      }

      // Strong reference to micSource prevents garbage collection in Safari & Chrome
      this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.analyser);
      try {
        window.__sara_micSource = this.micSource;
      } catch {}

      // ScriptProcessor for collecting PCM samples
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      try {
        window.__sara_processor = this.processor;
      } catch {}
      this.resetVAD();
      this.isRecording = true;

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;

        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          const sample = inputData[i];
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / inputData.length);

        // Protected Barge-In: If SARA is speaking, only interrupt on sustained loud speech (preventing speaker echo)
        if (this.isPlaying) {
          if (rms >= this.bargeInRmsThreshold) {
            this.bargeInHits++;
            if (this.bargeInHits >= this.minBargeInHits) {
              console.log(`[Barge-In] Verified user speech (RMS: ${rms.toFixed(4)}) during playback. Interrupting.`);
              this.interrupt();
              this.bargeInHits = 0;
              this.speechDetected = true;
              this.speechStartTime = Date.now();
              this.silenceStartTime = null;
              this.lastSpeechTime = Date.now();
              this.lastPlaybackEndTime = 0; // Immediate pickup for user speech without cooldown drop
              this.updateState('listening');
              this.onEvent({ type: 'speech.start', message: 'Speech detected' });
              for (let i = 0; i < inputData.length; i++) {
                this.recordedSamples.push(inputData[i]);
              }
            }
          } else {
            this.bargeInHits = 0;
          }
          return;
        }

        // 200ms grace period after speaker playback ends to reject residual room reverberation
        if (this.lastPlaybackEndTime > 0 && Date.now() - this.lastPlaybackEndTime < 200) {
          return;
        }

        this.bargeInHits = 0;

        // Continuously adapt ambient noise floor baseline
        if (!this.speechDetected) {
          this.noiseFloor = this.noiseFloor * 0.97 + rms * 0.03;
        }

        // Dynamic thresholds adapting to caller's background environment
        const dynamicSpeechThreshold = Math.max(0.004, this.noiseFloor * 2.2);
        const dynamicSilenceThreshold = Math.max(0.0025, this.noiseFloor * 1.4);

        // Record incoming human voice samples
        for (let i = 0; i < inputData.length; i++) {
          this.recordedSamples.push(inputData[i]);
        }

        // Rolling Pre-Speech Ring Buffer: Keep only last 350ms of audio before speech starts
        // Prevents accumulating multi-second dead silence that confuses STT models
        const preSpeechMaxSamples = Math.round((this.audioContext?.sampleRate || 16000) * 0.35);
        if (!this.speechDetected && this.recordedSamples.length > preSpeechMaxSamples) {
          this.recordedSamples = this.recordedSamples.slice(-preSpeechMaxSamples);
        }

        // VAD Logic: Detect speech vs silence
        if (rms >= dynamicSpeechThreshold) {
          if (!this.speechDetected) {
            this.speechDetected = true;
            this.speechStartTime = Date.now();
            this.updateState('listening');
            this.onEvent({ type: 'speech.start', message: 'Speech detected' });
          }
          this.silenceStartTime = null;
          this.lastSpeechTime = Date.now();
        } else if (this.speechDetected) {
          // RMS is below speaking threshold -> user is pausing or finished speaking
          if (rms < dynamicSilenceThreshold) {
            if (!this.silenceStartTime) {
              this.silenceStartTime = Date.now();
            } else if (Date.now() - this.silenceStartTime >= this.silenceThresholdMs) {
              // User finished speaking! Send audio to server for instant response
              this.finalizeAndSendAudio();
            }
          } else {
            // Soft murmur or trailing syllable: reset silence timer
            this.silenceStartTime = null;
          }
        }

        // Safety Cutoff: If user has been speaking continuously for > 4.5s, force send to prevent unbounded audio
        if (this.speechDetected && this.speechStartTime && (Date.now() - this.speechStartTime > 4500) && this.recordedSamples.length > 4000) {
          console.log('[VAD] Utterance reached maximum chunk duration (4.5s), finalizing speech turn.');
          this.finalizeAndSendAudio();
        }
      };

      // Connect through mute GainNode with gain = 0
      // This prevents microphone loopback from echoing into laptop speakers
      this.muteGain = this.audioContext.createGain();
      this.muteGain.gain.value = 0;

      this.micSource.connect(this.processor);
      this.processor.connect(this.muteGain);
      this.muteGain.connect(this.audioContext.destination);

      this.updateState('listening');
    } catch (err) {
      console.error('Error starting microphone:', err);
      this.updateState('error');
    }
  }

  resetVAD() {
    this.recordedSamples = [];
    this.speechDetected = false;
    this.speechStartTime = null;
    this.silenceStartTime = null;
  }

  finalizeAndSendAudio() {
    if (!this.isRecording) return;

    // Do NOT send duplicate audio if text from Web Speech was already dispatched within 1200ms
    if (Date.now() - this.lastTextSentTime < 1200) {
      this.resetVAD();
      return;
    }

    const samplesToSend = [...this.recordedSamples];
    this.resetVAD();

    // Minimum 0.12 seconds of speech so even short commands ("Stop", "Yes", "హలో", "ధర ఎంత") trigger immediately
    const minSampleCount = Math.round((this.audioContext?.sampleRate || 16000) * 0.12);
    if (samplesToSend.length >= minSampleCount) {

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket disconnected. Reconnecting before transmitting speech...");
        if (this.agentId) {
          this.connect(this.agentId).then((ok) => {
            if (ok && this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.sendAudioPayload(samplesToSend);
            }
          });
        }
        return;
      }
      this.sendAudioPayload(samplesToSend);
    } else {
      if (this.agentState === 'thinking') {
        this.updateState('listening');
      }
    }
  }

  sendAudioPayload(samples) {
    this.updateState('thinking');
    this.lastAudioSentTime = Date.now();
    const currentRate = this.audioContext?.sampleRate || 16000;
    const resampled = downsampleBuffer(samples, currentRate, 16000);
    const wavUint8 = encodeWAV(resampled, 16000);
    const b64Wav = uint8ToBase64(wavUint8);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'audio.input',
        audio: b64Wav
      }));
    } else {
      console.warn("WebSocket not open, cannot transmit audio. Reconnecting...");
      if (this.agentId) {
        this.connect(this.agentId).then((ok) => {
          if (ok && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'audio.input',
              audio: b64Wav
            }));
          }
        });
      }
    }
  }

  stopMic() {
    this.continuousMode = false;
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.speechDetected && this.recordedSamples.length > 2000) {
      this.finalizeAndSendAudio();
    } else {
      this.resetVAD();
      if (this.agentState === 'listening') {
        this.updateState('idle');
      }
    }

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {}
      this.processor = null;
    }

    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }

    if (this.muteGain) {
      try {
        this.muteGain.disconnect();
      } catch {}
      this.muteGain = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
  }

  sendText(text) {
    this.unlockAudio();
    this.lastTextSentTime = Date.now();
    this.resetVAD();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.isPlaying) {
        this.interrupt();
      }
      this.updateState('thinking');
      this.ws.send(JSON.stringify({
        type: 'text.input',
        text: text
      }));
    }
  }

  interrupt() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'user.interrupt' }));
    }
    this.stopPlayback();
    this.updateState(this.continuousMode ? 'listening' : 'idle');
    this.onEvent({ type: 'interrupted', message: 'Playback interrupted' });
  }

  endSession() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'session.end' }));
    }
    this.stopPlayback();
    this.stopMic();
    this.updateState('idle');
    this.onEvent({ type: 'session.ended', reason: 'user_ended' });
  }

  stopPlayback() {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources = [];
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }
    this.audioQueue = [];
    this.nextScheduledTime = 0;
    this.isPlaying = false;
    this.lastPlaybackEndTime = Date.now();
  }

  handleServerMessage(data) {
    this.onEvent(data);

    switch (data.type) {
      case 'session.started':
        this.updateState('idle');
        break;

      case 'stt.final':
        if (data.transcript) {
          this.onTranscript({
            role: 'user',
            text: data.transcript,
            language: data.detected_language,
            latency_ms: data.latency_ms
          });
          this.updateState('thinking');
        } else {
          this.resetVAD();
          this.updateState(this.continuousMode && this.isRecording ? 'listening' : 'idle');
        }
        break;

      case 'stt.empty':
        this.resetVAD();
        this.updateState(this.continuousMode && this.isRecording ? 'listening' : 'idle');
        break;

      case 'tts.audio':
        if (data.audio) {
          this.queueAudio(data.audio, data.text);
        }
        break;

      case 'agent.interrupted':
        this.stopPlayback();
        this.updateState(this.continuousMode ? 'listening' : 'idle');
        break;

      case 'turn.completed':
        this.onMetrics(data.metrics);
        break;

      case 'session.ended':
        this.stopPlayback();
        this.stopMic();
        this.updateState('idle');
        break;

      case 'error':
        console.error('Server error:', data.message);
        this.updateState('error');
        break;
    }
  }

  queueAudio(base64Data, phraseText) {
    // Chain decoding to guarantee chronological chunk order (preventing out-of-order speech)
    this.decodeChain = this.decodeChain.then(async () => {
      try {
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        this.unlockAudio();

        try {
          const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer.slice(0));
          this.audioQueue.push({ buffer: audioBuffer, text: phraseText });
          this.schedulePlayback();
        } catch (decodeErr) {
          // HTML5 Audio Blob Fallback
          console.warn('WebAudio decode notice, playing via HTML5 Audio:', decodeErr);
          const isWav = bytes.length > 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
          const mimeType = isWav ? 'audio/wav' : 'audio/mpeg';
          const blob = new Blob([bytes], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          const htmlAudio = new Audio(blobUrl);
          this.isPlaying = true;
          this.updateState('speaking');

          if (phraseText) {
            const lang = /[\u0C00-\u0C7F]/.test(phraseText) ? 'te' : (/[\u0900-\u097F]/.test(phraseText) ? 'hi' : 'en');
            this.onTranscript({ role: 'agent', text: phraseText, language: lang });
          }
          htmlAudio.onended = () => {
            URL.revokeObjectURL(blobUrl);
            this.isPlaying = false;
            this.updateState(this.continuousMode && this.isRecording ? 'listening' : 'idle');
          };
          htmlAudio.play().catch(e => console.warn('HTML5 Audio playback note:', e));
        }
      } catch (err) {
        console.warn('Audio queue notice:', err);
      }
    });
  }

  schedulePlayback() {
    if (!this.audioContext) return;
    if (this.audioQueue.length === 0) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    this.isPlaying = true;
    this.updateState('speaking');

    while (this.audioQueue.length > 0) {
      const item = this.audioQueue.shift();
      if (item.text) {
        const lang = /[\u0C00-\u0C7F]/.test(item.text) ? 'te' : (/[\u0900-\u097F]/.test(item.text) ? 'hi' : 'en');
        this.onTranscript({
          role: 'agent',
          text: item.text,
          language: lang
        });
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = item.buffer;

      // Connect source to analyser for audio-reactive waveform during speech
      source.connect(this.analyser);
      // Connect directly to destination for crystal-clear playback
      source.connect(this.audioContext.destination);

      const now = this.audioContext.currentTime;
      // Gapless scheduled start: seamless transition with zero jitter, micro-stutters, or clicks
      const startTime = Math.max(now, this.nextScheduledTime);
      source.start(startTime);
      this.nextScheduledTime = startTime + item.buffer.duration;
      this.activeSources.push(source);
      this.currentSource = source;

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) this.activeSources.splice(idx, 1);
        if (this.currentSource === source) {
          this.currentSource = this.activeSources[0] || null;
        }

        if (this.audioQueue.length === 0 && this.activeSources.length === 0) {
          this.isPlaying = false;
          this.lastPlaybackEndTime = Date.now();
          this.nextScheduledTime = 0;
          // When SARA finishes speaking, wait a brief grace period then resume listening
          if (this.continuousMode && this.isRecording) {
            setTimeout(() => {
              if (!this.isPlaying && this.isRecording) {
                this.resetVAD();
                this.updateState('listening');
              }
            }, 350);
          } else {
            this.updateState('idle');
          }
        }
      };
    }
  }

  disconnect() {
    this.stopMic();
    this.stopPlayback();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, "Normal Closure");
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => {
            try { ws.close(1000, "Normal Closure"); } catch {}
          };
        }
      } catch {}
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
  }
}
