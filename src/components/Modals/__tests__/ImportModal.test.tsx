import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImportModal } from '../ImportModal';
import { OmrReviewPanel } from '../OmrReviewPanel';
import { recognizeScoreFromFile } from '../../../omr/omrEngine';
import { Score } from '../../../types/music';
import { assembleIR, lineFragment } from '../../../omr/omrDecode';
import { convertOmrIrToScore } from '../../../omr/omrToScore';
import { loadOmrDraft, saveOmrDraft } from '../../../omr/omrDraftPersistence';

vi.mock('../../../omr/omrEngine', () => ({ recognizeScoreFromFile: vi.fn() }));
vi.mock('../../../omr/omrDraftPersistence', () => ({
  loadOmrDraft: vi.fn().mockResolvedValue(null),
  saveOmrDraft: vi.fn().mockResolvedValue(undefined),
}));

const score: Score = {
  id: 'score-1',
  title: 'Prueba de lectura',
  composer: 'Anónimo',
  tempo: 120,
  timeSignature: { beats: 3, beatType: 4 },
  keySignature: 'C',
  staves: [
    {
      id: 'staff-1',
      name: 'Bajo',
      clef: 'bass',
      measures: [
        {
          id: 'measure-1',
          items: [
            {
              id: 'note-1',
              type: 'note',
              pitch: { step: 'C', octave: 3, accidental: null },
              duration: 'q',
            },
          ],
        },
      ],
    },
  ],
  createdAt: 1,
  updatedAt: 1,
};

describe('ImportModal: avisos OMR', () => {
  beforeEach(() => {
    vi.mocked(loadOmrDraft).mockResolvedValue(null);
    vi.mocked(saveOmrDraft).mockResolvedValue(undefined);
  });
  it('envía el rango elegido al lector PDF', async () => {
    vi.mocked(recognizeScoreFromFile).mockResolvedValue({
      score,
      confidence: 100,
      pagesProcessed: 2,
      stavesDetected: 1,
      measuresDetected: 1,
      notesDetected: 1,
      sourceType: 'lossless-metadata',
      ir: null,
      sourceLinks: [],
      warnings: [],
    });
    render(<ImportModal isOpen onClose={vi.fn()} onImportScore={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Páginas del PDF/), { target: { value: '3-4' } });
    fireEvent.change(screen.getByLabelText('Seleccionar archivo a importar'), {
      target: { files: [new File(['%PDF-1.7'], 'prueba.pdf')] },
    });
    await waitFor(() => expect(recognizeScoreFromFile).toHaveBeenCalled());
    expect(vi.mocked(recognizeScoreFromFile).mock.lastCall?.[2]).toEqual(
      expect.objectContaining({ pdfPageRange: '3-4', signal: expect.any(AbortSignal) })
    );
  });

  it('envía el giro explícito de 180° antes de reconocer', async () => {
    vi.mocked(recognizeScoreFromFile).mockResolvedValue({
      score,
      confidence: 100,
      pagesProcessed: 1,
      stavesDetected: 1,
      measuresDetected: 1,
      notesDetected: 1,
      sourceType: 'lossless-metadata',
      ir: null,
      sourceLinks: [],
      warnings: [],
    });
    render(<ImportModal isOpen onClose={vi.fn()} onImportScore={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Orientación de la imagen o PDF' }));
    fireEvent.click(screen.getByRole('option', { name: 'Girar 180°' }));
    fireEvent.change(screen.getByLabelText('Seleccionar archivo a importar'), {
      target: { files: [new File(['%PDF-1.7'], 'girado.pdf')] },
    });
    await waitFor(() =>
      expect(vi.mocked(recognizeScoreFromFile).mock.lastCall?.[2]).toEqual(
        expect.objectContaining({
          pdfPageRange: '',
          rotation: 180,
          signal: expect.any(AbortSignal),
        })
      )
    );
  });

  it('cancela una lectura tardía sin reemplazar el documento y permite reintentar', async () => {
    let finish!: (value: Awaited<ReturnType<typeof recognizeScoreFromFile>>) => void;
    vi.mocked(recognizeScoreFromFile)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValueOnce({
        score,
        confidence: 100,
        pagesProcessed: 1,
        stavesDetected: 1,
        measuresDetected: 1,
        notesDetected: 1,
        sourceType: 'lossless-metadata',
        ir: null,
        sourceLinks: [],
        warnings: [],
      });
    const onImportScore = vi.fn();
    render(<ImportModal isOpen onClose={vi.fn()} onImportScore={onImportScore} />);
    const input = screen.getByLabelText('Seleccionar archivo a importar');
    fireEvent.change(input, { target: { files: [new File(['%PDF-1.7'], 'primero.pdf')] } });
    await screen.findByRole('button', { name: 'Cancelar importación' });
    const signal = vi.mocked(recognizeScoreFromFile).mock.lastCall?.[2]?.signal;
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar importación' }));
    expect(signal?.aborted).toBe(true);
    finish({
      score,
      confidence: 100,
      pagesProcessed: 1,
      stavesDetected: 1,
      measuresDetected: 1,
      notesDetected: 1,
      sourceType: 'lossless-metadata',
      ir: null,
      sourceLinks: [],
      warnings: [],
    });
    expect(onImportScore).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File(['%PDF-1.7'], 'segundo.pdf')] } });
    await screen.findByText('Prueba de lectura');
    expect(recognizeScoreFromFile).toHaveBeenCalledTimes(2);
  });

  it('mantiene el contexto de una región dentro de los límites de la página', () => {
    render(
      <OmrReviewPanel
        result={{
          score,
          confidence: 50,
          pagesProcessed: 1,
          stavesDetected: 1,
          measuresDetected: 1,
          notesDetected: 1,
          sourceType: 'neural-onnx',
          ir: null,
          sourceLinks: [],
          sourcePages: [
            {
              pageNumber: 1,
              width: 800,
              height: 1000,
              imageUrl: 'data:image/png;base64,eA==',
              deskewAngleDeg: 1.5,
            },
          ],
          warnings: [
            {
              code: 'test',
              severity: 'warning',
              provenance: 'observed',
              message: 'Borde',
              src: { page: 1, system: 0, staff: 0, bbox: [790, 990, 10, 10] },
            },
          ],
        }}
      />
    );
    const image = screen.getByRole('img', { name: 'Fuente, página 1' });
    const [x, y, width, height] = image.getAttribute('viewBox')!.split(' ').map(Number);
    expect(x + width).toBeLessThanOrEqual(800);
    expect(y + height).toBeLessThanOrEqual(1000);
    expect(image.querySelector('image')).toHaveAttribute('transform', 'rotate(-1.5 400 500)');
  });

  it('muestra confianza y ubicación de los registros que necesitan revisión', async () => {
    vi.mocked(recognizeScoreFromFile).mockResolvedValue({
      score,
      confidence: 72,
      pagesProcessed: 2,
      stavesDetected: 1,
      measuresDetected: 1,
      notesDetected: 1,
      sourceType: 'neural-onnx',
      ir: null,
      sourceLinks: [],
      sourcePages: [
        {
          pageNumber: 2,
          width: 800,
          height: 1000,
          imageUrl: 'data:image/png;base64,eA==',
          deskewAngleDeg: 0,
        },
      ],
      warnings: [
        {
          code: 'unparseable-tokens',
          severity: 'error',
          provenance: 'unsupported',
          page: 2,
          system: 1,
          staff: 0,
          tokens: ['16'],
          message: '16',
          src: { page: 2, system: 1, staff: 0, bbox: [40, 80, 10, 100] },
        },
      ],
    });
    render(<ImportModal isOpen onClose={vi.fn()} onImportScore={vi.fn()} />);
    const input = screen.getByLabelText('Seleccionar archivo a importar');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'partitura.png', { type: 'image/png' })] },
    });

    await waitFor(() =>
      expect(screen.getByText(/72% confianza del reconocimiento/)).toBeInTheDocument()
    );
    expect(screen.queryByText(/72% precisión/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Revisar \d+ aviso\(s\) de lectura/));
    expect(screen.getByText(/Página 2, sistema 2, pauta 1:/)).toBeInTheDocument();
    expect(screen.getByText('Región: x=40, y=80')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver región del aviso 1' }));
    expect(screen.getByRole('img', { name: /Fuente, página 2/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver página completa' }));
    expect(screen.getByRole('img', { name: /Fuente, página 2/ })).toHaveAttribute(
      'viewBox',
      '0 0 800 1000'
    );
  });

  it('permite corregir roles editoriales antes de confirmar y conserva el arreglista en la sesión', async () => {
    vi.mocked(recognizeScoreFromFile).mockResolvedValue({
      score: { ...score, partName: 'Bajo' },
      confidence: 72,
      pagesProcessed: 1,
      stavesDetected: 1,
      measuresDetected: 1,
      notesDetected: 1,
      sourceType: 'neural-onnx',
      ir: null,
      sourceLinks: [],
      warnings: [],
      metadataHints: { arranger: 'Jeff Nevis' },
      editorial: {
        proposals: [
          {
            field: 'arranger',
            value: 'Jeff Nevis',
            confidence: 0.92,
            source: { page: 1, bbox: [50, 40, 90, 15] },
          },
        ],
        unclassified: [],
      },
    });
    const onImportScore = vi.fn();
    render(<ImportModal isOpen onClose={vi.fn()} onImportScore={onImportScore} />);
    fireEvent.change(screen.getByLabelText('Seleccionar archivo a importar'), {
      target: { files: [new File(['x'], 'partitura.png')] },
    });
    fireEvent.change(await screen.findByLabelText(/^Título/), { target: { value: 'El Rey' } });
    fireEvent.change(screen.getByLabelText(/^Compositor/), {
      target: { value: 'José Alfredo Jiménez' },
    });
    fireEvent.change(screen.getByLabelText(/^Arreglista/), { target: { value: 'Jeff Nevin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar en el Editor' }));
    await waitFor(() => expect(onImportScore).toHaveBeenCalled());
    expect(onImportScore.mock.calls[0][0]).toMatchObject({
      title: 'El Rey',
      composer: 'José Alfredo Jiménez',
      partName: 'Bajo',
      arranger: 'Jeff Nevin',
    });
    expect(onImportScore.mock.calls[0][1].metadataHints.arranger).toBe('Jeff Nevin');
  });

  it('solo divide compases con aceptación y conserva la sesión al confirmar', async () => {
    const staff = {
      page: 1,
      system: 0,
      staffIndex: 0,
      bbox: [0, 0, 800, 100] as [number, number, number, number],
      lineSpacingPx: 10,
      normSpacing: 10,
    };
    const tokens = [
      '*M3/4',
      '<b>',
      '2',
      'C',
      '<b>',
      '4',
      'D',
      '<b>',
      '2',
      'E',
      '<b>',
      '4',
      'F',
      '<b>',
      '==',
    ];
    const ir = assembleIR([
      {
        staff,
        elements: lineFragment(
          tokens.map((token, i) => ({ token, f0: i, f1: i, confidence: 0.9 })),
          staff
        ),
      },
    ]);
    const summary = convertOmrIrToScore(ir);
    vi.mocked(recognizeScoreFromFile).mockResolvedValue({
      ...summary,
      confidence: 90,
      pagesProcessed: 1,
      stavesDetected: 1,
      measuresDetected: 1,
      notesDetected: 4,
      sourceType: 'neural-onnx',
      ir,
    });
    const onImportScore = vi.fn();
    render(<ImportModal isOpen onClose={vi.fn()} onImportScore={onImportScore} />);
    fireEvent.change(screen.getByLabelText('Seleccionar archivo a importar'), {
      target: { files: [new File(['x'], 'prueba.png')] },
    });
    const accept = await screen.findByRole('checkbox', {
      name: /Dividir compás 1 de Pentagrama 1/,
    });
    expect(accept).not.toBeChecked();
    fireEvent.click(accept);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar en el Editor' }));
    await waitFor(() => expect(onImportScore).toHaveBeenCalled());
    expect(onImportScore.mock.calls[0][0].staves[0].measures).toHaveLength(2);
    expect(onImportScore.mock.calls[0][1].ir).toEqual(ir);
    expect(
      onImportScore.mock.calls[0][1].sourceLinks.every(
        (link: { measureId: string | null }) => link.measureId !== null
      )
    ).toBe(true);
  });

  it('mantiene el documento abierto cuando falla el guardado del borrador', async () => {
    vi.mocked(saveOmrDraft).mockRejectedValueOnce(new Error('Cuota llena'));
    vi.mocked(recognizeScoreFromFile).mockResolvedValue({
      score,
      confidence: 70,
      pagesProcessed: 1,
      stavesDetected: 1,
      measuresDetected: 1,
      notesDetected: 1,
      sourceType: 'neural-onnx',
      ir: null,
      sourceLinks: [],
      warnings: [],
    });
    const onImportScore = vi.fn();
    render(<ImportModal isOpen onClose={vi.fn()} onImportScore={onImportScore} />);
    fireEvent.change(screen.getByLabelText('Seleccionar archivo a importar'), {
      target: { files: [new File(['x'], 'partitura.png')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar en el Editor' }));
    await screen.findByRole('alert');
    expect(onImportScore).not.toHaveBeenCalled();
    vi.mocked(saveOmrDraft).mockResolvedValue(undefined);
  });

  it('corrige solo el compás elegido, deshace la corrección y guarda el borrador separado', async () => {
    const twoMeasures: Score = {
      ...score,
      staves: [
        {
          ...score.staves[0],
          measures: [
            score.staves[0].measures[0],
            {
              id: 'measure-2',
              items: [
                {
                  id: 'note-2',
                  type: 'note',
                  pitch: { step: 'D', octave: 3, accidental: null },
                  duration: 'q',
                },
              ],
            },
          ],
        },
      ],
    };
    vi.mocked(recognizeScoreFromFile).mockResolvedValue({
      score: twoMeasures,
      confidence: 70,
      pagesProcessed: 1,
      stavesDetected: 1,
      measuresDetected: 2,
      notesDetected: 2,
      sourceType: 'neural-onnx',
      ir: null,
      sourceLinks: [],
      warnings: [],
    });
    const onImportScore = vi.fn();
    render(<ImportModal isOpen onClose={vi.fn()} onImportScore={onImportScore} />);
    fireEvent.change(screen.getByLabelText('Seleccionar archivo a importar'), {
      target: { files: [new File(['x'], 'partitura.png')] },
    });
    const duration = await screen.findByLabelText('Figura del evento');
    fireEvent.change(duration, { target: { value: 'h' } });
    expect(screen.getByLabelText('Figura del evento')).toHaveValue('h');
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer corrección' }));
    expect(screen.getByLabelText('Figura del evento')).toHaveValue('q');
    fireEvent.click(screen.getByRole('button', { name: 'Rehacer corrección' }));
    expect(screen.getByLabelText('Figura del evento')).toHaveValue('h');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() =>
      expect(
        vi.mocked(saveOmrDraft).mock.lastCall?.[0].score.staves[0].measures[0].items[0].duration
      ).toBe('h')
    );
    expect(
      vi.mocked(saveOmrDraft).mock.lastCall?.[0].score.staves[0].measures[1].items[0].duration
    ).toBe('q');
    expect(onImportScore).not.toHaveBeenCalled();
  });

  it('recupera un borrador sin reemplazar la partitura abierta', async () => {
    vi.mocked(loadOmrDraft).mockResolvedValueOnce({
      version: 1,
      savedAt: 1,
      score,
      result: {
        score,
        confidence: 70,
        pagesProcessed: 1,
        stavesDetected: 1,
        measuresDetected: 1,
        notesDetected: 1,
        sourceType: 'neural-onnx',
        ir: null,
        sourceLinks: [],
        warnings: [],
      },
      acceptedMeasureIds: [],
      acceptedIndicationIds: [],
      rejectedIndicationIds: [],
      reviewedWarningIds: [],
      reviewedMeasureIds: [],
      manualEditMeasureIds: [],
    });
    const onImportScore = vi.fn();
    render(<ImportModal isOpen onClose={vi.fn()} onImportScore={onImportScore} />);
    fireEvent.click(await screen.findByRole('button', { name: /Continuar borrador OMR guardado/ }));
    expect(screen.getByLabelText('Figura del evento')).toHaveValue('q');
    expect(onImportScore).not.toHaveBeenCalled();
  });

  it('respeta duración y armadura al cambiar la métrica y regresar', async () => {
    const onImportScore = vi.fn();
    const original: Score = {
      ...score,
      keySignature: 'G',
      staves: [
        {
          ...score.staves[0],
          measures: [
            {
              id: 'measure-1',
              items: [{ ...score.staves[0].measures[0].items[0], duration: 'h' }],
            },
          ],
        },
      ],
    };
    vi.mocked(recognizeScoreFromFile).mockResolvedValue({
      score: original,
      confidence: 100,
      pagesProcessed: 1,
      stavesDetected: 1,
      measuresDetected: 1,
      notesDetected: 1,
      sourceType: 'lossless-metadata',
      ir: null,
      sourceLinks: [],
      warnings: [],
    });
    render(<ImportModal isOpen onClose={vi.fn()} onImportScore={onImportScore} />);
    fireEvent.change(screen.getByLabelText('Seleccionar archivo a importar'), {
      target: { files: [new File(['x'], 'partitura.png', { type: 'image/png' })] },
    });
    await screen.findByText('Restauración nativa');
    fireEvent.click(screen.getByRole('button', { name: '4/4' }));
    fireEvent.click(screen.getByRole('button', { name: '3/4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cargar en el Editor' }));

    const imported = onImportScore.mock.calls[0][0] as Score;
    expect(imported.timeSignature).toEqual({ beats: 3, beatType: 4 });
    expect(imported.staves[0].measures[0].items[0].isDotted).toBeUndefined();
    expect(imported.keySignature).toBe('G');
  });
});
