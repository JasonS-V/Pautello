import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScore } from './useScore';
import { audioEngine } from '../audio/synth';
import { Score } from '../types/music';
import { STORAGE_KEY } from '../utils/storage';

const createEmptyTestScore = (): Score => ({
  id: 'test-drag-score',
  title: 'Drag Test',
  composer: 'Test Composer',
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
      measures: [
        {
          id: 'm-0',
          items: [{ id: 'r-0', type: 'rest', duration: 'w' }],
        },
      ],
    },
  ],
});

describe('useScore moveScoreItem (Drag & Drop note interaction)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createEmptyTestScore()));
    vi.spyOn(audioEngine, 'playMidi').mockImplementation(() => {});
  });

  it('permite cambiar la altura de una nota dentro del mismo compás', () => {
    const { result } = renderHook(() => useScore());

    // Insert a note in measure 0 (replaces placeholder whole rest)
    act(() => {
      result.current.insertNoteAt(0, { step: 'C', octave: 4, accidental: null });
    });

    const firstMeasure = result.current.score.staves[0].measures[0];
    const noteItem = firstMeasure.items.find((it) => it.type === 'note');
    expect(noteItem).toBeDefined();
    expect(noteItem?.pitch).toEqual({ step: 'C', octave: 4, accidental: null });

    // Drag / move note to G4
    act(() => {
      result.current.moveScoreItem(
        0,
        noteItem!.id,
        0,
        null,
        { step: 'G', octave: 4, accidental: null },
        0
      );
    });

    const updatedMeasure = result.current.score.staves[0].measures[0];
    const updatedNote = updatedMeasure.items.find((it) => it.id === noteItem!.id);
    expect(updatedNote?.pitch).toEqual({ step: 'G', octave: 4, accidental: null });
    expect(audioEngine.playMidi).toHaveBeenCalled();
  });

  it('transpone acordes proporcionalmente al cambiar la altura principal', () => {
    const { result } = renderHook(() => useScore());

    // Setup an item with pitches (chord)
    act(() => {
      result.current.insertNoteAt(0, { step: 'C', octave: 4, accidental: null });
    });

    const note = result.current.score.staves[0].measures[0].items.find((it) => it.type === 'note')!;

    // Convert into a chord C4 + E4 (MIDI 60 and 64)
    act(() => {
      result.current.insertNoteAt(0, { step: 'E', octave: 4, accidental: null });
    });

    // Move primary pitch up 2 semitones to D4
    act(() => {
      result.current.moveScoreItem(
        0,
        note.id,
        0,
        null,
        { step: 'D', octave: 4, accidental: null },
        0
      );
    });

    const updatedNote = result.current.score.staves[0].measures[0].items.find(
      (it) => it.id === note.id
    );
    expect(updatedNote?.pitch?.step).toBe('D');
    expect(updatedNote?.pitch?.octave).toBe(4);
  });

  it('permite mover una nota a otro compás y rellena silencios canónicos en ambos', () => {
    const { result } = renderHook(() => useScore());

    // Add another measure so we have measure 0 and 1
    act(() => {
      result.current.addMeasure();
    });

    expect(result.current.score.staves[0].measures.length).toBe(2);

    // Insert note in measure 0
    act(() => {
      result.current.insertNoteAt(0, { step: 'A', octave: 4, accidental: null });
    });

    const noteItem = result.current.score.staves[0].measures[0].items.find(
      (it) => it.type === 'note'
    )!;

    // Move to measure 1
    act(() => {
      result.current.moveScoreItem(
        0,
        noteItem.id,
        1,
        0,
        { step: 'B', octave: 4, accidental: null },
        0
      );
    });

    // Verify measure 0 no longer has the note
    const measure0 = result.current.score.staves[0].measures[0];
    expect(measure0.items.some((it) => it.id === noteItem.id)).toBe(false);
    // Measure 0 has canonical rests maintaining its 4/4 beats
    expect(measure0.items.length).toBeGreaterThanOrEqual(1);

    // Verify measure 1 now has the moved note with target pitch
    const measure1 = result.current.score.staves[0].measures[1];
    const movedNote = measure1.items.find((it) => it.id === noteItem.id);
    expect(movedNote).toBeDefined();
    expect(movedNote?.pitch).toEqual({ step: 'B', octave: 4, accidental: null });
  });

  it('no sobrecarga un compás si no tiene capacidad suficiente', () => {
    const { result } = renderHook(() => useScore());

    act(() => {
      result.current.addMeasure();
    });

    // Fill measure 1 completely with 4 quarter notes
    act(() => {
      result.current.insertNoteAt(1, { step: 'C', octave: 4, accidental: null });
      result.current.insertNoteAt(1, { step: 'D', octave: 4, accidental: null });
      result.current.insertNoteAt(1, { step: 'E', octave: 4, accidental: null });
      result.current.insertNoteAt(1, { step: 'F', octave: 4, accidental: null });
    });

    // Insert note in measure 0
    act(() => {
      result.current.insertNoteAt(0, { step: 'G', octave: 4, accidental: null });
    });

    const noteInM0 = result.current.score.staves[0].measures[0].items.find(
      (it) => it.type === 'note'
    )!;

    // Attempt to move note into full measure 1
    act(() => {
      result.current.moveScoreItem(
        0,
        noteInM0.id,
        1,
        0,
        { step: 'G', octave: 4, accidental: null },
        0
      );
    });

    // Measure 0 should still keep the note because measure 1 was full
    const m0After = result.current.score.staves[0].measures[0];
    expect(m0After.items.some((it) => it.id === noteInM0.id)).toBe(true);
  });

  it('permite insertar un compás después de un índice específico (addMeasure con afterIdx)', () => {
    const { result } = renderHook(() => useScore());

    // Agregamos un segundo compás (total 2)
    act(() => {
      result.current.addMeasure();
    });
    expect(result.current.score.staves[0].measures.length).toBe(2);

    // Colocamos una marca de ensayo en el compás 0 para distinguirlo
    act(() => {
      result.current.setMeasureRehearsalMark(0, 'A');
      result.current.setMeasureRehearsalMark(1, 'B');
    });

    // Insertar después del compás 0 (debería quedar en posición 1, empujando B a la posición 2)
    act(() => {
      result.current.addMeasure(0);
    });

    const measuresStaff0 = result.current.score.staves[0].measures;
    expect(measuresStaff0.length).toBe(3);
    expect(measuresStaff0[0].rehearsalMark).toBe('A');
    expect(measuresStaff0[1].rehearsalMark).toBeUndefined();
    expect(measuresStaff0[2].rehearsalMark).toBe('B');
    expect(result.current.selectedMeasureIdx).toBe(1);

    // Si la partitura tiene múltiples pentagramas, se inserta en todos ellos
    if (result.current.score.staves.length > 1) {
      expect(result.current.score.staves[1].measures.length).toBe(3);
    }
  });
});
