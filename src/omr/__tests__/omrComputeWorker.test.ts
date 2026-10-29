import { beforeEach, describe, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => vi.fn());
vi.mock('../omrRuntime', () => ({ getOmrRuntime: runtime }));
vi.mock('../omrPreprocess', () => ({ detectAdaptive: vi.fn(), preprocessPage: vi.fn() }));
vi.mock('../omrGeometry', () => ({ rotatePage: vi.fn() }));

describe('worker OMR: respaldo tras un fallo de ejecución', () => {
  beforeEach(() => {
    vi.resetModules();
    runtime.mockReset();
  });
  it('pide reiniciar toda la importación si FP32 falla después de una ventana correcta', async () => {
    let calls = 0;
    const run = vi.fn(async () => {
      calls++;
      if (calls === 2) throw new Error('fallo WASM');
      return { logits: { data: new Float32Array([0, 1]), dims: [1, 1, 2], dispose: vi.fn() } };
    });
    runtime.mockResolvedValue({
      ort: {
        Tensor: class {
          dispose() {}
        },
      },
      session: { run, inputNames: ['input'], outputNames: ['logits'] },
      inputName: 'input',
      outputName: 'logits',
      vocabTokens: ['<b>'],
      modelContract: { variant: 'fp32' },
    });
    const posts: Array<{ modelContract?: { variant: string }; error?: string }> = [];
    const fakeSelf = {
      postMessage: (data: { modelContract?: { variant: string }; error?: string }) =>
        posts.push(data),
      onmessage: null as
        | null
        | ((event: {
            data: { id: number; type: 'infer'; data: Float32Array; width: number; height: number };
          }) => Promise<void>),
    };
    vi.stubGlobal('self', fakeSelf);
    await import('../omrCompute.worker');
    const send = async (id: number) => {
      await fakeSelf.onmessage!({
        data: { id, type: 'infer', data: new Float32Array([1]), width: 1, height: 1 },
      });
    };
    await send(1);
    await send(2);
    expect(posts[0].modelContract?.variant).toBe('fp32');
    expect(posts[1].error).toMatch(/^OMR_MODEL_RESTART_INT8:/);
    expect(runtime).toHaveBeenCalledTimes(2);
  });

  it('createOmrCompute cancela de inmediato si la señal ya está abortada', async () => {
    const { createOmrCompute, abortOmr } = await import('../omrCompute');
    const controller = new AbortController();
    controller.abort();
    const compute = createOmrCompute(controller.signal);

    await expect(compute.previewSpacing(new Float32Array(10), 2, 5)).rejects.toEqual(abortOmr());
    await expect(compute.preprocess(new Float32Array(10), 2, 5)).rejects.toEqual(abortOmr());
    await expect(compute.infer(new Float32Array(10), 2, 5)).rejects.toEqual(abortOmr());
    compute.close();
  });

  it('createOmrCompute termina el worker y rechaza promesas pendientes al abortar', async () => {
    const OriginalURL = globalThis.URL;
    class SafeURL extends OriginalURL {
      constructor(url: string | URL, base?: string | URL) {
        super(
          url,
          base ??
            (typeof url === 'string' && url.startsWith('/') ? 'http://localhost:3000' : undefined)
        );
      }
    }
    vi.stubGlobal('URL', SafeURL);

    const { createOmrCompute } = await import('../omrCompute');
    const controller = new AbortController();

    const terminate = vi.fn();
    const postMessage = vi.fn();
    class MockWorker {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: ((ev: ErrorEvent) => void) | null = null;
      postMessage = postMessage;
      terminate = terminate;
    }
    vi.stubGlobal('Worker', MockWorker);

    const compute = createOmrCompute(controller.signal);
    const pendingPromise = compute.previewSpacing(new Float32Array(10), 2, 5);

    expect(postMessage).toHaveBeenCalledTimes(1);
    controller.abort();

    await expect(pendingPromise).rejects.toThrow(/Importación cancelada/);
    expect(terminate).toHaveBeenCalledTimes(1);
    compute.close();
    vi.stubGlobal('URL', OriginalURL);
  });
});
