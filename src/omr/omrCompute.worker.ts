import { detectAdaptive, preprocessPage, type PreprocessPageResult } from './omrPreprocess';
import { rotatePage } from './omrGeometry';
import { getOmrRuntime } from './omrRuntime';

type Request =
  | {
      id: number;
      type: 'preprocess';
      gray: Float32Array;
      width: number;
      height: number;
      rotation?: 0 | 90 | 180 | 270;
    }
  | { id: number; type: 'preview'; gray: Float32Array; width: number; height: number }
  | {
      id: number;
      type: 'infer';
      data: Float32Array;
      width: number;
      height: number;
      forceInt8?: boolean;
    };

const workerScope = self as unknown as {
  postMessage(message: unknown, transfer?: Transferable[]): void;
};
let preferInt8 = false;
let completedInferences = 0;

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    if (data.type === 'preview') {
      let detected = detectAdaptive(data.gray, data.width, data.height);
      if (!detected.staves.length) {
        const upright = rotatePage(data.gray, data.width, data.height, 90);
        detected = detectAdaptive(upright.gray, upright.width, upright.height);
      }
      workerScope.postMessage({
        id: data.id,
        spacings: detected.staves.map((staff) => staff.lineSpacing),
      });
      return;
    }
    if (data.type === 'preprocess') {
      const result: PreprocessPageResult = preprocessPage(data.gray, data.width, data.height, {
        rotation: data.rotation,
      });
      workerScope.postMessage({ id: data.id, result, gray: data.gray }, [
        data.gray.buffer as ArrayBuffer,
      ]);
      return;
    }
    let runtime = await getOmrRuntime(preferInt8 || data.forceInt8 ? 'int8' : undefined);
    const tensor = new runtime.ort.Tensor('float32', data.data, [1, 1, data.height, data.width]);
    let outputMap: Awaited<ReturnType<typeof runtime.session.run>> | undefined;
    try {
      try {
        outputMap = await runtime.session.run({ [runtime.inputName]: tensor });
      } catch (primaryError) {
        if (runtime.modelContract.variant === 'int8') throw primaryError;
        if (completedInferences > 0)
          throw new Error(`OMR_MODEL_RESTART_INT8:${String(primaryError)}`, {
            cause: primaryError,
          });
        runtime = await getOmrRuntime('int8');
        preferInt8 = true;
        outputMap = await runtime.session.run({ [runtime.inputName]: tensor });
      }
      const logits = outputMap[runtime.outputName];
      const logitsCopy = new Float32Array(logits.data as Float32Array);
      workerScope.postMessage(
        {
          id: data.id,
          input: data.data,
          logits: logitsCopy,
          dims: logits.dims,
          vocabTokens: runtime.vocabTokens,
          manifest: runtime.manifest,
          modelContract: runtime.modelContract,
          inputNames: runtime.session.inputNames,
          outputNames: runtime.session.outputNames,
        },
        [data.data.buffer as ArrayBuffer, logitsCopy.buffer as ArrayBuffer]
      );
      completedInferences++;
    } finally {
      tensor.dispose();
      for (const output of Object.values(outputMap ?? {})) output.dispose();
    }
  } catch (error) {
    workerScope.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
