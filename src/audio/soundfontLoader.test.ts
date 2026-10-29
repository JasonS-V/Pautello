import { afterEach, describe, expect, it, vi } from 'vitest';
import { soundfontManager } from './soundfontLoader';

afterEach(() => vi.restoreAllMocks());

describe('precarga de timbres sin conexión', () => {
  it('usa síntesis local sin solicitar soundfonts remotos cuando el dispositivo está offline', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(await soundfontManager.preloadInstrument('offline-control')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('evita solicitudes que la CSP de la aplicación bloquearía', async () => {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "connect-src 'self' file:";
    document.head.append(meta);
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      expect(await soundfontManager.preloadInstrument('csp-control')).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      meta.remove();
    }
  });
});
