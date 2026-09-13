import { useEffect } from 'react';
import { NoteDuration, Step, Accidental } from '../types/music';

interface KeyboardHandlerProps {
  onTogglePlay: () => void;
  onDeleteSelected: () => void;
  onTransposeSelected: (semitones: number) => void;
  onSelectDuration: (duration: NoteDuration) => void;
  onInsertNoteStep: (step: Step) => void;
  onToggleRestMode: () => void;
  onToggleDot: () => void;
  onSetAccidental: (acc: Accidental) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeselect: () => void;
  onOpenShortcuts: () => void;
}

export function useKeyboard({
  onTogglePlay,
  onDeleteSelected,
  onTransposeSelected,
  onSelectDuration,
  onInsertNoteStep,
  onToggleRestMode,
  onToggleDot,
  onSetAccidental,
  onUndo,
  onRedo,
  onDeselect,
  onOpenShortcuts,
}: KeyboardHandlerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside an input, textarea or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

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

      // Space: Play / Pause
      if (e.code === 'Space') {
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

      // Arrow keys: Transposition
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

      // Escape
      if (e.key === 'Escape') {
        onDeselect();
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

      // Rest toggle: 'r' or 'R'
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

      // Accidentals
      if (e.key === '#' || e.key === '+' || e.key.toLowerCase() === 's') {
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

      // Note step entry (A, B, C, D, E, F, G)
      const keyUpper = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(keyUpper)) {
        e.preventDefault();
        onInsertNoteStep(keyUpper as Step);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onTogglePlay,
    onDeleteSelected,
    onTransposeSelected,
    onSelectDuration,
    onInsertNoteStep,
    onToggleRestMode,
    onToggleDot,
    onSetAccidental,
    onUndo,
    onRedo,
    onDeselect,
    onOpenShortcuts,
  ]);
}
