// ─── ONNX Graph Types ───────────────────────────────────────────────────────

export interface OnnxNode {
  name: string;
  opType: string;
  inputs: string[];
  outputs: string[];
  attributes?: Record<string, unknown>;
}

export interface ModelInput {
  name: string;
  shape: number[];   // -1 for dynamic dims
  dtype: string;     // 'float32', 'int64', etc.
}

export interface ModelMeta {
  inputs: ModelInput[];
  inputNames: string[];
  outputNames: string[];
  originalOutputNames: string[];
  intermediateOutputNames: string[];
  nodes: OnnxNode[];
  hadExternalData: boolean;
  opsetVersion: number;
}

// ─── Inference Types ─────────────────────────────────────────────────────────

export interface TensorResult {
  data: Float32Array | Float64Array | Int32Array | BigInt64Array | Uint8Array | number[];
  shape: number[];
  type: string;
}

export type InferenceOutputs = Record<string, TensorResult>;

export interface TensorStats {
  min: number;
  max: number;
  mean: number;
  std: number;
  hasNaN: boolean;
  hasInf: boolean;
}

// ─── Playback Types ──────────────────────────────────────────────────────────

export interface TraceStep {
  nodeName: string;
  outputTensorKey: string;
}

// ─── Worker Message Types ────────────────────────────────────────────────────

export type WorkerMessageType =
  | 'LOAD'
  | 'LOAD_SUCCESS'
  | 'RUN'
  | 'RUN_SUCCESS'
  | 'ERROR';

export interface WorkerIncomingMessage {
  type: WorkerMessageType;
  payload?: {
    modelBytes?: Uint8Array;
    inputs?: Record<string, { data: unknown; shape: number[]; type: string }>;
  };
}

export interface WorkerOutgoingMessage {
  type: WorkerMessageType;
  provider?: 'webgpu' | 'wasm';
  outputs?: InferenceOutputs;
  stats?: Record<string, TensorStats>;
  detail?: string;
}
