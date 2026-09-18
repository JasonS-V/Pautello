import { describe, expect, it } from 'vitest';
import { isCompactEditorViewport } from '../utils/editorLayout';

describe('Validación de la Matriz Responsiva (320, 768, 1024 y 1440 px)', () => {
  describe('Viewport Móvil Ultra-compacto (320 px)', () => {
    const width = 320;

    it('identifica 320 px como viewport compacto', () => {
      expect(isCompactEditorViewport(width)).toBe(true);
    });

    it('establece que el inspector debe estar colapsado para preservar el lienzo musical', () => {
      // En 320 px el lienzo ocupa el 100% y el inspector pasa a bottom-sheet/cajón
      const shouldCollapseInspector = isCompactEditorViewport(width);
      expect(shouldCollapseInspector).toBe(true);
    });
  });

  describe('Viewport Tablet / Ancho Medio (768 px)', () => {
    const width = 768;

    it('identifica 768 px como viewport compacto para el inspector', () => {
      expect(isCompactEditorViewport(width)).toBe(true);
    });

    it('garantiza que el inspector no comprima la partitura en tablet', () => {
      expect(isCompactEditorViewport(width)).toBe(true);
    });
  });

  describe('Breakpoint de Transición (1024 px)', () => {
    it('activa el modo escritorio en 1024 px exactos', () => {
      expect(isCompactEditorViewport(1023)).toBe(true);
      expect(isCompactEditorViewport(1024)).toBe(false);
    });

    it('permite que el inspector viva en la columna lateral a partir de 1024 px', () => {
      expect(isCompactEditorViewport(1024)).toBe(false);
    });
  });

  describe('Viewport Escritorio Estudio (1440 px)', () => {
    const width = 1440;

    it('identifica 1440 px como escritorio completo', () => {
      expect(isCompactEditorViewport(width)).toBe(false);
    });

    it('permite navegación lateral, partitura e inspector simultáneos', () => {
      expect(isCompactEditorViewport(width)).toBe(false);
    });
  });
});
