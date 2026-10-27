import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoreView } from '../ScoreView';
import { Score } from '../../../types/music';

const mockScore: Score = {
  id: 'test-score',
  createdAt: 1000,
  updatedAt: 1000,
  title: 'Partitura de Prueba',
  composer: 'Compositor de Prueba',
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
            {
              id: 'rest-1',
              type: 'rest',
              duration: 'q',
            },
          ],
        },
        {
          id: 'm-2',
          items: [
            {
              id: 'note-2',
              type: 'note',
              duration: 'h',
              pitch: { step: 'G', octave: 4, accidental: null },
            },
          ],
        },
      ],
    },
  ],
};

const mockPlaybackState = {
  isPlaying: false,
  isPaused: false,
  currentMeasureIndex: 0,
  currentItemIndex: 0,
  currentBeat: 0,
};

describe('ScoreView Component', () => {
  it('renderiza la cabecera en modo continuo con el título y compositor', () => {
    const onSelectItem = vi.fn();
    const onInsertNoteAt = vi.fn();
    const onInsertRestAt = vi.fn();
    const onDeleteMeasure = vi.fn();

    render(
      <ScoreView
        score={mockScore}
        selectedItemId={null}
        selectedMeasureIdx={0}
        onSelectItem={onSelectItem}
        onInsertNoteAt={onInsertNoteAt}
        onInsertRestAt={onInsertRestAt}
        onDeleteMeasure={onDeleteMeasure}
        activeDuration="q"
        activeAccidental={null}
        isRestMode={false}
        namingConvention="english"
        showNoteNames={false}
        playbackState={mockPlaybackState}
        layoutMode="continuous"
      />
    );

    expect(screen.getByText('Partitura de Prueba')).toBeInTheDocument();
    expect(screen.getByText('Compositor de Prueba')).toBeInTheDocument();
    expect(screen.getByText(/Guía Rápida:/i)).toBeInTheDocument();
  });

  it('permite cambiar a modo paginado y renderiza el contenedor de páginas', () => {
    const onSelectItem = vi.fn();
    const onInsertNoteAt = vi.fn();
    const onInsertRestAt = vi.fn();
    const onDeleteMeasure = vi.fn();

    const { container } = render(
      <ScoreView
        score={mockScore}
        selectedItemId={null}
        selectedMeasureIdx={0}
        onSelectItem={onSelectItem}
        onInsertNoteAt={onInsertNoteAt}
        onInsertRestAt={onInsertRestAt}
        onDeleteMeasure={onDeleteMeasure}
        activeDuration="q"
        activeAccidental={null}
        isRestMode={false}
        namingConvention="latin"
        showNoteNames={true}
        playbackState={mockPlaybackState}
        layoutMode="paged"
      />
    );

    expect(container.querySelector('.score-pages-wrapper')).toBeInTheDocument();
    expect(container.querySelector('.score-page')).toBeInTheDocument();
  });

  it('llama a onSelectItem al hacer clic en el contenedor principal', () => {
    const onSelectItem = vi.fn();
    const onInsertNoteAt = vi.fn();
    const onInsertRestAt = vi.fn();
    const onDeleteMeasure = vi.fn();

    const { container } = render(
      <ScoreView
        score={mockScore}
        selectedItemId="note-1"
        selectedMeasureIdx={0}
        onSelectItem={onSelectItem}
        onInsertNoteAt={onInsertNoteAt}
        onInsertRestAt={onInsertRestAt}
        onDeleteMeasure={onDeleteMeasure}
        activeDuration="q"
        activeAccidental={null}
        isRestMode={false}
        namingConvention="latin"
        showNoteNames={false}
        playbackState={mockPlaybackState}
      />
    );

    const mainContainer = container.querySelector('.score-view-container');
    if (mainContainer) {
      fireEvent.click(mainContainer);
      expect(onSelectItem).toHaveBeenCalled();
    }
  });
});
