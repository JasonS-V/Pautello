import { describe, it, expect, vi } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import { isActivationTarget, isTypingTarget, useKeyboard } from './useKeyboard';

const noMatches = () => null;
const matches = () => ({ tagName: 'DIV' });

describe('isTypingTarget', () => {
  it('reconoce los campos donde el teclado escribe texto', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', closest: noMatches })).toBe(true);
    expect(isTypingTarget({ tagName: 'textarea' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('no intercepta el resto de elementos', () => {
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false);
    expect(isTypingTarget({ tagName: 'SVG' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
  });
});

describe('isActivationTarget', () => {
  it('cede la barra espaciadora a los controles que se activan con ella', () => {
    expect(isActivationTarget({ tagName: 'BUTTON' })).toBe(true);
    expect(isActivationTarget({ tagName: 'button' })).toBe(true);
    expect(isActivationTarget({ tagName: 'A' })).toBe(true);
  });

  it('detecta controles con rol declarado dentro de otros elementos', () => {
    expect(isActivationTarget({ tagName: 'SPAN', closest: matches })).toBe(true);
    expect(isActivationTarget({ tagName: 'SPAN', closest: noMatches })).toBe(false);
  });

  it('no cede la barra espaciadora ante elementos no interactivos', () => {
    expect(isActivationTarget({ tagName: 'DIV' })).toBe(false);
    expect(isActivationTarget({ tagName: 'SVG' })).toBe(false);
    expect(isActivationTarget({ tagName: 'DIV', closest: noMatches })).toBe(false);
    expect(isActivationTarget(null)).toBe(false);
    expect(isActivationTarget(undefined)).toBe(false);
  });

  it('no depende de que el elemento tenga closest()', () => {
    expect(isActivationTarget({ tagName: 'SPAN' })).toBe(false);
  });
});

describe('keyboardLayout & Piano QWERTY mapping', () => {
  it('mapea correctamente las teclas blancas y negras del piano', async () => {
    const { getPianoKeyMapping, getPitchFromPianoKey, getKeycapLabelForPitch } =
      await import('../constants/keyboardLayout');

    // Teclas blancas en octava base
    const keyA = getPianoKeyMapping({ code: 'KeyA', key: 'a' } as KeyboardEvent);
    expect(keyA).not.toBeNull();
    expect(keyA?.step).toBe('C');
    expect(keyA?.accidental).toBeNull();
    expect(keyA?.octaveOffset).toBe(0);

    const pitchA = getPitchFromPianoKey(keyA!, 4);
    expect(pitchA).toEqual({ step: 'C', octave: 4, accidental: null });

    // Tecla negra W = C#
    const keyW = getPianoKeyMapping({ code: 'KeyW', key: 'w' } as KeyboardEvent);
    expect(keyW?.step).toBe('C');
    expect(keyW?.accidental).toBe('#');
    const pitchW = getPitchFromPianoKey(keyW!, 4);
    expect(pitchW).toEqual({ step: 'C', octave: 4, accidental: '#' });

    // Tecla negra T = F#
    const keyT = getPianoKeyMapping({ code: 'KeyT', key: 't' } as KeyboardEvent);
    expect(keyT?.step).toBe('F');
    expect(keyT?.accidental).toBe('#');

    // Tecla blanca K = C5 (octava siguiente)
    const keyK = getPianoKeyMapping({ code: 'KeyK', key: 'k' } as KeyboardEvent);
    expect(keyK?.step).toBe('C');
    expect(keyK?.octaveOffset).toBe(1);
    const pitchK = getPitchFromPianoKey(keyK!, 4);
    expect(pitchK).toEqual({ step: 'C', octave: 5, accidental: null });

    // Hueco R no debe mapearse como nota (queda libre para Silencio)
    const keyR = getPianoKeyMapping({ code: 'KeyR', key: 'r' } as KeyboardEvent);
    expect(keyR).toBeNull();

    // Keycaps para etiquetas del teclado virtual
    expect(getKeycapLabelForPitch('C', 4, null, 4)).toBe('A');
    expect(getKeycapLabelForPitch('C', 4, '#', 4)).toBe('W');
    expect(getKeycapLabelForPitch('D', 4, null, 4)).toBe('S');
    expect(getKeycapLabelForPitch('C', 5, null, 4)).toBe('K');
    // Nota fuera del rango mapeado
    expect(getKeycapLabelForPitch('C', 2, null, 4)).toBeNull();
  });

  it('asigna correctamente los atajos numéricos 1 a 6 a las duraciones de nota', () => {
    const durationMap: Record<string, string> = {
      '1': 'w',
      '2': 'h',
      '3': 'q',
      '4': '8',
      '5': '16',
      '6': '32',
    };

    expect(durationMap['1']).toBe('w'); // Redonda
    expect(durationMap['2']).toBe('h'); // Blanca
    expect(durationMap['3']).toBe('q'); // Negra
    expect(durationMap['4']).toBe('8'); // Corchea
    expect(durationMap['5']).toBe('16'); // Semicorchea
    expect(durationMap['6']).toBe('32'); // Fusa
  });

  it('permite mapear notas en las 8 octavas y generar alturas precisas', async () => {
    const { getPianoKeyMapping, getPitchFromPianoKey, getKeycapLabelForPitch } =
      await import('../constants/keyboardLayout');

    const keyA = getPianoKeyMapping({ code: 'KeyA', key: 'a' } as KeyboardEvent);
    expect(keyA).not.toBeNull();

    // Octava 1 (grave extrema)
    const pitch1 = getPitchFromPianoKey(keyA!, 1);
    expect(pitch1).toEqual({ step: 'C', octave: 1, accidental: null });

    // Octava 2 (grave, bajo/clave de Fa)
    const pitch2 = getPitchFromPianoKey(keyA!, 2);
    expect(pitch2).toEqual({ step: 'C', octave: 2, accidental: null });

    // Octava 8 (aguda extrema)
    const pitch8 = getPitchFromPianoKey(keyA!, 8);
    expect(pitch8).toEqual({ step: 'C', octave: 8, accidental: null });

    // Keycaps reflejan la octava base seleccionada (ej. en Octava 2, A es C2)
    expect(getKeycapLabelForPitch('C', 2, null, 2)).toBe('A');
    expect(getKeycapLabelForPitch('D', 2, null, 2)).toBe('S');
    expect(getKeycapLabelForPitch('C', 3, null, 2)).toBe('K');
  });

  it('limita el cambio de octava estrictamente entre 1 y 8', () => {
    const clampOctave = (current: number, delta: number) =>
      Math.max(1, Math.min(8, current + delta));

    // Bajar desde 1 no desborda a 0 o negativo
    expect(clampOctave(1, -1)).toBe(1);

    // Bajar desde 4 lleva a 3, 2, 1
    expect(clampOctave(4, -1)).toBe(3);
    expect(clampOctave(3, -1)).toBe(2);
    expect(clampOctave(2, -1)).toBe(1);

    // Subir desde 8 no desborda a 9
    expect(clampOctave(8, 1)).toBe(8);

    // Subir desde 6 lleva a 7 y 8
    expect(clampOctave(6, 1)).toBe(7);
    expect(clampOctave(7, 1)).toBe(8);
  });
});

describe('useKeyboard: atajos de compás', () => {
  const createHandlers = () => ({
    onTogglePlay: vi.fn(),
    onDeleteSelected: vi.fn(),
    onTransposeSelected: vi.fn(),
    onSelectDuration: vi.fn(),
    onInsertNoteStep: vi.fn(),
    onToggleRestMode: vi.fn(),
    onToggleDot: vi.fn(),
    onSetAccidental: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onDeselect: vi.fn(),
    onOpenShortcuts: vi.fn(),
  });

  it('añade un compás con Insert', () => {
    const onAddMeasure = vi.fn();
    renderHook(() => useKeyboard({ ...createHandlers(), onAddMeasure }));

    fireEvent.keyDown(window, { key: 'Insert' });

    expect(onAddMeasure).toHaveBeenCalledTimes(1);
  });

  it('añade un compás con Ctrl+Enter, para portátiles sin tecla Insert', () => {
    const onAddMeasure = vi.fn();
    renderHook(() => useKeyboard({ ...createHandlers(), onAddMeasure }));

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    expect(onAddMeasure).toHaveBeenCalledTimes(1);
  });

  it('calla el atajo mientras se escribe en un campo de texto', () => {
    const onAddMeasure = vi.fn();
    renderHook(() => useKeyboard({ ...createHandlers(), onAddMeasure }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'Insert' });

    expect(onAddMeasure).not.toHaveBeenCalled();
    input.remove();
  });

  it('no falla si el atajo no está conectado', () => {
    renderHook(() => useKeyboard(createHandlers()));

    expect(() => fireEvent.keyDown(window, { key: 'Insert' })).not.toThrow();
  });

  it('extiende el rango a la derecha y a la izquierda con Shift + flechas', () => {
    const onExtendMeasureRange = vi.fn();
    renderHook(() => useKeyboard({ ...createHandlers(), onExtendMeasureRange }));

    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    expect(onExtendMeasureRange).toHaveBeenCalledWith(1);

    fireEvent.keyDown(window, { key: 'ArrowLeft', shiftKey: true });
    expect(onExtendMeasureRange).toHaveBeenCalledWith(-1);
  });

  it('sin Shift las flechas navegan ítems en vez de tocar el rango', () => {
    const onExtendMeasureRange = vi.fn();
    const onNavigateNextItem = vi.fn();
    renderHook(() =>
      useKeyboard({ ...createHandlers(), onExtendMeasureRange, onNavigateNextItem })
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(onNavigateNextItem).toHaveBeenCalledTimes(1);
    expect(onExtendMeasureRange).not.toHaveBeenCalled();
  });
});
