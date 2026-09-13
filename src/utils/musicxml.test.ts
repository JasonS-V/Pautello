import { describe, it, expect } from 'vitest';
import { exportScoreToMusicXml, importMusicXmlToScore } from './musicxml';
import { exportScoreToMidi } from '../audio/midiExport';
import { Score } from '../types/music';

const mockScore: Score = {
  id: 'test-score',
  title: 'Estudio en Do',
  composer: 'J. S. Bach',
  tempo: 120,
  timeSignature: { beats: 4, beatType: 4 },
  keySignature: 'C',
  staves: [{
    id: 'staff-1',
    name: 'Piano',
    clef: 'treble',
    measures: [{
      id: 'm-1',
      items: [
        { id: 'i1', type: 'note', pitch: { step: 'C', octave: 4, accidental: null }, duration: 'q' },
        { id: 'i2', type: 'note', pitch: { step: 'D', octave: 4, accidental: null }, duration: 'q' },
        { id: 'i3', type: 'note', pitch: { step: 'E', octave: 4, accidental: null }, duration: 'q' },
        { id: 'i4', type: 'note', pitch: { step: 'F', octave: 4, accidental: null }, duration: 'q' },
      ]
    }]
  }],
  createdAt: 1000,
  updatedAt: 1000
};

describe('MusicXML Export and Import', () => {
  it('generates valid MusicXML containing title, composer, notes', () => {
    const xml = exportScoreToMusicXml(mockScore);
    expect(xml).toContain('<work-title>Estudio en Do</work-title>');
    expect(xml).toContain('<creator type="composer">J. S. Bach</creator>');
    expect(xml).toContain('<step>C</step>');
    expect(xml).toContain('<octave>4</octave>');
    expect(xml).toContain('<type>quarter</type>');
  });

  it('exports valid standard MIDI Blob', () => {
    const blob = exportScoreToMidi(mockScore);
    expect(blob.type).toBe('audio/midi');
    expect(blob.size).toBeGreaterThan(20);
  });

  it('imports MusicXML back into a Score structure', () => {
    const xml = exportScoreToMusicXml(mockScore);
    const parsed = importMusicXmlToScore(xml);
    expect(parsed.title).toBe('Estudio en Do');
    expect(parsed.composer).toBe('J. S. Bach');
    expect(parsed.staves[0].measures.length).toBeGreaterThanOrEqual(1);
    expect(parsed.keySignature).toBe('C');
  });

  it('preserves key signatures (sharps and flats) when exporting and importing MusicXML', () => {
    const gMajorScore: Score = {
      ...mockScore,
      title: 'Minueto en Sol',
      keySignature: 'G', // 1 sharp
    };
    const xmlG = exportScoreToMusicXml(gMajorScore);
    expect(xmlG).toContain('<fifths>1</fifths>');
    const parsedG = importMusicXmlToScore(xmlG);
    expect(parsedG.keySignature).toBe('G');

    const bbMajorScore: Score = {
      ...mockScore,
      title: 'Obra en Si Bemol',
      keySignature: 'Bb', // 2 flats
    };
    const xmlBb = exportScoreToMusicXml(bbMajorScore);
    expect(xmlBb).toContain('<fifths>-2</fifths>');
    const parsedBb = importMusicXmlToScore(xmlBb);
    expect(parsedBb.keySignature).toBe('Bb');
  });

  it('correctly parses full-measure rests as whole rests', () => {
    const xmlWithMeasureRest = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part id="P1">
    <measure number="1">
      <note>
        <rest measure="yes"/>
        <duration>16</duration>
      </note>
    </measure>
  </part>
</score-partwise>`;
    const parsed = importMusicXmlToScore(xmlWithMeasureRest);
    expect(parsed.staves[0].measures[0].items[0].type).toBe('rest');
    expect(parsed.staves[0].measures[0].items[0].duration).toBe('w');
  });
});
