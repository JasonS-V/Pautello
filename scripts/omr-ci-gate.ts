import assert from 'node:assert/strict';

interface RecognitionRow {
  status?: string;
  sample: string;
  variant: string;
  decoder: string;
  staves: number;
  systems: number;
  measures: number;
  exact: number | null;
  barMeasure: number | null;
}

export function assertOmrCiGate(rows: RecognitionRow[]): void {
  assert.equal(rows.length, 1, 'Falta la muestra pública de inferencia real.');
  const row = rows[0];
  assert.equal(row.sample, 'pdmx-line-clean', 'Falta la muestra pública de inferencia real.');
  assert.equal(row.variant, 'baseline');
  assert.equal(row.decoder, 'greedy');
  assert.equal(row.staves, 1, 'Regresión: se perdieron pautas.');
  assert.equal(row.systems, 1, 'Regresión: se perdieron sistemas.');
  assert.equal(row.measures, 6, 'Regresión: cambió el número de compases.');
  assert.equal(row.exact, 1, 'Regresión: cambiaron los eventos musicales.');
  assert.equal(row.barMeasure, 1, 'Regresión: cambiaron barras o compases.');
}

// Fixed lower bounds from the F8 public validation corpus. Improving a result is allowed.
const ROBUSTNESS_MINIMA: Record<string, [number, number]> = {
  'pdmx-line-clean': [1, 1],
  'pdmx-line-low-contrast': [1, 1],
  'pdmx-line-rotated': [0.75, 0.33],
  'pdmx-line-jpeg-compressed': [1, 1],
  'pdmx-line-low-resolution': [1, 1],
  'pdmx-line-uneven-contrast': [0.3333, 0.33],
  'pdmx-line-broken-lines': [1, 1],
  'pdmx-line-stains': [1, 1],
  'pdmx-line-clipped-border': [0.25, 0.33],
  'pdmx-line-large-header': [1, 1],
  'pdmx-line-perspective': [0, 0],
};

export function assertOmrRobustnessGate(rows: RecognitionRow[]): void {
  for (const [sample, [minExact, minBarMeasure]] of Object.entries(ROBUSTNESS_MINIMA)) {
    const row = rows.find((candidate) => candidate.sample === sample);
    assert(row, `Falta ${sample} en el informe de robustez.`);
    assert.equal(row.variant, 'baseline');
    assert.equal(row.decoder, 'greedy');
    assert((row.exact ?? -1) >= minExact, `${sample}: regresión de eventos musicales.`);
    assert((row.barMeasure ?? -1) >= minBarMeasure, `${sample}: regresión de barras o compases.`);
  }
  assert.equal(
    rows.length,
    Object.keys(ROBUSTNESS_MINIMA).length,
    'Número de condiciones inesperado.'
  );
}
