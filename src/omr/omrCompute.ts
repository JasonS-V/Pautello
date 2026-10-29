import { preprocessPage, type PreprocessPageResult } from './omrPreprocess';
import { detectAdaptive } from './omrPreprocess';
import { rotatePage } from './omrGeometry';
import { getOmrRuntime } from './omrRuntime';
import type { OmrActiveModelContract, OmrModelManifest } from './omrModelContract';

export interface InferResult {
  input: Float32Array;
  logits: Float32Array;
  dims: readonly number[];
  vocabTokens: string[];
  manifest?: OmrModelManifest;
  modelContract: OmrActiveModelContract;
  inputNames: readonly string[];
  outputNames: readonly string[];
}

export function abortOmr(): DOMException {
  return new DOMException('Importación cancelada.', 'AbortError');
}

export function createOmrCompute(signal?: AbortSignal, forceInt8 = false) {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  const stop = () => {
    worker?.terminate();
    worker = null;
    for (const entry of pending.values()) entry.reject(abortOmr());
    pending.clear();
  };
  signal?.addEventListener('abort', stop, { once: true });
  const request = <T>(message: object, buffer: ArrayBufferLike): Promise<T> => {
    if (signal?.aborted) return Promise.reject(abortOmr());
    if (!worker) {
      worker = new Worker(new URL('./omrCompute.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }: MessageEvent<{ id: number; error?: string }>) => {
        const entry = pending.get(data.id);
        if (!entry) return;
        pending.delete(data.id);
        if (data.error) entry.reject(new Error(data.error));
        else entry.resolve(data);
      };
      worker.onerror = (event) => {
        console.error(
          'Worker error details:',
          event.message,
          event.filename,
          event.lineno,
          event.error
        );
        for (const entry of pending.values()) entry.reject(new Error(event.message));
        pending.clear();
        worker?.terminate();
        worker = null;
      };
    }
    const id = ++nextId;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: (value) => resolve(value as T), reject });
      try {
        worker!.postMessage({ ...message, id }, [buffer as ArrayBuffer]);
      } catch (error) {
        pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };
  return {
    async previewSpacing(gray: Float32Array, width: number, height: number): Promise<number[]> {
      if (signal?.aborted) throw abortOmr();
      if (typeof Worker === 'undefined') {
        let detected = detectAdaptive(gray, width, height);
        if (!detected.staves.length) {
          const upright = rotatePage(gray, width, height, 90);
          detected = detectAdaptive(upright.gray, upright.width, upright.height);
        }
        return detected.staves.map((staff) => staff.lineSpacing);
      }
      const response = await request<{ spacings: number[] }>(
        { type: 'preview', gray, width, height },
        gray.buffer
      );
      return response.spacings;
    },
    async preprocess(
      gray: Float32Array,
      width: number,
      height: number,
      rotation?: 0 | 90 | 180 | 270
    ) {
      if (signal?.aborted) throw abortOmr();
      if (typeof Worker === 'undefined')
        return { gray, result: preprocessPage(gray, width, height, { rotation }) };
      return request<{ gray: Float32Array; result: PreprocessPageResult }>(
        { type: 'preprocess', gray, width, height, rotation },
        gray.buffer
      );
    },
    async infer(data: Float32Array, width: number, height: number): Promise<InferResult> {
      if (signal?.aborted) throw abortOmr();
      if (typeof Worker === 'undefined') {
        const runtime = await getOmrRuntime();
        const tensor = new runtime.ort.Tensor('float32', data, [1, 1, height, width]);
        const outputMap = await runtime.session.run({ [runtime.inputName]: tensor });
        try {
          const logits = outputMap[runtime.outputName];
          return {
            input: data,
            logits: new Float32Array(logits.data as Float32Array),
            dims: logits.dims,
            vocabTokens: runtime.vocabTokens,
            manifest: runtime.manifest,
            modelContract: runtime.modelContract,
            inputNames: runtime.session.inputNames,
            outputNames: runtime.session.outputNames,
          };
        } finally {
          tensor.dispose();
          for (const output of Object.values(outputMap)) output.dispose();
        }
      }
      return request<InferResult>({ type: 'infer', data, width, height, forceInt8 }, data.buffer);
    },
    close() {
      signal?.removeEventListener('abort', stop);
      stop();
    },
  };
}
