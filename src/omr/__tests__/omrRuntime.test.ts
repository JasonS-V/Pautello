import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import type { OmrModelManifest } from '../omrModelContract';

const createSession = vi.hoisted(() => vi.fn());
vi.mock('onnxruntime-web/wasm', () => ({
  env: { wasm: {} },
  InferenceSession: { create: createSession },
}));

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const vocab = new TextEncoder().encode(JSON.stringify({ tokens: ['<b>'] }));
const fp32 = new Uint8Array([1, 2, 3]);
const int8 = new Uint8Array([4, 5, 6]);
const manifest = {
  contractVersion: '1',
  modelFamily: 'test',
  vocabulary: {
    sha256: hash(vocab),
    tokenCount: 1,
    totalOutputClasses: 2,
    recordSeparatorToken: '<b>',
  },
  tensorContract: {
    outputShape: [1, 'T', 2],
    normalization: { targetHeight: 128, targetSpacingPx: 10, maxWidthPx: 3600 },
  },
  variants: { fp32: { id: 'fp32', sha256: hash(fp32) }, int8: { id: 'int8', sha256: hash(int8) } },
} as unknown as OmrModelManifest;
const response = (bytes: Uint8Array) => ({
  ok: true,
  arrayBuffer: async () => Uint8Array.from(bytes).buffer,
});

describe('OMR runtime fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    createSession.mockReset();
    createSession.mockResolvedValue({ inputNames: ['input'], outputNames: ['logits'] });
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  });
  it('rechaza pesos FP32 alterados y usa INT8 verificado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('vocab.json')) return response(vocab);
        if (url.includes('model-manifest')) return { ok: true, json: async () => manifest };
        return response(url.includes('fp32') ? new Uint8Array([9]) : int8);
      })
    );
    const { getOmrRuntime } = await import('../omrRuntime');
    const runtime = await getOmrRuntime();
    expect(runtime.modelContract.variant).toBe('int8');
    expect(createSession).toHaveBeenCalledTimes(1);
  });
  it('reintenta después de un fallo de creación FP32 y usa INT8', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('vocab.json')) return response(vocab);
        if (url.includes('model-manifest')) return { ok: true, json: async () => manifest };
        return response(url.includes('fp32') ? fp32 : int8);
      })
    );
    createSession.mockRejectedValueOnce(new Error('WASM sin memoria'));
    const { getOmrRuntime } = await import('../omrRuntime');
    expect((await getOmrRuntime()).modelContract.variant).toBe('int8');
    expect(createSession).toHaveBeenCalledTimes(2);
  });
  it('descarta la promesa fallida y permite un nuevo intento', async () => {
    let available = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('vocab.json')) return response(vocab);
        if (url.includes('model-manifest')) return { ok: true, json: async () => manifest };
        return { ok: available, status: 503, arrayBuffer: async () => fp32.buffer };
      })
    );
    const { getOmrRuntime } = await import('../omrRuntime');
    await expect(getOmrRuntime()).rejects.toThrow(/respaldo INT8/);
    available = true;
    expect((await getOmrRuntime()).modelContract.variant).toBe('fp32');
  });
});
