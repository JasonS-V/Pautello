import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoreInspector } from '../ScoreInspector';
import { Score } from '../../../types/music';

const mockScore: Score = {
  id: 'test-score',
  createdAt: 1000,
  updatedAt: 1000,
  title: 'Test Score',
  composer: 'Test Composer',
  tempo: 120,
  timeSignature: { beats: 4, beatType: 4 },
  keySignature: 'C',
  staves: [
    {
      id: 'staff-1',
      name: 'Melodía',
      clef: 'treble',
      measures: [
        {
          id: 'm-1',
          items: [
            {
              id: 'note-1',
              type: 'note',
              duration: 'q',
              pitch: { step: 'C', octave: 4, accidental: null },
            },
          ],
        },
      ],
    },
  ],
};

describe('ScoreInspector Component', () => {
  const defaultProps = {
    score: mockScore,
    selectedMeasureIdx: 0,
    selectedItemId: 'note-1',
    namingConvention: 'latin' as const,
    clef: 'treble' as const,
    onUpdateClef: vi.fn(),
    timeSignature: { beats: 4, beatType: 4 },
    onUpdateTimeSignature: vi.fn(),
    keySignature: 'C' as const,
    onUpdateKeySignature: vi.fn(),
    onAddMeasure: vi.fn(),
    onDeleteMeasure: vi.fn(),
    onDeleteSelected: vi.fn(),
    onTransposeSelected: vi.fn(),
    onUpdateLyric: vi.fn(),
    onUpdateStep: vi.fn(),
    canUndo: true,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  };

  it('renderiza la cabecera del inspector y los botones de las tres pestañas', () => {
    render(<ScoreInspector {...defaultProps} />);

    expect(screen.getByRole('heading', { level: 2, name: /inspector/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeDefined();
    expect(screen.getByTitle(/propiedades de la nota/i)).toBeDefined();
    expect(screen.getByTitle(/propiedades del compás actual/i)).toBeDefined();
    expect(screen.getByTitle(/estructura e instrumentos/i)).toBeDefined();
  });

  it('permite cambiar entre pestañas de Nota, Compás y Partitura', () => {
    render(<ScoreInspector {...defaultProps} />);

    // Click en pestaña Compás
    const compasTabBtn = screen.getByTitle(/propiedades del compás actual/i);
    fireEvent.click(compasTabBtn);
    expect(screen.getByText('Acciones')).toBeDefined();

    // Click en pestaña Partitura
    const partituraTabBtn = screen.getByTitle(/estructura e instrumentos/i);
    fireEvent.click(partituraTabBtn);
    expect(screen.getByText(/Armadura/i)).toBeDefined();
    expect(screen.getAllByText(/Clave/i).length).toBeGreaterThan(0);
  });

  it('ejecuta onUndo al pulsar el botón de deshacer', () => {
    render(<ScoreInspector {...defaultProps} />);
    const undoBtn = screen.getByRole('button', { name: /deshacer/i });
    fireEvent.click(undoBtn);
    expect(defaultProps.onUndo).toHaveBeenCalledTimes(1);
  });

  it('muestra estado colapsado cuando isCollapsed es true', () => {
    render(<ScoreInspector {...defaultProps} isCollapsed={true} onToggleCollapse={vi.fn()} />);
    expect(screen.getByTitle(/abrir panel inspector/i)).toBeDefined();
  });
});
