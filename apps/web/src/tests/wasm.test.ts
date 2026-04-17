import { describe, it, expect } from 'vitest';
import { Rnnoise } from '@shiguredo/rnnoise-wasm';

describe('RNNoise WASM Loading', () => {
  it('should successfully load the RNNoise WASM module', async () => {
    // Note: In Node/JSDOM environment, we might need a fetch polyfill or mock 
    // if the library tries to fetch the .wasm file.
    try {
      const rnnoise = await Rnnoise.load();
      expect(rnnoise).toBeDefined();
      expect(typeof rnnoise.createDenoiseState).toBe('function');
      
      const state = rnnoise.createDenoiseState();
      expect(state).toBeDefined();
      state.destroy();
    } catch (err: any) {
      console.error('[WASM Test] Failed to load RNNoise:', err.message);
      // In CI, we might skip this if WASM environment isn't fully ready
      throw err;
    }
  });
});
