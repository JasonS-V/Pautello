import { describe, it, expect } from 'vitest';
import { canRegisterOfflineSupport } from './registerServiceWorker';

const baseline = { isProductionBuild: true, protocol: 'https:', supportsServiceWorker: true };

describe('canRegisterOfflineSupport', () => {
  it('acepta un build de producción servido por https', () => {
    expect(canRegisterOfflineSupport(baseline)).toBe(true);
  });

  it('acepta también http (servidor local de preview)', () => {
    expect(canRegisterOfflineSupport({ ...baseline, protocol: 'http:' })).toBe(true);
  });

  it('no registra en Electron, que carga desde file://', () => {
    expect(canRegisterOfflineSupport({ ...baseline, protocol: 'file:' })).toBe(false);
  });

  it('no registra en desarrollo, para no cachear el HMR', () => {
    expect(canRegisterOfflineSupport({ ...baseline, isProductionBuild: false })).toBe(false);
  });

  it('no registra si el navegador no soporta service workers', () => {
    expect(canRegisterOfflineSupport({ ...baseline, supportsServiceWorker: false })).toBe(false);
  });
});
