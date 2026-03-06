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
}

type WorkerMessage = InitMessage | InferMessage;

interface InferResult {
  type: 'inferResult';
  id: number;
  actions: Int32Array;
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

async function runInference(id: number, observation: Float32Array): Promise<void> {
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
    const feeds: Record<string, any> = { obs: inputTensor };

    const results = await session.run(feeds);

    // The model outputs action logits for each sub-action
    // Shape: [1, 96] = 32 units × 3 sub-actions (order_type, x_bin, y_bin)
    // We need to argmax each sub-action group
    const logits = results[Object.keys(results)[0]].data as Float32Array;

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
      runInference(msg.id, msg.observation).catch((err) => {
        (self as unknown as Worker).postMessage({
          type: 'error',
          id: msg.id,
          message: (err as Error).message,
        } as ErrorResult);
      });
      break;
  }
};
