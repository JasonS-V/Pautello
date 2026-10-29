import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOmrOfflineStatus, prepareOmrOffline } from '../omrOffline';

describe('omrOffline: interfaz con el service worker', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('informa que requiere versión web instalada si no hay serviceWorker en navigator', async () => {
    vi.stubGlobal('navigator', {});
    await expect(getOmrOfflineStatus()).rejects.toThrow(/requiere la versión web instalada/);
  });

  it('informa si el service worker todavía no está activo', async () => {
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({ active: null }),
      },
    });
    await expect(prepareOmrOffline()).rejects.toThrow(/Espera a que termine la instalación/);
  });

  it('obtiene estado OMR y reporta avance de preparación', async () => {
    const postMessage = vi.fn();
    class FakePort {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      postMessage = vi.fn();
      close = vi.fn();
    }
    const port1 = new FakePort();
    const port2 = new FakePort();

    class FakeMessageChannel {
      port1 = port1;
      port2 = port2;
    }
    vi.stubGlobal('MessageChannel', FakeMessageChannel);

    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          active: {
            postMessage: (msg: { type: string }, ports: FakePort[]) => {
              postMessage(msg, ports);
              setTimeout(() => {
                port1.onmessage?.({ data: { ready: true, total: 11 } });
              }, 5);
            },
          },
        }),
      },
    });

    const status = await getOmrOfflineStatus();
    expect(status.ready).toBe(true);
    expect(status.total).toBe(11);
    expect(postMessage).toHaveBeenCalledWith({ type: 'OMR_STATUS' }, [port2]);
  });
});
