import { Rnnoise, DenoiseState } from '@shiguredo/rnnoise-wasm';

const RNNOISE_WORKLET_SOURCE = `
  class RNNoiseWorklet extends AudioWorkletProcessor {
    constructor() {
      super();
      this.frameSize = 480;
      this.buffer = new Float32Array(this.frameSize);
      this.bufferPtr = 0;
      this.outputBuffer = new Float32Array(this.frameSize);
      this.outputPtr = 0;
      this.port.onmessage = (event) => {
        if (event.data.type === 'processed') {
          this.outputBuffer.set(event.data.samples);
        }
      };
    }
    process(inputs, outputs) {
      const input = inputs[0]?.[0];
      const output = outputs[0]?.[0];
      if (!input || !output) return true;
      for (let i = 0; i < input.length; i++) {
        this.buffer[this.bufferPtr++] = input[i];
        if (this.bufferPtr === 480) {
          this.port.postMessage({ type: 'process', samples: new Float32Array(this.buffer) });
          this.bufferPtr = 0;
        }
        output[i] = this.outputBuffer[this.outputPtr++];
        if (this.outputPtr === 480) this.outputPtr = 0;
      }
      return true;
    }
  }
  registerProcessor('rnnoise-worklet', RNNoiseWorklet);
`;

export class RNNoiseProcessor {
  private static initPromise: Promise<Rnnoise> | null = null;
  private static workletModuleUrl: string | null = null;
  private static registeredContexts = new WeakSet<AudioContext>();
  private rnnoise: Rnnoise | null = null;
  private denoiseState: DenoiseState | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;

  constructor() {}

  private static getWorkletModuleUrl() {
    if (!RNNoiseProcessor.workletModuleUrl) {
      const blob = new Blob([RNNOISE_WORKLET_SOURCE], { type: 'application/javascript' });
      RNNoiseProcessor.workletModuleUrl = URL.createObjectURL(blob);
    }

    return RNNoiseProcessor.workletModuleUrl;
  }

  async init(opts: { audioContext: AudioContext }): Promise<void> {
    this.audioContext = opts.audioContext;
    
    try {
      // Parallel Init Guard: Ensure multiple instances don't trigger simultaneous .load()
      if (!RNNoiseProcessor.initPromise) {
        RNNoiseProcessor.initPromise = Rnnoise.load();
      }
      
      this.rnnoise = await RNNoiseProcessor.initPromise;
      this.denoiseState = this.rnnoise.createDenoiseState();

      if (!RNNoiseProcessor.registeredContexts.has(this.audioContext)) {
        await this.audioContext.audioWorklet.addModule(RNNoiseProcessor.getWorkletModuleUrl());
        RNNoiseProcessor.registeredContexts.add(this.audioContext);
      }

      this.workletNode = new AudioWorkletNode(this.audioContext, 'rnnoise-worklet');
      
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'process' && this.denoiseState) {
          const samples = event.data.samples;
          this.denoiseState.processFrame(samples);
          this.workletNode?.port.postMessage({ type: 'processed', samples });
        }
      };
    } catch (err) {
      throw err;
    }
  }

  async process(input: AudioWorkletNode): Promise<AudioWorkletNode> {
    if (!this.workletNode) throw new Error('RNNoise worklet not initialized');
    input.connect(this.workletNode);
    return this.workletNode;
  }

  async destroy(): Promise<void> {
    if (this.denoiseState) {
      this.denoiseState.destroy();
      this.denoiseState = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    this.rnnoise = null;
    this.audioContext = null;
  }
}

export async function toggleNoiseSuppression(track: any, enabled: boolean) {
  try {
    if (enabled) {
      const processor = new RNNoiseProcessor();
      if (track.mediaStreamTrack.readyState === 'ended') return;
      await track.setProcessor(processor);
    } else {
      await track.stopProcessor();
    }
  } catch {}
}
