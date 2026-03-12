/**
 * Main-thread client for the ONNX inference Web Worker.
 * Follows the same async Promise pattern as PathWorkerClient.
 */

import { RL_INFERENCE_TIMEOUT_MS } from '../constants';

interface PendingInference {
  resolve: (actions: Int32Array) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface PendingInferenceWithValue {
  resolve: (result: { actions: Int32Array; logits: Float32Array; value: number }) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class OnnxWorkerClient {
  private worker: Worker | null = null;
  private nextId = 0;
  private pending = new Map<number, PendingInference>();
  private pendingWithValue = new Map<number, PendingInferenceWithValue>();
  private ready = false;
  private readyPromise: Promise<void> | null = null;

  /**
   * Initialize the worker and load the ONNX model.
   * @param modelUrl URL to the .onnx model file
   */
  async init(modelUrl: string): Promise<void> {
    this.worker = new Worker(
      new URL('./OnnxWorker.ts', import.meta.url),
      { type: 'module' },
    );

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ONNX Worker init timeout'));
      }, 30000);

      this.worker!.onmessage = (event) => {
        const msg = event.data;

        if (msg.type === 'ready') {
          clearTimeout(timeout);
          this.ready = true;
          // Reassign handler to the inference handler
          this.worker!.onmessage = this.handleMessage.bind(this);
          resolve();
          return;
        }

        if (msg.type === 'error' && msg.id === -1) {
          clearTimeout(timeout);
          reject(new Error(msg.message));
          return;
        }
      };
    });

    this.worker.postMessage({ type: 'init', modelUrl });
    return this.readyPromise;
  }

  /**
   * Run inference on an observation vector.
   * @param observation Float32Array of length 2582
   * @param temperature Temperature for action sampling (default 1.0)
   * @returns Int32Array of length 96 (32 units × 3 sub-actions)
   */
  async infer(observation: Float32Array, temperature = 1.0): Promise<Int32Array> {
    if (!this.worker || !this.ready) {
      throw new Error('ONNX Worker not ready');
    }

    const id = this.nextId++;
    return new Promise<Int32Array>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ONNX inference timeout (id=${id})`));
      }, RL_INFERENCE_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timeout });

      this.worker!.postMessage(
        { type: 'infer', id, observation, temperature },
        [observation.buffer],
      );
    });
  }

  /**
   * Run inference and return full results including logits and value head.
   * Used by MCTS for expansion priors and position evaluation.
   * @param observation Float32Array of RL_OBS_SIZE
   * @param temperature Temperature for action sampling (default 1.0)
   * @returns Object with decoded actions, raw logits, and value estimate
   */
  async inferWithValue(
    observation: Float32Array,
    temperature = 1.0,
  ): Promise<{ actions: Int32Array; logits: Float32Array; value: number }> {
    if (!this.worker || !this.ready) {
      throw new Error('ONNX Worker not ready');
    }

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingWithValue.delete(id);
        reject(new Error(`ONNX inferWithValue timeout (id=${id})`));
      }, RL_INFERENCE_TIMEOUT_MS);

      this.pendingWithValue.set(id, { resolve, reject, timeout });

      // We need to copy the observation since we transfer the buffer
      const obsCopy = new Float32Array(observation);
      this.worker!.postMessage(
        { type: 'inferWithValue', id, observation: obsCopy, temperature },
        [obsCopy.buffer],
      );
    });
  }

  private handleMessage(event: MessageEvent): void {
    const msg = event.data;

    if (msg.type === 'inferResult') {
      const p = this.pending.get(msg.id);
      if (p) {
        clearTimeout(p.timeout);
        this.pending.delete(msg.id);
        p.resolve(msg.actions);
      }
    } else if (msg.type === 'inferWithValueResult') {
      const p = this.pendingWithValue.get(msg.id);
      if (p) {
        clearTimeout(p.timeout);
        this.pendingWithValue.delete(msg.id);
        p.resolve({
          actions: msg.actions,
          logits: msg.logits,
          value: msg.value,
        });
      }
    } else if (msg.type === 'error') {
      // Check both pending maps
      const p = this.pending.get(msg.id);
      if (p) {
        clearTimeout(p.timeout);
        this.pending.delete(msg.id);
        p.reject(new Error(msg.message));
        return;
      }
      const pv = this.pendingWithValue.get(msg.id);
      if (pv) {
        clearTimeout(pv.timeout);
        this.pendingWithValue.delete(msg.id);
        pv.reject(new Error(msg.message));
      }
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    for (const [, p] of this.pending) {
      clearTimeout(p.timeout);
      p.reject(new Error('Worker destroyed'));
    }
    this.pending.clear();
    for (const [, p] of this.pendingWithValue) {
      clearTimeout(p.timeout);
      p.reject(new Error('Worker destroyed'));
    }
    this.pendingWithValue.clear();
  }
}
