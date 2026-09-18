import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScore } from './useScore';
import { audioEngine } from '../audio/synth';
import { Score } from '../types/music';
import { STORAGE_KEY } from '../utils/storage';

const createTestScore = (measureCount: number): Score => ({
  id: 'test-measure-range',
  title: 'Range Test',
  composer: 'Anónimo',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tempo: 120,
  timeSignature: { beats: 4, beatType: 4 },
  keySignature: 'C',
  staves: [
    {
      id: 'staff-1',
      name: 'Voz',
      clef: 'treble',
      measures: Array.from({ length: measureCount }, (_, i) => ({
        id: `m-${i}`,
        items: [{ id: `r-${i}`, type: 'rest' as const, duration: 'w' as const }],
      })),
    },
  ],
});

describe('useScore extendMeasureRange (rango de compases por teclado)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createTestScore(4)));
    vi.spyOn(audioEngine, 'playMidi').mockImplementation(() => {});
  });

  it('crea el rango hacia la derecha desde el compás seleccionado', () => {
    const { result } = renderHook(() => useScore());

    act(() => result.current.selectMeasure(0, false));
    act(() => result.current.extendMeasureRange(1));

    expect(result.current.measureRange).toEqual({ start: 0, end: 1 });
  });

  it('también crea el rango hacia la izquierda', () => {
    const { result } = renderHook(() => useScore());

    act(() => result.current.selectMeasure(2, false));
    act(() => result.current.extendMeasureRange(-1));

    expect(result.current.measureRange).toEqual({ start: 1, end: 2 });
  });

  it('encoge el rango al volver hacia el ancla, cosa que el Shift+clic no permite', () => {
    const { result } = renderHook(() => useScore());

    act(() => result.current.selectMeasure(1, false));

    act(() => result.current.extendMeasureRange(1));
    act(() => result.current.extendMeasureRange(1));
    expect(result.current.measureRange).toEqual({ start: 1, end: 3 });

    act(() => result.current.extendMeasureRange(-1));
    expect(result.current.measureRange).toEqual({ start: 1, end: 2 });

    // Volver al propio ancla deja el rango vacío, no de un compás.
    act(() => result.current.extendMeasureRange(-1));
    expect(result.current.measureRange).toBeNull();
  });

  it('no se pasa del último compás', () => {
    const { result } = renderHook(() => useScore());

    act(() => result.current.selectMeasure(3, false));
    act(() => result.current.extendMeasureRange(1));

    expect(result.current.measureRange).toBeNull();
  });

  it('un clic simple posterior descarta el rango', () => {
    const { result } = renderHook(() => useScore());

    act(() => result.current.selectMeasure(0, false));
    act(() => result.current.extendMeasureRange(1));
    expect(result.current.measureRange).toEqual({ start: 0, end: 1 });

    act(() => result.current.selectMeasure(3, false));

    expect(result.current.measureRange).toBeNull();
    expect(result.current.selectedMeasureIdx).toBe(3);
  });
});
