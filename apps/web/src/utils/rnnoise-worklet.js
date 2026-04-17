// RNNoise AudioWorkletProcessor
// This script runs in the audio thread and processes frames via WASM

class RNNoiseWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.frameSize = options.processorOptions.frameSize || 480;
    this.buffer = new Float32Array(this.frameSize);
    this.bufferPtr = 0;
    this.outputBuffer = new Float32Array(this.frameSize);
    this.outputPtr = 0;
    
    // We'll receive the processed samples from the main thread via message
    // or we could load WASM here. Loading WASM inside Worklet is more performant.
    this.port.onmessage = (event) => {
      if (event.data.type === 'processed') {
        this.outputBuffer.set(event.data.samples);
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || !input[0]) return true;

    const inputChannel = input[0];
    const outputChannel = output[0];

    // Collect samples into 480-size buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferPtr++] = inputChannel[i];
      
      // When buffer is full, send to main thread for RNNoise processing
      if (this.bufferPtr === this.frameSize) {
        this.port.postMessage({ type: 'process', samples: new Float32Array(this.buffer) });
        this.bufferPtr = 0;
      }

      // Read from output buffer
      outputChannel[i] = this.outputBuffer[this.outputPtr++];
      if (this.outputPtr === this.frameSize) {
        this.outputPtr = 0;
      }
    }

    return true;
  }
}

registerProcessor('rnnoise-worklet', RNNoiseWorklet);
