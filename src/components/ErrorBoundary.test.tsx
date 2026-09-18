import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { readErrorLog } from '../utils/errorLog';

function Explota(): ReactNode {
  throw new Error('fallo de dibujo simulado');
}

describe('ErrorBoundary: pantalla de rescate', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    // React imprime por consola el error capturado; silenciarlo mantiene la
    // salida de las pruebas legible.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('muestra el mensaje del error y anota el fallo en el registro local', () => {
    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>
    );

    expect(screen.getByText('Algo se rompió al dibujar la partitura')).toBeDefined();
    expect(screen.getByText('fallo de dibujo simulado')).toBeDefined();
    expect(readErrorLog()).toMatchObject({
      failures: 1,
      last: { message: 'fallo de dibujo simulado' },
    });
  });

  it('copia el diagnóstico al portapapeles y lo confirma', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Copiar diagnóstico'));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('Pautello — informe de diagnóstico');
    expect(writeText.mock.calls[0][0]).toContain('fallo de dibujo simulado');
    expect(await screen.findByText('Diagnóstico copiado')).toBeDefined();
  });

  it('cuenta el fallo otra vez al reintentar y lo muestra al usuario', async () => {
    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Reintentar'));

    expect(readErrorLog()?.failures).toBe(2);
    expect(await screen.findByText(/Es el fallo nº 2 en este navegador/)).toBeDefined();
  });
});
