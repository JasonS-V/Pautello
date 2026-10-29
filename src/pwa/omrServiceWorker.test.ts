import { describe, expect, it } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

describe('paquete OMR del service worker', () => {
  it('conserva la versión anterior tras un fallo y solo declara listo el paquete completo', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const source = readFileSync('src/pwa/sw-template.js', 'utf8')
      .replace('__SW_VERSION__', 'new')
      .replace('__SW_PRECACHE__', '[]')
      .replace('__SW_OMR__', JSON.stringify([{ url: './model.onnx', sha256: hash }]));
    const handlers: Record<string, (event: unknown) => void> = {};
    const stores = new Map<string, Map<string, Response>>([['pautello-omr-old', new Map()]]);
    const cacheFor = (name: string) => ({
      async match(url: string) {
        return stores.get(name)?.get(url)?.clone();
      },
      async put(url: string, response: Response) {
        stores.get(name)!.set(url, response.clone());
      },
      async addAll() {},
    });
    const caches = {
      async open(name: string) {
        if (!stores.has(name)) stores.set(name, new Map());
        return cacheFor(name);
      },
      async keys() {
        return [...stores.keys()];
      },
      async delete(name: string) {
        return stores.delete(name);
      },
    };
    let fail = true;
    runInNewContext(source, {
      self: {
        addEventListener: (name: string, handler: (event: unknown) => void) => {
          handlers[name] = handler;
        },
        location: { origin: 'https://example.test' },
      },
      caches,
      crypto: webcrypto,
      Response,
      URL,
      fetch: async () => {
        if (fail) throw new Error('sin red');
        return new Response(bytes, { status: 200 });
      },
    });
    const message = async (type: string) => {
      const replies: Array<{ ready?: boolean; error?: string }> = [];
      let pending: Promise<unknown> = Promise.resolve();
      handlers.message({
        data: { type },
        ports: [
          { postMessage: (reply: { ready?: boolean; error?: string }) => replies.push(reply) },
        ],
        waitUntil: (work: Promise<unknown>) => {
          pending = work;
        },
      });
      await pending;
      return replies[replies.length - 1];
    };
    expect((await message('OMR_PREPARE'))?.ready).toBe(false);
    expect(await caches.keys()).toContain('pautello-omr-old');
    expect((await message('OMR_STATUS'))?.ready).toBe(false);
    fail = false;
    expect((await message('OMR_PREPARE'))?.ready).toBe(true);
    expect((await message('OMR_STATUS'))?.ready).toBe(true);
    expect(await caches.keys()).not.toContain('pautello-omr-old');
  });
});
