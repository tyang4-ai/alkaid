/**
 * AdaptationLayer — Pure JS MLP that predicts personality weight biases
 * from player tendency features. No external dependencies.
 *
 * Architecture: 14 → 32 (ReLU) → 32 (ReLU) → 19 (linear)
 * Total params: (14*32+32) + (32*32+32) + (32*19+19) = 2195
 */

import { TENDENCY_FEATURE_COUNT } from '../../constants';

const HIDDEN1 = 32;
const HIDDEN2 = 32;
const OUTPUT = 19; // PersonalityWeights field count

const DB_NAME = 'alkaid-adaptation';
const DB_VERSION = 1;
const STORE_NAME = 'weights';
const WEIGHTS_KEY = 'alkaid-adaptation-weights';

// --- Matrix math helpers ---

function matmul(
  out: Float32Array,
  input: Float32Array,
  weights: Float32Array,
  bias: Float32Array,
  inSize: number,
  outSize: number,
): void {
  for (let o = 0; o < outSize; o++) {
    let sum = bias[o];
    for (let i = 0; i < inSize; i++) {
      sum += input[i] * weights[o * inSize + i];
    }
    out[o] = sum;
  }
}

function relu(arr: Float32Array): void {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < 0) arr[i] = 0;
  }
}

function initXavier(size: number, fanIn: number, fanOut: number): Float32Array {
  const arr = new Float32Array(size);
  const scale = Math.sqrt(6 / (fanIn + fanOut));
  for (let i = 0; i < size; i++) {
    arr[i] = (Math.random() * 2 - 1) * scale;
  }
  return arr;
}

export class AdaptationLayer {
  // Layer 1: 14 → 32
  private w1: Float32Array;
  private b1: Float32Array;
  // Layer 2: 32 → 32
  private w2: Float32Array;
  private b2: Float32Array;
  // Layer 3: 32 → 19
  private w3: Float32Array;
  private b3: Float32Array;

  constructor() {
    this.w1 = initXavier(HIDDEN1 * TENDENCY_FEATURE_COUNT, TENDENCY_FEATURE_COUNT, HIDDEN1);
    this.b1 = new Float32Array(HIDDEN1);
    this.w2 = initXavier(HIDDEN2 * HIDDEN1, HIDDEN1, HIDDEN2);
    this.b2 = new Float32Array(HIDDEN2);
    this.w3 = initXavier(OUTPUT * HIDDEN2, HIDDEN2, OUTPUT);
    this.b3 = new Float32Array(OUTPUT);
  }

  /**
   * Forward pass: 14 → 32 (ReLU) → 32 (ReLU) → 19 (linear)
   */
  forward(input: Float32Array): Float32Array {
    const h1 = new Float32Array(HIDDEN1);
    matmul(h1, input, this.w1, this.b1, TENDENCY_FEATURE_COUNT, HIDDEN1);
    relu(h1);

    const h2 = new Float32Array(HIDDEN2);
    matmul(h2, h1, this.w2, this.b2, HIDDEN1, HIDDEN2);
    relu(h2);

    const out = new Float32Array(OUTPUT);
    matmul(out, h2, this.w3, this.b3, HIDDEN2, OUTPUT);
    return out;
  }

  /**
   * Predict additive biases for PersonalityWeights from player tendencies.
   */
  predict(tendencies: Float32Array): Float32Array {
    return this.forward(tendencies);
  }

  /**
   * Simple SGD training: push AI to counter observed player tendencies.
   * Training signal: invert player tendencies weighted by how much the AI lost.
   *
   * @param history - Array of tendency feature vectors from past battles
   * @param outcomes - Array of outcome scores (positive = AI won, negative = AI lost)
   * @param lr - Learning rate (default 0.01)
   * @param steps - Number of gradient steps (default 50)
   */
  train(
    history: Float32Array[],
    outcomes: number[],
    lr = 0.01,
    steps = 50,
  ): void {
    if (history.length === 0) return;

    const n = Math.min(history.length, outcomes.length);

    for (let step = 0; step < steps; step++) {
      // Accumulate gradients
      const dw1 = new Float32Array(this.w1.length);
      const db1 = new Float32Array(this.b1.length);
      const dw2 = new Float32Array(this.w2.length);
      const db2 = new Float32Array(this.b2.length);
      const dw3 = new Float32Array(this.w3.length);
      const db3 = new Float32Array(this.b3.length);

      for (let s = 0; s < n; s++) {
        const input = history[s];
        const outcome = outcomes[s];

        // Forward pass (save intermediates)
        const z1 = new Float32Array(HIDDEN1);
        matmul(z1, input, this.w1, this.b1, TENDENCY_FEATURE_COUNT, HIDDEN1);
        const h1 = new Float32Array(z1);
        relu(h1);

        const z2 = new Float32Array(HIDDEN2);
        matmul(z2, h1, this.w2, this.b2, HIDDEN1, HIDDEN2);
        const h2 = new Float32Array(z2);
        relu(h2);

        const out = new Float32Array(OUTPUT);
        matmul(out, h2, this.w3, this.b3, HIDDEN2, OUTPUT);

        // Target: when AI loses (outcome < 0), push output toward negated tendencies
        // When AI wins, reduce adaptation (output toward 0)
        const target = new Float32Array(OUTPUT);
        if (outcome < 0) {
          // Counter player tendencies: spread inverted signals across outputs
          const lossWeight = Math.min(1, Math.abs(outcome));
          for (let o = 0; o < OUTPUT; o++) {
            // Use tendency features cyclically to generate targets
            const tIdx = o % TENDENCY_FEATURE_COUNT;
            target[o] = -(input[tIdx] - 0.5) * 2 * lossWeight * 0.1;
          }
        }
        // else target stays 0 (reduce biases when winning)

        // MSE loss gradient: dL/dout = 2*(out - target)/n (we drop 2/n for simplicity)
        const dout = new Float32Array(OUTPUT);
        for (let o = 0; o < OUTPUT; o++) {
          dout[o] = (out[o] - target[o]) / n;
        }

        // Backprop through layer 3
        for (let o = 0; o < OUTPUT; o++) {
          db3[o] += dout[o];
          for (let i = 0; i < HIDDEN2; i++) {
            dw3[o * HIDDEN2 + i] += dout[o] * h2[i];
          }
        }

        const dh2 = new Float32Array(HIDDEN2);
        for (let i = 0; i < HIDDEN2; i++) {
          let sum = 0;
          for (let o = 0; o < OUTPUT; o++) {
            sum += dout[o] * this.w3[o * HIDDEN2 + i];
          }
          dh2[i] = z2[i] > 0 ? sum : 0; // ReLU derivative
        }

        // Backprop through layer 2
        for (let o = 0; o < HIDDEN2; o++) {
          db2[o] += dh2[o];
          for (let i = 0; i < HIDDEN1; i++) {
            dw2[o * HIDDEN1 + i] += dh2[o] * h1[i];
          }
        }

        const dh1 = new Float32Array(HIDDEN1);
        for (let i = 0; i < HIDDEN1; i++) {
          let sum = 0;
          for (let o = 0; o < HIDDEN2; o++) {
            sum += dh2[o] * this.w2[o * HIDDEN1 + i];
          }
          dh1[i] = z1[i] > 0 ? sum : 0;
        }

        // Backprop through layer 1
        for (let o = 0; o < HIDDEN1; o++) {
          db1[o] += dh1[o];
          for (let i = 0; i < TENDENCY_FEATURE_COUNT; i++) {
            dw1[o * TENDENCY_FEATURE_COUNT + i] += dh1[o] * input[i];
          }
        }
      }

      // Apply gradients
      for (let i = 0; i < this.w1.length; i++) this.w1[i] -= lr * dw1[i];
      for (let i = 0; i < this.b1.length; i++) this.b1[i] -= lr * db1[i];
      for (let i = 0; i < this.w2.length; i++) this.w2[i] -= lr * dw2[i];
      for (let i = 0; i < this.b2.length; i++) this.b2[i] -= lr * db2[i];
      for (let i = 0; i < this.w3.length; i++) this.w3[i] -= lr * dw3[i];
      for (let i = 0; i < this.b3.length; i++) this.b3[i] -= lr * db3[i];
    }
  }

  /**
   * Decay all weights toward zero (prevents runaway adaptation).
   */
  applyDecay(halfLife: number): void {
    const factor = Math.pow(0.5, 1 / halfLife);
    for (let i = 0; i < this.w1.length; i++) this.w1[i] *= factor;
    for (let i = 0; i < this.b1.length; i++) this.b1[i] *= factor;
    for (let i = 0; i < this.w2.length; i++) this.w2[i] *= factor;
    for (let i = 0; i < this.b2.length; i++) this.b2[i] *= factor;
    for (let i = 0; i < this.w3.length; i++) this.w3[i] *= factor;
    for (let i = 0; i < this.b3.length; i++) this.b3[i] *= factor;
  }

  /**
   * Get all weights as a single ArrayBuffer for serialization.
   */
  getWeightsBlob(): ArrayBuffer {
    const totalFloats =
      this.w1.length + this.b1.length +
      this.w2.length + this.b2.length +
      this.w3.length + this.b3.length;
    const buffer = new ArrayBuffer(totalFloats * 4);
    const view = new Float32Array(buffer);
    let offset = 0;
    for (const arr of [this.w1, this.b1, this.w2, this.b2, this.w3, this.b3]) {
      view.set(arr, offset);
      offset += arr.length;
    }
    return buffer;
  }

  /**
   * Load weights from ArrayBuffer.
   */
  loadWeightsBlob(buffer: ArrayBuffer): void {
    const view = new Float32Array(buffer);
    let offset = 0;
    for (const arr of [this.w1, this.b1, this.w2, this.b2, this.w3, this.b3]) {
      arr.set(view.subarray(offset, offset + arr.length));
      offset += arr.length;
    }
  }

  /**
   * Persist weights to IndexedDB.
   */
  async saveWeights(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(this.getWeightsBlob(), WEIGHTS_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  /**
   * Load weights from IndexedDB.
   */
  async loadWeights(): Promise<boolean> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(WEIGHTS_KEY);
        req.onsuccess = () => {
          db.close();
          if (req.result instanceof ArrayBuffer) {
            this.loadWeightsBlob(req.result);
            resolve(true);
          } else {
            resolve(false);
          }
        };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    } catch {
      return false;
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}
