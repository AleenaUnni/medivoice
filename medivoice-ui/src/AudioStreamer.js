const MIC_SAMPLE_RATE = 16000;
const AUDIO_OUTPUT_SAMPLE_RATE = 24000;

const AUDIO_INPUT_CONFIG = {
  mediaType: 'audio/lpcm',
  sampleRateHertz: 16000,
  sampleSizeBits: 16,
  channelCount: 1,
  audioType: 'SPEECH',
  encoding: 'base64',
};

const AUDIO_OUTPUT_CONFIG = {
  mediaType: 'audio/lpcm',
  sampleRateHertz: 24000,
  sampleSizeBits: 16,
  channelCount: 1,
  voiceId: 'tiffany',
  encoding: 'base64',
  audioType: 'SPEECH',
};

const TOOL_CONFIG = { tools: [] };

const SYSTEM_PROMPT =
  'You are MediVoice, a compassionate medical intake assistant. Greet the patient warmly and ask their name. Then ask ONE question at a time: reason for visit today, symptoms and duration, pain level 1-10, current medications, known allergies. Keep responses short and empathetic. Never diagnose. When patient is done, thank them warmly.';

function b64encodeUint8(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function int16ToFloat32(int16) {
  const out = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i += 1) {
    out[i] = int16[i] / 32768;
  }
  return out;
}

function createUuid() {
  return crypto.randomUUID();
}

class AudioStreamer {
  constructor(wsUrl, onTranscript, onSpeaking, onStatus) {
    this.wsUrl = wsUrl;
    this.onTranscript = onTranscript;
    this.onSpeaking = onSpeaking;
    this.onStatus = onStatus;

    this.ws = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.playbackContext = null;
    this.sourceNode = null;
    this.workletNode = null;

    this.promptName = null;
    this.textContentName = null;
    this.audioContentName = null;

    this._floatQueue = [];
    this._flushTimer = null;
    this._running = false;

    this.audioQueue = [];
    this.nextPlayTime = 0;
  }

  _status(msg) {
    if (this.onStatus) this.onStatus(msg);
  }

  _speaking(flag) {
    if (this.onSpeaking) this.onSpeaking(flag);
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  async start() {
    if (this._running) return;
    this._running = true;

    this.promptName = createUuid();
    this.textContentName = createUuid();
    this.audioContentName = createUuid();

    this._status('Requesting microphone access...');

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: MIC_SAMPLE_RATE });
    this.playbackContext = new AudioContextClass({ sampleRate: AUDIO_OUTPUT_SAMPLE_RATE });
    this.nextPlayTime = this.playbackContext.currentTime;

    this._status('Connecting...');
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = async () => {
      this._status('Connected');

      // 1
      this._send({
        event: { sessionStart: { inferenceConfiguration: { maxTokens: 1024, topP: 0.95, temperature: 0.7 } } },
      });

      // 2
      this._send({
        event: {
          promptStart: {
            promptName: this.promptName,
            textOutputConfiguration: { mediaType: 'text/plain' },
            audioOutputConfiguration: AUDIO_OUTPUT_CONFIG,
            toolUseOutputConfiguration: { mediaType: 'application/json' },
            toolConfiguration: TOOL_CONFIG,
          },
        },
      });

      // 3
      this._send({
        event: {
          contentStart: {
            promptName: this.promptName,
            contentName: this.textContentName,
            type: 'TEXT',
            interactive: false,
            role: 'SYSTEM',
            textInputConfiguration: { mediaType: 'text/plain' },
          },
        },
      });

      // 4
      this._send({
        event: { textInput: { promptName: this.promptName, contentName: this.textContentName, content: SYSTEM_PROMPT } },
      });

      // 5
      this._send({
        event: { contentEnd: { promptName: this.promptName, contentName: this.textContentName } },
      });

      // 6
      this._send({
        event: {
          contentStart: {
            promptName: this.promptName,
            contentName: this.audioContentName,
            type: 'AUDIO',
            interactive: true,
            role: 'USER',
            audioInputConfiguration: AUDIO_INPUT_CONFIG,
          },
        },
      });

      await this._startWorklet();
      this._startFlusher();
      this._status('Listening...');
    };

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        this._handleMessage(data);
      } catch {
        // ignore
      }
    };

    this.ws.onerror = () => {
      this._status('WebSocket error');
    };

    this.ws.onclose = () => {
      this._status('Disconnected');
      this._speaking(false);
    };
  }

  async _startWorklet() {
    const code =
      "class P extends AudioWorkletProcessor{process(i){if(i[0][0])this.port.postMessage(i[0][0]);return true;}};registerProcessor('p',P);";
    const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
    await this.audioContext.audioWorklet.addModule(url);

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'p');

    this.workletNode.port.onmessage = (e) => {
      if (!this._running) return;
      const float32 = e.data;
      if (float32 && float32.length) {
        this._floatQueue.push(float32);
      }
    };

    this.sourceNode.connect(this.workletNode);
  }

  _startFlusher() {
    if (this._flushTimer) return;
    this._flushTimer = window.setInterval(() => {
      if (!this._running) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (this._floatQueue.length === 0) return;

      const chunks = this._floatQueue;
      this._floatQueue = [];

      let total = 0;
      for (let i = 0; i < chunks.length; i += 1) total += chunks[i].length;

      const int16 = new Int16Array(total);
      let offset = 0;
      for (let c = 0; c < chunks.length; c += 1) {
        const f = chunks[c];
        for (let i = 0; i < f.length; i += 1) {
          const v = Math.max(-32768, Math.min(32767, f[i] * 32768));
          int16[offset + i] = v;
        }
        offset += f.length;
      }

      const base64PCMaudio = b64encodeUint8(new Uint8Array(int16.buffer));

      // 7
      this._send({
        event: {
          audioInput: { promptName: this.promptName, contentName: this.audioContentName, content: base64PCMaudio },
        },
      });
    }, 100);
  }

  _handleMessage(data) {
    if (!data || !data.event) return;

    if (data.event.textOutput) {
      if (this.onTranscript) this.onTranscript(data.event.textOutput.role, data.event.textOutput.content);
    }

    if (data.event.audioOutput) {
      const { content } = data.event.audioOutput;
      this._enqueueAudioBase64Int16(content);
      this._speaking(true);
    }

    if (data.event.contentEnd) {
      this._speaking(false);
    }
  }

  _enqueueAudioBase64Int16(base64) {
    if (!this.playbackContext) return;
    const bytes = base64ToUint8(base64);
    const int16 = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i += 1) {
      float32[i] = int16[i] / 32768.0;
    }

    const buffer = this.playbackContext.createBuffer(1, float32.length, AUDIO_OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    this.audioQueue.push(buffer);
    this._scheduleQueuedAudio();
  }

  _scheduleQueuedAudio() {
    if (!this.playbackContext) return;
    if (this.nextPlayTime < this.playbackContext.currentTime) {
      this.nextPlayTime = this.playbackContext.currentTime;
    }

    while (this.audioQueue.length > 0) {
      const buffer = this.audioQueue.shift();
      const src = this.playbackContext.createBufferSource();
      src.buffer = buffer;
      src.connect(this.playbackContext.destination);
      src.start(this.nextPlayTime);
      this.nextPlayTime += buffer.duration;
    }
  }

  async stop() {
    if (!this._running) return;
    this._running = false;

    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.promptName && this.audioContentName) {
      this._send({ event: { contentEnd: { promptName: this.promptName, contentName: this.audioContentName } } });
      this._send({ event: { promptEnd: { promptName: this.promptName } } });
      this._send({ event: { sessionEnd: {} } });
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close();
    }

    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    if (this.playbackContext) {
      await this.playbackContext.close();
      this.playbackContext = null;
    }

    this._speaking(false);
    this._status('Stopped');
  }
}

export default AudioStreamer;

