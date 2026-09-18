import { useEffect } from 'react';
import { NoteDuration, Step, Accidental, Pitch, KeyboardInputMode } from '../types/music';
import { getPianoKeyMapping, getPitchFromPianoKey } from '../constants/keyboardLayout';

interface KeyboardHandlerProps {
  inputMode?: KeyboardInputMode;
  pianoBaseOctave?: number;
  onShiftOctave?: (delta: number) => void;
  onInsertPitchDirect?: (pitch: Pitch) => void;
  onAddPitchDirectToChord?: (pitch: Pitch) => void;
  onTogglePlay: () => void;
  onDeleteSelected: () => void;
  /** Inserta un compás después del compás seleccionado. */
  onAddMeasure?: () => void;
  /** Extiende (±1 compás) el rango de compases seleccionado. */
  onExtendMeasureRange?: (delta: number) => void;
  onTransposeSelected: (semitones: number) => void;
  onSelectDuration: (duration: NoteDuration) => void;
  onInsertNoteStep: (step: Step) => void;
  onAddPitchToChord?: (step: Step) => void;
  onToggleRestMode: () => void;
  onToggleDot: () => void;
  onToggleTuplet?: () => void;
  onToggleTie?: () => void;
  onToggleSlur?: () => void;
  onSetAccidental: (acc: Accidental) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeselect: () => void;
  onOpenShortcuts: () => void;
  onNavigatePreviousItem?: () => void;
  onNavigateNextItem?: () => void;
  onCopyMeasureRange?: () => void;
  onPasteMeasureRange?: () => void;
  onStartLyricsInput?: () => void;
  onOpenLibrary?: () => void;
  onToggleVoice?: () => void;
  onSelectVoice?: (voice: 1 | 2) => void;
}

/** El elemento enfocado, visto solo por lo que el teclado necesita saber de él. */
interface FocusTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

const tagOf = (target: FocusTargetLike): string => (target.tagName ?? '').toUpperCase();

/** Campos de texto y desplegables: ahí el teclado escribe, no dispara atajos. */
export function isTypingTarget(target: FocusTargetLike | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagOf(target));
}

/**
 * Controles que se activan con la barra espaciadora. Con uno de ellos enfocado
 * hay que cederle la tecla: si no, no se puede activar un botón con el teclado,
 * que es lo mínimo para poder usar la app sin ratón.
 */
export function isActivationTarget(target: FocusTargetLike | null | undefined): boolean {
  if (!target) return false;
  if (['BUTTON', 'A'].includes(tagOf(target))) return true;
  if (typeof target.closest !== 'function') return false;
  return !!target.closest('[role="button"], [role="link"], [role="menuitem"]');
}

export function useKeyboard({
  inputMode = 'piano',
  pianoBaseOctave = 4,
  onShiftOctave,
  onInsertPitchDirect,
  onAddPitchDirectToChord,
  onTogglePlay,
  onDeleteSelected,
  onAddMeasure,
  onExtendMeasureRange,
  onTransposeSelected,
  onSelectDuration,
  onInsertNoteStep,
  onAddPitchToChord,
  onToggleRestMode,
  onToggleDot,
  onToggleTuplet,
  onToggleTie,
  onToggleSlur,
  onSetAccidental,
  onUndo,
  onRedo,
  onDeselect,
  onOpenShortcuts,
  onNavigatePreviousItem,
  onNavigateNextItem,
  onCopyMeasureRange,
  onPasteMeasureRange,
  onStartLyricsInput,
  onOpenLibrary,
  onToggleVoice,
  onSelectVoice,
}: KeyboardHandlerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside an input, textarea or contenteditable
      const target = e.target as HTMLElement;
      if (isTypingTarget(target)) return;

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
        return;
      }

      // Space: Play / Pause, salvo si el foco está en un control que se activa
      // con la propia barra espaciadora (un botón, un enlace).
      if (e.code === 'Space') {
        if (isActivationTarget(target)) return;
        e.preventDefault();
        onTogglePlay();
        return;
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteSelected();
        return;
      }

      // Insertar compás. `Insert` cubre los teclados de escritorio y
      // Ctrl/Cmd+Enter los portátiles que no tienen esa tecla (Mac).
      if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        e.preventDefault();
        onAddMeasure?.();
        return;
      }

      // Copy / Paste measures
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        onCopyMeasureRange?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        onPasteMeasureRange?.();
        return;
      }

      // Ctrl + O: Open Score Library
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        onOpenLibrary?.();
        return;
      }

      // Ctrl + L (or Cmd + L): Inline Lyric Editor
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        onStartLyricsInput?.();
        return;
      }

      // Shift + ←/→: extender o encoger el rango de compases seleccionado.
      // Va antes que la navegación para que las flechas con Shift no muevan
      // el foco de nota.
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        onExtendMeasureRange?.(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }

      // Arrow keys: Navigation & Transposition
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigatePreviousItem?.();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigateNextItem?.();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onTransposeSelected(e.shiftKey ? 12 : 1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onTransposeSelected(e.shiftKey ? -12 : -1);
        return;
      }

      // Escape: solo deselecciona si ningún modal/diálogo está abierto.
      // Los diálogos (ModalBase) cierran con su propio listener; aquí hay que
      // cederles el paso explícitamente comprobando si hay alguno montado.
      if (e.key === 'Escape') {
        if (!document.querySelector('[role="dialog"]')) {
          onDeselect();
        }
        return;
      }

      // Help modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        onOpenShortcuts();
        return;
      }

      // Duration hotkeys: 1..5
      const durationMap: Record<string, NoteDuration> = {
        '1': 'w',
        '2': 'h',
        '3': 'q',
        '4': '8',
        '5': '16',
        '6': '32',
      };
      if (durationMap[e.key]) {
        e.preventDefault();
        onSelectDuration(durationMap[e.key]);
        return;
      }

      // Rest toggle: 'r' or 'R' (funciona en ambos modos, queda en el hueco entre Mi y Fa)
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onToggleRestMode();
        return;
      }

      // Dot: '.'
      if (e.key === '.') {
        e.preventDefault();
        onToggleDot();
        return;
      }

      // Tuplet: 't' o 'T' en modo notación, o Ctrl+3 en ambos modos
      if ((e.ctrlKey && e.key === '3') || (inputMode !== 'piano' && e.key.toLowerCase() === 't')) {
        e.preventDefault();
        onToggleTuplet?.();
        return;
      }

      // Tie / Slur: 'l' o 'L' en notación, o Alt+L en piano (ya que 'L' es la nota Re en octava +1)
      const isTieKey =
        inputMode === 'piano'
          ? e.altKey && e.key.toLowerCase() === 'l'
          : e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey;
      if (isTieKey) {
        e.preventDefault();
        if (e.shiftKey) {
          onToggleSlur?.();
        } else {
          onToggleTie?.();
        }
        return;
      }

      // Accidentals: en modo piano solo '#' y '+' activan sostenido ('S' es la nota Re)
      const isSharpKey =
        e.key === '#' || e.key === '+' || (inputMode !== 'piano' && e.key.toLowerCase() === 's');
      if (isSharpKey) {
        onSetAccidental('#');
        return;
      }
      if (e.key === '-' || e.key === '_') {
        onSetAccidental('b');
        return;
      }
      if (e.key.toLowerCase() === 'n') {
        onSetAccidental('n');
        return;
      }

      // Voice switching: 'v' or 'V' toggles voice, Alt+1/Alt+2 selects directly
      if (e.altKey && (e.key === '1' || e.key === '2')) {
        e.preventDefault();
        onSelectVoice?.(e.key === '1' ? 1 : 2);
        return;
      }
      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onToggleVoice?.();
        return;
      }

      // --- CAMBIO DE OCTAVA (Z: bajar, X: subir - estándar DAW) ---
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          onShiftOctave?.(-1);
          return;
        }
        if (e.key.toLowerCase() === 'x') {
          e.preventDefault();
          onShiftOctave?.(1);
          return;
        }
      }

      // --- MODO PIANO QWERTY ---
      if (inputMode === 'piano') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          // Disparo de notas del piano QWERTY
          const mapping = getPianoKeyMapping(e);
          if (mapping) {
            e.preventDefault();
            const pitch = getPitchFromPianoKey(mapping, pianoBaseOctave);
            if (e.shiftKey && (onAddPitchDirectToChord || onAddPitchToChord)) {
              if (onAddPitchDirectToChord) {
                onAddPitchDirectToChord(pitch);
              } else if (onAddPitchToChord) {
                onAddPitchToChord(pitch.step);
              }
            } else if (onInsertPitchDirect) {
              onInsertPitchDirect(pitch);
            } else {
              onInsertNoteStep(pitch.step);
            }
            return;
          }
        }
      }

      // --- MODO NOTACIÓN CLÁSICA (Cifrado A-G tipo MuseScore) ---
      if (inputMode !== 'piano') {
        const keyUpper = e.key.toUpperCase();
        if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(keyUpper)) {
          e.preventDefault();
          if (e.shiftKey && onAddPitchToChord) {
            onAddPitchToChord(keyUpper as Step);
          } else {
            onInsertNoteStep(keyUpper as Step);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    inputMode,
    pianoBaseOctave,
    onShiftOctave,
    onInsertPitchDirect,
    onAddPitchDirectToChord,
    onTogglePlay,
    onDeleteSelected,
    onAddMeasure,
    onExtendMeasureRange,
    onTransposeSelected,
    onSelectDuration,
    onInsertNoteStep,
    onAddPitchToChord,
    onToggleRestMode,
    onToggleDot,
    onToggleTuplet,
    onToggleTie,
    onToggleSlur,
    onSetAccidental,
    onToggleVoice,
    onSelectVoice,
    onUndo,
    onRedo,
    onDeselect,
    onOpenShortcuts,
    onNavigatePreviousItem,
    onNavigateNextItem,
    onCopyMeasureRange,
    onPasteMeasureRange,
    onOpenLibrary,
    onStartLyricsInput,
  ]);
}
