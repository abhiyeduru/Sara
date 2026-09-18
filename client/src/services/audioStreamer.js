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
    this.animFrameId = null;
    this.dataArray = null;
    this.agentState = 'idle';

    // Ultra-responsive VAD parameters
    this.speechDetected = false;
    this.silenceStartTime = null;
    this.silenceThresholdMs = 600; // 600ms natural conversational pause (prevents cutting off questions mid-sentence)
    this.speechRmsThreshold = 0.012; // Sensitive speech detection
    this.silenceRmsThreshold = 0.008; // Crisp silence cutoff
    this.lastSpeechTime = 0;
  }

  async connect(agentId) {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect directly to backend port 8000 when running in local dev
    const port = window.location.port === '5173' ? '8000' : (window.location.port || (protocol === 'wss:' ? '443' : '80'));
    const host = `${window.location.hostname}:${port}`;
    const wsUrl = `${protocol}//${host}/ws/voice/${agentId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.updateState('connected');
      this.onEvent({ type: 'connected', message: 'WebSocket Connected' });
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
      console.warn('WebSocket status note:', err);
      this.updateState('error');
    };

    this.ws.onclose = () => {
      this.updateState('idle');
      this.stopMic();
      this.stopPlayback();
    };

    await this.initAudioContext();
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

      const micSource = this.audioContext.createMediaStreamSource(this.micStream);
      micSource.connect(this.analyser);

      // ScriptProcessor for collecting PCM samples
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.resetVAD();
      this.isRecording = true;

      this.processor.onaudioprocess = (e) => {
        // Acoustic feedback barrier: Never record when SARA is speaking
        if (!this.isRecording || this.isPlaying) return;

        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          const sample = inputData[i];
          this.recordedSamples.push(sample);
          sum += sample * sample;
        }

        const rms = Math.sqrt(sum / inputData.length);

        // VAD Logic: Detect speech vs silence
        if (rms >= this.speechRmsThreshold) {
          if (!this.speechDetected) {
            this.speechDetected = true;
            this.updateState('listening');
            this.onEvent({ type: 'speech.start', message: 'Speech detected' });
          }
          this.silenceStartTime = null;
          this.lastSpeechTime = Date.now();
        } else if (this.speechDetected && rms < this.silenceRmsThreshold) {
          if (!this.silenceStartTime) {
            this.silenceStartTime = Date.now();
          } else if (Date.now() - this.silenceStartTime >= this.silenceThresholdMs) {
            // User finished speaking! Immediately send audio to server for instant response
            this.finalizeAndSendAudio();
          }
        }
      };

      // CRITICAL: Connect through mute GainNode with gain = 0
      // This prevents microphone loopback from echoing into laptop speakers!
      this.muteGain = this.audioContext.createGain();
      this.muteGain.gain.value = 0;

      micSource.connect(this.processor);
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
    this.silenceStartTime = null;
  }

  finalizeAndSendAudio() {
    if (!this.isRecording) return;
    const samplesToSend = [...this.recordedSamples];
    this.resetVAD();

    // Minimum 0.25 seconds of speech to avoid false clicks
    const minSampleCount = Math.round((this.audioContext?.sampleRate || 16000) * 0.25);
    if (samplesToSend.length >= minSampleCount && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.updateState('thinking');

      // Resample to clean 16kHz mono WAV
      const currentRate = this.audioContext?.sampleRate || 16000;
      const resampled = downsampleBuffer(samplesToSend, currentRate, 16000);
      const wavUint8 = encodeWAV(resampled, 16000);
      const b64Wav = uint8ToBase64(wavUint8);

      this.ws.send(JSON.stringify({
        type: 'audio.input',
        audio: b64Wav
      }));
    } else {
      if (this.agentState === 'thinking') {
        this.updateState('listening');
      }
    }
  }

  stopMic() {
    this.continuousMode = false;
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.speechDetected && this.recordedSamples.length > 3000) {
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

  stopPlayback() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
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
        }
        this.updateState('thinking');
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

  async queueAudio(base64Data, phraseText) {
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      await this.initAudioContext();
      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer.slice(0));

      this.audioQueue.push({ buffer: audioBuffer, text: phraseText });
      if (!this.isPlaying) {
        this.playNextChunk();
      }
    } catch (err) {
      console.warn('Audio decode notice:', err);
    }
  }

  playNextChunk() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      // When SARA finishes speaking, wait a brief 400ms acoustic grace period,
      // then resume active VAD listening if continuous conversation mode is enabled
      if (this.continuousMode && this.isRecording) {
        setTimeout(() => {
          if (!this.isPlaying && this.isRecording) {
            this.resetVAD();
            this.updateState('listening');
          }
        }, 400);
      } else {
        this.updateState('idle');
      }
      return;
    }

    this.isPlaying = true;
    this.updateState('speaking');

    const { buffer, text } = this.audioQueue.shift();

    if (text) {
      this.onTranscript({
        role: 'agent',
        text: text
      });
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Connect source to analyser for audio-reactive waveform during speech
    source.connect(this.analyser);
    // Connect source directly to destination for playback (analyser never routes to destination)
    source.connect(this.audioContext.destination);

    this.currentSource = source;

    source.onended = () => {
      this.currentSource = null;
      this.playNextChunk();
    };

    source.start(0);
  }

  disconnect() {
    this.stopMic();
    this.stopPlayback();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
  }
}
