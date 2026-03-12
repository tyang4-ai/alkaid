/**
 * Web Worker for ONNX model inference.
 * Loads an ONNX model and runs inference off the main thread.
 */

// Types for worker messages
interface InitMessage {
  type: 'init';
  modelUrl: string;
}

interface InferMessage {
  type: 'infer';
  id: number;
  observation: Float32Array;
  temperature?: number;
}

interface InferWithValueMessage {
  type: 'inferWithValue';
  id: number;
  observation: Float32Array;
  temperature?: number;
}

type WorkerMessage = InitMessage | InferMessage | InferWithValueMessage;

interface InferResult {
  type: 'inferResult';
  id: number;
  actions: Int32Array;
}

interface InferWithValueResult {
  type: 'inferWithValueResult';
  id: number;
  actions: Int32Array;
  logits: Float32Array;
  value: number;
}

interface ErrorResult {
  type: 'error';
  id: number;
  message: string;
}

interface ReadyResult {
  type: 'ready';
}

let session: any = null;
let ort: any = null;

async function initModel(modelUrl: string): Promise<void> {
  // Import ONNX Runtime dynamically
  ort = await import('onnxruntime-web');

  // Configure ONNX Runtime for WASM backend (no WebGL needed for small MLP)
  ort.env.wasm.numThreads = 1;

  session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ['wasm'],
  });

  (self as unknown as Worker).postMessage({ type: 'ready' } as ReadyResult);
}

async function runInference(id: number, observation: Float32Array, temperature = 1.0): Promise<void> {
  if (!session || !ort) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      id,
      message: 'Model not initialized',
    } as ErrorResult);
    return;
  }

  try {
    const inputTensor = new ort.Tensor('float32', observation, [1, observation.length]);
    // Use dynamic input name from model metadata instead of hardcoded 'obs'
    const inputName = session.inputNames[0] ?? 'obs';
    const feeds: Record<string, any> = { [inputName]: inputTensor };

    const results = await session.run(feeds);

    // The model outputs action logits for each sub-action
    // Shape: [1, 1440] = 32 units × (10 order types + 20 x bins + 15 y bins)
    // We need to argmax each sub-action group
    const logits = results[session.outputNames[0]].data as Float32Array;

    // Apply temperature scaling to logits (higher temp = more random = easier AI)
    const temp = Math.max(0.1, temperature);
    if (temp !== 1.0) {
      for (let i = 0; i < logits.length; i++) {
        logits[i] /= temp;
      }
    }

    // Decode: for each unit slot, pick the argmax of each sub-action
    const actions = new Int32Array(96); // 32 * 3
    const ORDER_TYPES = 10;
    const X_BINS = 20;
    const Y_BINS = 15;

    let logitIdx = 0;
    for (let unit = 0; unit < 32; unit++) {
      // Order type (10 options)
      let bestOrder = 0;
      let bestVal = logits[logitIdx];
      for (let j = 1; j < ORDER_TYPES; j++) {
        if (logits[logitIdx + j] > bestVal) {
          bestVal = logits[logitIdx + j];
          bestOrder = j;
        }
      }
      actions[unit * 3] = bestOrder;
      logitIdx += ORDER_TYPES;

      // X bin (20 options)
      let bestX = 0;
      bestVal = logits[logitIdx];
      for (let j = 1; j < X_BINS; j++) {
        if (logits[logitIdx + j] > bestVal) {
          bestVal = logits[logitIdx + j];
          bestX = j;
        }
      }
      actions[unit * 3 + 1] = bestX;
      logitIdx += X_BINS;

      // Y bin (15 options)
      let bestY = 0;
      bestVal = logits[logitIdx];
      for (let j = 1; j < Y_BINS; j++) {
        if (logits[logitIdx + j] > bestVal) {
          bestVal = logits[logitIdx + j];
          bestY = j;
        }
      }
      actions[unit * 3 + 2] = bestY;
      logitIdx += Y_BINS;
    }

    (self as unknown as Worker).postMessage(
      { type: 'inferResult', id, actions } as InferResult,
      [actions.buffer],
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      id,
      message: (err as Error).message,
    } as ErrorResult);
  }
}

async function runInferenceWithValue(id: number, observation: Float32Array, temperature = 1.0): Promise<void> {
  if (!session || !ort) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      id,
      message: 'Model not initialized',
    } as ErrorResult);
    return;
  }

  try {
    const inputTensor = new ort.Tensor('float32', observation, [1, observation.length]);
    const inputName = session.inputNames[0] ?? 'obs';
    const feeds: Record<string, any> = { [inputName]: inputTensor };

    const results = await session.run(feeds);

    const logits = results[session.outputNames[0]].data as Float32Array;

    // Extract value head if model has one
    const value = session.outputNames.length > 1
      ? (results[session.outputNames[1]].data as Float32Array)[0]
      : 0;

    // Apply temperature scaling
    const temp = Math.max(0.1, temperature);
    const scaledLogits = new Float32Array(logits.length);
    for (let i = 0; i < logits.length; i++) {
      scaledLogits[i] = logits[i] / temp;
    }

    // Decode actions (same as runInference)
    const actions = new Int32Array(96);
    const ORDER_TYPES = 10;
    const X_BINS = 20;
    const Y_BINS = 15;

    let logitIdx = 0;
    for (let unit = 0; unit < 32; unit++) {
      let bestOrder = 0;
      let bestVal = scaledLogits[logitIdx];
      for (let j = 1; j < ORDER_TYPES; j++) {
        if (scaledLogits[logitIdx + j] > bestVal) {
          bestVal = scaledLogits[logitIdx + j];
          bestOrder = j;
        }
      }
      actions[unit * 3] = bestOrder;
      logitIdx += ORDER_TYPES;

      let bestX = 0;
      bestVal = scaledLogits[logitIdx];
      for (let j = 1; j < X_BINS; j++) {
        if (scaledLogits[logitIdx + j] > bestVal) {
          bestVal = scaledLogits[logitIdx + j];
          bestX = j;
        }
      }
      actions[unit * 3 + 1] = bestX;
      logitIdx += X_BINS;

      let bestY = 0;
      bestVal = scaledLogits[logitIdx];
      for (let j = 1; j < Y_BINS; j++) {
        if (scaledLogits[logitIdx + j] > bestVal) {
          bestVal = scaledLogits[logitIdx + j];
          bestY = j;
        }
      }
      actions[unit * 3 + 2] = bestY;
      logitIdx += Y_BINS;
    }

    // Return raw logits (unscaled) + decoded actions + value
    (self as unknown as Worker).postMessage(
      {
        type: 'inferWithValueResult',
        id,
        actions,
        logits: new Float32Array(logits), // Copy since original may be from WASM
        value,
      } as InferWithValueResult,
      [actions.buffer],
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      id,
      message: (err as Error).message,
    } as ErrorResult);
  }
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'init':
      initModel(msg.modelUrl).catch((err) => {
        (self as unknown as Worker).postMessage({
          type: 'error',
          id: -1,
          message: `Init failed: ${(err as Error).message}`,
        } as ErrorResult);
      });
      break;
    case 'infer':
      runInference(msg.id, msg.observation, msg.temperature).catch((err) => {
        (self as unknown as Worker).postMessage({
          type: 'error',
          id: msg.id,
          message: (err as Error).message,
        } as ErrorResult);
      });
      break;
    case 'inferWithValue':
      runInferenceWithValue(msg.id, msg.observation, msg.temperature).catch((err) => {
        (self as unknown as Worker).postMessage({
          type: 'error',
          id: msg.id,
          message: (err as Error).message,
        } as ErrorResult);
      });
      break;
  }
};
