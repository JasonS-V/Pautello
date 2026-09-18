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
  staves: [
    {
      id: 'staff-1',
      name: 'Piano',
      clef: 'treble',
      measures: [
        {
          id: 'm-1',
          items: [
            {
              id: 'i1',
              type: 'note',
              pitch: { step: 'C', octave: 4, accidental: null },
              duration: 'q',
            },
            {
              id: 'i2',
              type: 'note',
              pitch: { step: 'D', octave: 4, accidental: null },
              duration: 'q',
            },
            {
              id: 'i3',
              type: 'note',
              pitch: { step: 'E', octave: 4, accidental: null },
              duration: 'q',
            },
            {
              id: 'i4',
              type: 'note',
              pitch: { step: 'F', octave: 4, accidental: null },
              duration: 'q',
            },
          ],
        },
      ],
    },
  ],
  createdAt: 1000,
  updatedAt: 1000,
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

  it('exports and imports repeats and voltas properly', () => {
    const repeatScore: Score = {
      ...mockScore,
      title: 'Cancion con Repeticion',
      staves: [
        {
          id: 'staff-1',
          name: 'Violin',
          clef: 'treble',
          measures: [
            {
              id: 'm-1',
              repeatStart: true,
              items: [
                {
                  id: 'i1',
                  type: 'note',
                  pitch: { step: 'C', octave: 4, accidental: null },
                  duration: 'w',
                },
              ],
            },
            {
              id: 'm-2',
              volta: '1.',
              repeatEnd: true,
              items: [
                {
                  id: 'i2',
                  type: 'note',
                  pitch: { step: 'D', octave: 4, accidental: null },
                  duration: 'w',
                },
              ],
            },
            {
              id: 'm-3',
              volta: '2.',
              items: [
                {
                  id: 'i3',
                  type: 'note',
                  pitch: { step: 'E', octave: 4, accidental: null },
                  duration: 'w',
                },
              ],
            },
          ],
        },
      ],
    };

    const xml = exportScoreToMusicXml(repeatScore);
    expect(xml).toContain('<repeat direction="forward"/>');
    expect(xml).toContain('<repeat direction="backward"/>');
    expect(xml).toContain('<ending number="1" type="start">1.</ending>');
    expect(xml).toContain('<ending number="2" type="start">2.</ending>');
    expect(xml).toContain('<ending number="1" type="stop"/>');

    const imported = importMusicXmlToScore(xml);
    expect(imported.staves[0].measures[0].repeatStart).toBe(true);
    expect(imported.staves[0].measures[1].repeatEnd).toBe(true);
    expect(imported.staves[0].measures[1].volta).toBe('1.');
    expect(imported.staves[0].measures[2].volta).toBe('2.');
  });

  it('exports and imports tuplets (tresillos) accurately', () => {
    const tupletScore: Score = {
      ...mockScore,
      title: 'Huapango con Tresillos',
      staves: [
        {
          id: 'staff-1',
          name: 'Trompeta',
          clef: 'treble',
          measures: [
            {
              id: 'm-1',
              items: [
                {
                  id: 't1',
                  type: 'note',
                  pitch: { step: 'C', octave: 4, accidental: null },
                  duration: '8',
                  tuplet: { actual: 3, normal: 2 },
                },
                {
                  id: 't2',
                  type: 'note',
                  pitch: { step: 'D', octave: 4, accidental: null },
                  duration: '8',
                  tuplet: { actual: 3, normal: 2 },
                },
                {
                  id: 't3',
                  type: 'note',
                  pitch: { step: 'E', octave: 4, accidental: null },
                  duration: '8',
                  tuplet: { actual: 3, normal: 2 },
                },
              ],
            },
          ],
        },
      ],
    };

    const xml = exportScoreToMusicXml(tupletScore);
    expect(xml).toContain('<actual-notes>3</actual-notes>');
    expect(xml).toContain('<normal-notes>2</normal-notes>');

    const imported = importMusicXmlToScore(xml);
    expect(imported.staves[0].measures[0].items).toHaveLength(3);
    const item0 = imported.staves[0].measures[0].items[0];
    expect(item0.tuplet).toBeDefined();
    expect(item0.tuplet?.actual).toBe(3);
    expect(item0.tuplet?.normal).toBe(2);
  });

  it('exports and imports ties and slurs correctly', () => {
    const tiedScore: Score = {
      ...mockScore,
      title: 'Balada con Ligaduras',
      staves: [
        {
          id: 'staff-1',
          name: 'Voz',
          clef: 'treble',
          measures: [
            {
              id: 'm-1',
              items: [
                {
                  id: 't1',
                  type: 'note',
                  pitch: { step: 'C', octave: 4, accidental: null },
                  duration: 'h',
                  isTied: true,
                  slur: 'start',
                },
                {
                  id: 't2',
                  type: 'note',
                  pitch: { step: 'C', octave: 4, accidental: null },
                  duration: 'h',
                  slur: 'stop',
                },
              ],
            },
          ],
        },
      ],
    };

    const xml = exportScoreToMusicXml(tiedScore);
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<tied type="start"/>');
    expect(xml).toContain('<slur type="start" number="1"/>');

    const imported = importMusicXmlToScore(xml);
    expect(imported.staves[0].measures[0].items[0].isTied).toBe(true);
    expect(imported.staves[0].measures[0].items[0].slur).toBe('start');
  });

  it('exports and imports articulations and dynamics correctly', () => {
    const artScore: Score = {
      ...mockScore,
      title: 'Son con Articulaciones y Dinamicas',
      staves: [
        {
          id: 'staff-1',
          name: 'Trompeta',
          clef: 'treble',
          measures: [
            {
              id: 'm-1',
              items: [
                {
                  id: 'a1',
                  type: 'note',
                  pitch: { step: 'G', octave: 4, accidental: null },
                  duration: 'q',
                  articulation: 'staccato',
                  dynamic: 'ff',
                },
                {
                  id: 'a2',
                  type: 'note',
                  pitch: { step: 'A', octave: 4, accidental: null },
                  duration: 'q',
                  articulation: 'accent',
                },
                {
                  id: 'a3',
                  type: 'note',
                  pitch: { step: 'B', octave: 4, accidental: null },
                  duration: 'q',
                  articulation: 'tenuto',
                },
                {
                  id: 'a4',
                  type: 'note',
                  pitch: { step: 'C', octave: 5, accidental: null },
                  duration: 'q',
                  articulation: 'fermata',
                  dynamic: 'p',
                },
              ],
            },
          ],
        },
      ],
    };

    const xml = exportScoreToMusicXml(artScore);
    expect(xml).toContain('<staccato/>');
    expect(xml).toContain('<accent/>');
    expect(xml).toContain('<tenuto/>');
    expect(xml).toContain('<fermata');
    expect(xml).toContain('<ff/>');
    expect(xml).toContain('<p/>');

    const imported = importMusicXmlToScore(xml);
    const items = imported.staves[0].measures[0].items;
    expect(items[0].articulation).toBe('staccato');
    expect(items[0].dynamic).toBe('ff');
    expect(items[1].articulation).toBe('accent');
    expect(items[2].articulation).toBe('tenuto');
    expect(items[3].articulation).toBe('fermata');
    expect(items[3].dynamic).toBe('p');
  });

  it('exports and imports anacrusis (pick-up measure 0) with implicit="yes"', () => {
    const upbeatScore: Score = {
      ...mockScore,
      title: 'Cancion con Anacrusa',
      staves: [
        {
          id: 'staff-1',
          name: 'Voz',
          clef: 'treble',
          measures: [
            {
              id: 'm-upbeat',
              isAnacrusis: true,
              pickupBeats: 1,
              items: [
                {
                  id: 'n-upbeat',
                  type: 'note',
                  pitch: { step: 'G', octave: 4, accidental: null },
                  duration: 'q',
                },
              ],
            },
            {
              id: 'm-1',
              items: [
                {
                  id: 'n-bar1',
                  type: 'note',
                  pitch: { step: 'C', octave: 5, accidental: null },
                  duration: 'w',
                },
              ],
            },
          ],
        },
      ],
    };

    const xml = exportScoreToMusicXml(upbeatScore);
    expect(xml).toContain('<measure number="0" implicit="yes">');
    expect(xml).toContain('<measure number="1">');

    const imported = importMusicXmlToScore(xml);
    expect(imported.staves[0].measures).toHaveLength(2);
    expect(imported.staves[0].measures[0].isAnacrusis).toBe(true);
    expect(imported.staves[0].measures[0].pickupBeats).toBe(1);
    expect(imported.staves[0].measures[1].isAnacrusis).toBeFalsy();
  });

  it('exports and imports system breaks, page breaks, and multimeasure rests', () => {
    const layoutScore: Score = {
      ...mockScore,
      title: 'Obra Orquestal con Saltos y Tacets',
      staves: [
        {
          id: 'staff-1',
          name: 'Flauta',
          clef: 'treble',
          measures: [
            {
              id: 'm-1',
              systemBreak: true,
              items: [
                {
                  id: 'n1',
                  type: 'note',
                  pitch: { step: 'C', octave: 5, accidental: null },
                  duration: 'w',
                },
              ],
            },
            {
              id: 'm-2',
              pageBreak: true,
              multimeasureRest: 4,
              items: [{ id: 'r2', type: 'rest', duration: 'w' }],
            },
          ],
        },
      ],
    };

    const xml = exportScoreToMusicXml(layoutScore);
    expect(xml).toContain('<print new-system="yes"/>');
    expect(xml).toContain('<print new-page="yes"/>');
    expect(xml).toContain('<multiple-rest>4</multiple-rest>');

    const imported = importMusicXmlToScore(xml);
    expect(imported.staves[0].measures[0].systemBreak).toBe(true);
    expect(imported.staves[0].measures[1].pageBreak).toBe(true);
    expect(imported.staves[0].measures[1].multimeasureRest).toBe(4);
  });

  it('imports orchestral multi-part MusicXML into independent staves without squashing', () => {
    const multiPartXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Sinfonía en Tres Partes</work-title></work>
  <identification><creator type="composer">W. A. Mozart</creator></identification>
  <part-list>
    <score-part id="P1">
      <part-name>Flauta</part-name>
      <part-abbreviation>Fl.</part-abbreviation>
    </score-part>
    <score-part id="P2">
      <part-name>Clarinete</part-name>
      <part-abbreviation>Cl.</part-abbreviation>
    </score-part>
    <score-part id="P3">
      <part-name>Violonchelo</part-name>
      <part-abbreviation>Vc.</part-abbreviation>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>16</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>16</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
  <part id="P3">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <clef><sign>F</sign><line>4</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>3</octave></pitch>
        <duration>16</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

    const parsed = importMusicXmlToScore(multiPartXml);
    expect(parsed.title).toBe('Sinfonía en Tres Partes');
    expect(parsed.composer).toBe('W. A. Mozart');
    expect(parsed.staves).toHaveLength(3);

    // Flute staff
    expect(parsed.staves[0].name).toBe('Flauta');
    expect(parsed.staves[0].clef).toBe('treble');
    expect(parsed.staves[0].measures[0].items[0].type).toBe('note');
    expect(parsed.staves[0].measures[0].items[0].pitch?.step).toBe('C');
    expect(parsed.staves[0].measures[0].items[0].pitch?.octave).toBe(5);

    // Clarinet staff
    expect(parsed.staves[1].name).toBe('Clarinete');
    expect(parsed.staves[1].clef).toBe('treble');
    expect(parsed.staves[1].measures[0].items[0].pitch?.step).toBe('E');
    expect(parsed.staves[1].measures[0].items[0].pitch?.octave).toBe(4);

    // Cello staff
    expect(parsed.staves[2].name).toBe('Violonchelo');
    expect(parsed.staves[2].clef).toBe('bass');
    expect(parsed.staves[2].measures[0].items[0].pitch?.step).toBe('C');
    expect(parsed.staves[2].measures[0].items[0].pitch?.octave).toBe(3);
  });

  it('imports keyboard dual-staff parts with staff 1 & 2 into a Grand Staff (isGrandStaff = true)', () => {
    const pianoXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Preludio de Piano</work-title></work>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>16</duration>
        <voice>1</voice>
        <type>whole</type>
        <staff>1</staff>
      </note>
      <backup><duration>16</duration></backup>
      <note>
        <pitch><step>C</step><octave>3</octave></pitch>
        <duration>16</duration>
        <voice>2</voice>
        <type>whole</type>
        <staff>2</staff>
      </note>
    </measure>
  </part>
</score-partwise>`;

    const parsed = importMusicXmlToScore(pianoXml);
    expect(parsed.staves).toHaveLength(2);
    expect(parsed.isGrandStaff).toBe(true);

    // Upper staff (Treble / Right Hand)
    expect(parsed.staves[0].clef).toBe('treble');
    expect(parsed.staves[0].name).toBe('Mano Derecha');
    expect(parsed.staves[0].measures[0].items).toHaveLength(1);
    expect(parsed.staves[0].measures[0].items[0].pitch?.step).toBe('G');

    // Lower staff (Bass / Left Hand)
    expect(parsed.staves[1].clef).toBe('bass');
    expect(parsed.staves[1].name).toBe('Mano Izquierda');
    expect(parsed.staves[1].measures[0].items).toHaveLength(1);
    expect(parsed.staves[1].measures[0].items[0].pitch?.step).toBe('C');
  });

  it('exports and imports double accidentals (## and bb) without losing them or converting to natural', () => {
    const doubleAccScore: Score = {
      ...mockScore,
      title: 'Estudio de Dobles Alteraciones',
      staves: [
        {
          id: 'staff-1',
          name: 'Flauta',
          clef: 'treble',
          measures: [
            {
              id: 'm-1',
              items: [
                {
                  id: 'n1',
                  type: 'note',
                  pitch: { step: 'F', octave: 4, accidental: '##' },
                  duration: 'h',
                },
                {
                  id: 'n2',
                  type: 'note',
                  pitch: { step: 'B', octave: 4, accidental: 'bb' },
                  duration: 'h',
                },
              ],
            },
          ],
        },
      ],
    };

    const xml = exportScoreToMusicXml(doubleAccScore);
    expect(xml).toContain('<alter>2</alter>');
    expect(xml).toContain('<accidental>double-sharp</accidental>');
    expect(xml).toContain('<alter>-2</alter>');
    expect(xml).toContain('<accidental>flat-flat</accidental>');

    const imported = importMusicXmlToScore(xml);
    const items = imported.staves[0].measures[0].items;
    expect(items[0].pitch?.accidental).toBe('##');
    expect(items[0].pitch?.step).toBe('F');
    expect(items[1].pitch?.accidental).toBe('bb');
    expect(items[1].pitch?.step).toBe('B');
  });

  it('imports third-party MusicXML containing <accidental>double-flat</accidental> as bb', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Viola</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <clef><sign>C</sign><line>3</line></clef>
      </attributes>
      <note>
        <pitch>
          <step>E</step>
          <alter>-2</alter>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>quarter</type>
        <accidental>double-flat</accidental>
      </note>
    </measure>
  </part>
</score-partwise>`;

    const parsed = importMusicXmlToScore(xml);
    const note = parsed.staves[0].measures[0].items[0];
    expect(note.pitch?.step).toBe('E');
    expect(note.pitch?.accidental).toBe('bb');
  });

  it('preserves tie when tie is placed on a non-root chord note', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions></attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
      <note>
        <chord/>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
        <tie type="start"/>
      </note>
    </measure>
  </part>
</score-partwise>`;

    const parsed = importMusicXmlToScore(xml);
    const chord = parsed.staves[0].measures[0].items[0];
    expect(chord.pitches).toHaveLength(2);
    expect(chord.isTied).toBe(true);
  });

  it('creates unique measure and item IDs for multi-staff piano with empty left hand measure', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>16</duration>
        <type>whole</type>
        <staff>1</staff>
      </note>
    </measure>
  </part>
</score-partwise>`;

    const parsed = importMusicXmlToScore(xml);
    expect(parsed.staves).toHaveLength(2);
    const m1 = parsed.staves[0].measures[0];
    const m2 = parsed.staves[1].measures[0];
    expect(m1.id).not.toBe(m2.id);
    expect(m1.items[0].id).not.toBe(m2.items[0].id);
    expect(m2.items[0].type).toBe('rest');
    expect(m2.items[0].duration).toBe('w');
  });

  it('exports and imports polyphonic voices with stem directions accurately', () => {
    const polyScore: Score = {
      ...mockScore,
      staves: [
        {
          id: 'staff-poly',
          name: 'Polyphonic',
          clef: 'treble',
          measures: [
            {
              id: 'm-poly-1',
              items: [
                {
                  id: 'v1-note',
                  type: 'note',
                  pitch: { step: 'G', octave: 4, accidental: null },
                  duration: 'h',
                  voice: 1,
                  stemDirection: 'up',
                },
                {
                  id: 'v2-note',
                  type: 'note',
                  pitch: { step: 'E', octave: 4, accidental: null },
                  duration: 'h',
                  voice: 2,
                  stemDirection: 'down',
                },
                {
                  id: 'v2-rest',
                  type: 'rest',
                  duration: 'h',
                  voice: 2,
                },
              ],
            },
          ],
        },
      ],
    };

    const xml = exportScoreToMusicXml(polyScore);
    expect(xml).toContain('<voice>1</voice>');
    expect(xml).toContain('<voice>2</voice>');
    expect(xml).toContain('<stem>up</stem>');
    expect(xml).toContain('<stem>down</stem>');
    expect(xml).toContain('<backup>');

    const imported = importMusicXmlToScore(xml);
    const items = imported.staves[0].measures[0].items;
    expect(items[0].voice).toBe(1);
    expect(items[0].stemDirection).toBe('up');
    expect(items[1].voice).toBe(2);
    expect(items[1].stemDirection).toBe('down');
    expect(items[2].voice).toBe(2);
  });
});
