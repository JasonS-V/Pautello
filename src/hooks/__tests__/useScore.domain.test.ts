import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScore } from '../useScore';

describe('useScore: Historial reactivo, autoguardado y mutaciones de dominio', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('inicia con canUndo y canRedo en false', () => {
    const { result } = renderHook(() => useScore());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('actualiza canUndo a true tras añadir un compás y permite deshacer y rehacer', () => {
    const { result } = renderHook(() => useScore());

    act(() => {
      result.current.addMeasure();
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    // Deshacer
    act(() => {
      result.current.undo();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    // Rehacer
    act(() => {
      result.current.redo();
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('maneja el autoguardado con debounce correctamente', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useScore());
      expect(result.current.saveState).toBe('saved');

      act(() => {
        result.current.addMeasure();
      });

      expect(result.current.saveState).toBe('saving');

      act(() => {
        vi.advanceTimersByTime(550);
      });

      expect(result.current.saveState).toBe('saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('añade y elimina compases preservando integridad', () => {
    const { result } = renderHook(() => useScore());
    const initialMeasures = result.current.score.staves[0].measures.length;

    act(() => {
      result.current.addMeasure();
    });

    expect(result.current.score.staves[0].measures.length).toBe(initialMeasures + 1);

    act(() => {
      result.current.deleteMeasure(initialMeasures);
    });

    expect(result.current.score.staves[0].measures.length).toBe(initialMeasures);
  });

  it('permite alternar el Gran Pentagrama', () => {
    const { result } = renderHook(() => useScore());
    const initialStaves = result.current.score.staves.length;

    act(() => {
      result.current.toggleGrandStaff();
    });

    if (initialStaves === 1) {
      expect(result.current.score.staves.length).toBe(2);
      expect(result.current.isGrandStaff).toBe(true);
    } else {
      expect(result.current.score.staves.length).toBe(1);
    }
  });

  it('permite cambiar la tonalidad y el tempo', () => {
    const { result } = renderHook(() => useScore());

    act(() => {
      result.current.updateTempo(144);
    });
    expect(result.current.score.tempo).toBe(144);

    act(() => {
      result.current.updateKeySignature('G');
    });
    expect(result.current.score.keySignature).toBe('G');
  });
});
