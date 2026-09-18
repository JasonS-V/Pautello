import { describe, it, expect, beforeEach } from 'vitest';
import {
  ERROR_LOG_KEY,
  buildDiagnosticReport,
  clearErrorLog,
  readErrorLog,
  recordFailure,
} from './errorLog';

describe('errorLog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('empieza el registro con el primer fallo', () => {
    const log = recordFailure(new Error('boom'), 'at ScoreView');

    expect(log.failures).toBe(1);
    expect(log.firstAt).toBe(log.lastAt);
    expect(log.last).toEqual({ message: 'boom', componentStack: 'at ScoreView', at: log.lastAt });
    expect(readErrorLog()).toMatchObject({ failures: 1 });
  });

  it('acumula fallos sin perder la fecha del primero', () => {
    const first = recordFailure(new Error('uno'));
    const second = recordFailure(new Error('dos'));

    expect(second.failures).toBe(2);
    expect(second.firstAt).toBe(first.firstAt);
    expect(second.last.message).toBe('dos');
  });

  it('guarda el stack de componentes como null si no se recibe', () => {
    const log = recordFailure(new Error('sin stack'));

    expect(log.last.componentStack).toBeNull();
  });

  it('recorta mensajes y pilas desmesuradas', () => {
    const log = recordFailure(new Error('x'.repeat(2000)), 'y'.repeat(5000));

    expect(log.last.message.length).toBeLessThan(600);
    expect(log.last.componentStack?.length).toBeLessThan(2100);
  });

  it('ignora un registro corrupto', () => {
    localStorage.setItem(ERROR_LOG_KEY, '{esto no es json');

    expect(readErrorLog()).toBeNull();
  });

  it('ignora un registro con forma inesperada', () => {
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify({ failures: 'varios' }));

    expect(readErrorLog()).toBeNull();
  });

  it('devuelve null cuando no hay registro', () => {
    expect(readErrorLog()).toBeNull();
  });

  it('borra el registro', () => {
    recordFailure(new Error('boom'));
    clearErrorLog();

    expect(readErrorLog()).toBeNull();
  });

  it('compone un informe con el error, el contador y el tamaño del autoguardado', () => {
    recordFailure(new Error('primero'));
    const log = recordFailure(new Error('Cannot read properties of undefined'));

    const report = buildDiagnosticReport({
      error: new Error('Cannot read properties of undefined'),
      log,
      storedScoreChars: 12345,
    });

    expect(report).toContain('Pautello — informe de diagnóstico');
    expect(report).toContain('Fallos registrados en este navegador: 2');
    expect(report).toContain('Cannot read properties of undefined');
    expect(report).toContain('12345 caracteres');
    expect(report).toContain('no se ha enviado a ningún servidor');
  });

  it('informa cuando no hay partitura autoguardada ni registro previo', () => {
    const report = buildDiagnosticReport({
      error: new Error('boom'),
      log: null,
      storedScoreChars: null,
    });

    expect(report).toContain('Fallos registrados en este navegador: sin registro');
    expect(report).toContain('Partitura autoguardada: ninguna');
  });
});
