import type { NormalizedEvalEvent } from './omr-metrics';

/** Independent measurement of the engine's MusicXML, before Pautello conversion. */
export function readNativeMusicXml(xml: string, parser: DOMParser) {
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.querySelector('score-partwise > part'))
    throw new Error('MusicXML nativo vacío o inválido.');
  const events: NormalizedEvalEvent[] = [];
  const measures = [...doc.querySelectorAll('score-partwise > part')][0].querySelectorAll(
    'measure'
  );
  const directions: { measure: number; kind: string; value: string }[] = [];
  let beats = 4,
    beatType = 4,
    skippedVoices = 0,
    unsupportedRhythms = 0;
  const types: Record<string, number> = {
    whole: 1,
    half: 2,
    quarter: 4,
    eighth: 8,
    '16th': 16,
    '32nd': 32,
  };
  measures.forEach((measure, index) => {
    beats = Number(measure.querySelector('attributes time beats')?.textContent ?? beats);
    beatType = Number(measure.querySelector('attributes time beat-type')?.textContent ?? beatType);
    for (const kind of ['time', 'metronome', 'segno', 'coda', 'words', 'rehearsal', 'fermata'])
      measure
        .querySelectorAll(kind)
        .forEach((e) =>
          directions.push({ measure: index + 1, kind, value: e.textContent?.trim() ?? '' })
        );
    measure.querySelectorAll('note').forEach((note, n) => {
      if ((note.querySelector('voice')?.textContent ?? '1') !== '1') {
        skippedVoices++;
        return;
      }
      if (note.querySelector('chord, grace, time-modification')) {
        unsupportedRhythms++;
        return;
      }
      const isRest = Boolean(note.querySelector('rest'));
      const step = note.querySelector('pitch step')?.textContent;
      const octave = note.querySelector('pitch octave')?.textContent;
      const type = note.querySelector('type')?.textContent ?? '';
      const fullRest = Boolean(note.querySelector('rest[measure="yes"]'));
      if (!fullRest && !types[type]) {
        unsupportedRhythms++;
        return;
      }
      const accidental = note.querySelector('accidental')?.textContent;
      const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
      const divisor = gcd(beats, beatType);
      events.push({
        id: `${index}-${n}`,
        measureNumber: index + 1,
        pitch: isRest ? null : `${step}${octave}`,
        accidental:
          accidental === 'sharp'
            ? '#'
            : accidental === 'flat'
              ? 'b'
              : accidental === 'natural'
                ? 'n'
                : null,
        duration: fullRest ? [beats / divisor, beatType / divisor] : [1, types[type]],
        dots: note.querySelectorAll('dot').length,
        tiedOut: Boolean(note.querySelector('tie[type="start"], tied[type="start"]')),
      });
    });
  });
  return {
    events,
    measures: measures.length,
    parts: doc.querySelectorAll('score-partwise > part').length,
    systems:
      1 +
      [...measures]
        .slice(1)
        .filter((m) => m.querySelector('print[new-system="yes"], print[new-page="yes"]')).length,
    directions,
    skippedVoices,
    unsupportedRhythms,
  };
}
