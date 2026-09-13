import { Score, ScoreItem, Step, NoteDuration, KeySignature, Clef } from '../types/music';
import { KEY_SIGNATURE_DATA } from '../constants/pitches';

const DURATION_TO_XML_TYPE: Record<NoteDuration, string> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  '8': 'eighth',
  '16': '16th',
  '32': '32nd',
};

const XML_TYPE_TO_DURATION: Record<string, NoteDuration> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  '16th': '16',
  '32nd': '32',
};

const FIFTHS_TO_KEY: Record<number, KeySignature> = {
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
  '-1': 'F',
  '-2': 'Bb',
  '-3': 'Eb',
  '-4': 'Ab',
  '-5': 'Db',
  '-6': 'Gb',
  '-7': 'Cb',
};

const FIFTHS_TO_MINOR_KEY: Record<number, KeySignature> = {
  0: 'Am',
  1: 'Em',
  2: 'Bm',
  3: 'F#m',
  4: 'C#m',
  5: 'G#m',
  6: 'D#m',
  '-1': 'Dm',
  '-2': 'Gm',
  '-3': 'Cm',
  '-4': 'Fm',
  '-5': 'Bbm',
  '-6': 'Ebm',
};

export function exportScoreToMusicXml(score: Score): string {
  const divisions = 4; // 1 quarter note = 4 divisions
  const keyData = KEY_SIGNATURE_DATA[score.keySignature] || { accidentals: 0, type: 'none' };
  const fifths = keyData.type === '#' ? keyData.accidentals : (keyData.type === 'b' ? -keyData.accidentals : 0);

  const durationDivisions: Record<NoteDuration, number> = {
    w: divisions * 4,
    h: divisions * 2,
    q: divisions,
    '8': divisions / 2,
    '16': divisions / 4,
    '32': divisions / 8,
  };

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC
    "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
    "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${escapeXml(score.title)}</work-title>
  </work>
  <identification>
    <creator type="composer">${escapeXml(score.composer)}</creator>
    <encoding>
      <software>Sonata Sheet Music Editor</software>
    </encoding>
  </identification>
  <part-list>
`;

  score.staves.forEach((staff, sIdx) => {
    xml += `    <score-part id="P${sIdx + 1}">
      <part-name>${escapeXml(staff.name || 'Instrumento')}</part-name>
    </score-part>\n`;
  });

  xml += `  </part-list>\n`;

  score.staves.forEach((staff, sIdx) => {
    xml += `  <part id="P${sIdx + 1}">\n`;

    staff.measures.forEach((measure, mIdx) => {
      xml += `    <measure number="${mIdx + 1}">\n`;

      // Measure 1 holds attributes
      if (mIdx === 0) {
        const clefSign = staff.clef === 'bass' ? 'F' : (staff.clef === 'alto' ? 'C' : 'G');
        const clefLine = staff.clef === 'bass' ? '4' : (staff.clef === 'alto' ? '3' : '2');

        xml += `      <attributes>
        <divisions>${divisions}</divisions>
        <key>
          <fifths>${fifths}</fifths>
          <mode>${score.keySignature.endsWith('m') ? 'minor' : 'major'}</mode>
        </key>
        <time>
          <beats>${score.timeSignature.beats}</beats>
          <beat-type>${score.timeSignature.beatType}</beat-type>
        </time>
        <clef>
          <sign>${clefSign}</sign>
          <line>${clefLine}</line>
        </clef>
      </attributes>
      <direction placement="above">
        <sound tempo="${score.tempo}"/>
      </direction>\n`;
      }

      measure.items.forEach(item => {
        let baseDiv = durationDivisions[item.duration] || 4;
        if (item.isDotted) baseDiv = Math.round(baseDiv * 1.5);
        const xmlType = DURATION_TO_XML_TYPE[item.duration] || 'quarter';

        xml += `      <note>\n`;
        if (item.type === 'rest') {
          xml += `        <rest/>\n`;
        } else if (item.pitch) {
          const alter = item.pitch.accidental === '#' ? 1 : (item.pitch.accidental === 'b' ? -1 : 0);
          xml += `        <pitch>
          <step>${item.pitch.step}</step>
          ${alter !== 0 ? `<alter>${alter}</alter>` : ''}
          <octave>${item.pitch.octave}</octave>
        </pitch>\n`;
        }

        xml += `        <duration>${baseDiv}</duration>\n`;
        xml += `        <type>${xmlType}</type>\n`;
        if (item.isDotted) {
          xml += `        <dot/>\n`;
        }
        if (item.lyric) {
          xml += `        <lyric>
          <text>${escapeXml(item.lyric)}</text>
        </lyric>\n`;
        }
        xml += `      </note>\n`;
      });

      xml += `    </measure>\n`;
    });

    xml += `  </part>\n`;
  });

  xml += `</score-partwise>\n`;
  return xml;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function importMusicXmlToScore(xmlString: string): Score {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    const title = doc.querySelector('work-title')?.textContent || doc.querySelector('movement-title')?.textContent || 'Partitura Importada';
    const composer = doc.querySelector('creator[type="composer"]')?.textContent || 'Desconocido';

    let tempo = 120;
    const soundEl = doc.querySelector('sound[tempo]');
    if (soundEl && soundEl.getAttribute('tempo')) {
      tempo = parseInt(soundEl.getAttribute('tempo')!, 10) || 120;
    }

    let beats = 4;
    let beatType = 4;
    const beatsEl = doc.querySelector('time > beats');
    const beatTypeEl = doc.querySelector('time > beat-type');
    if (beatsEl && beatTypeEl) {
      beats = parseInt(beatsEl.textContent || '4', 10) || 4;
      beatType = parseInt(beatTypeEl.textContent || '4', 10) || 4;
    }

    let clef: Clef = 'treble';
    const clefSign = doc.querySelector('clef > sign')?.textContent;
    if (clefSign === 'F') clef = 'bass';
    else if (clefSign === 'C') clef = 'alto';

    let keySignature: KeySignature = 'C';
    const fifthsEl = doc.querySelector('key > fifths');
    const modeEl = doc.querySelector('key > mode');
    if (fifthsEl) {
      const fifthsVal = parseInt(fifthsEl.textContent || '0', 10);
      const isMinor = modeEl?.textContent?.toLowerCase() === 'minor';
      keySignature = isMinor
        ? (FIFTHS_TO_MINOR_KEY[fifthsVal] || 'Am')
        : (FIFTHS_TO_KEY[fifthsVal] || 'C');
    }

    const measuresEl = doc.querySelectorAll('part measure');
    const measures = Array.from(measuresEl).map((mEl, idx) => {
      const items: ScoreItem[] = [];
      const notesEl = mEl.querySelectorAll('note');

      notesEl.forEach(nEl => {
        const isRest = !!nEl.querySelector('rest');
        const isFullMeasureRest = !!nEl.querySelector('rest[measure="yes"]');
        const typeEl = nEl.querySelector('type')?.textContent;
        const duration: NoteDuration = isFullMeasureRest
          ? 'w'
          : (typeEl ? (XML_TYPE_TO_DURATION[typeEl] || 'q') : (isRest ? 'w' : 'q'));
        const isDotted = !!nEl.querySelector('dot');
        const lyric = nEl.querySelector('lyric text')?.textContent || undefined;

        if (isRest) {
          items.push({
            id: `item-${idx}-${items.length}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'rest',
            duration,
            isDotted,
            lyric
          });
        } else {
          const step = (nEl.querySelector('step')?.textContent || 'C') as Step;
          const octave = parseInt(nEl.querySelector('octave')?.textContent || '4', 10);
          const alter = parseInt(nEl.querySelector('alter')?.textContent || '0', 10);
          const accidental = alter === 1 ? '#' : alter === -1 ? 'b' : null;

          items.push({
            id: `item-${idx}-${items.length}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'note',
            pitch: { step, octave, accidental },
            duration,
            isDotted,
            lyric
          });
        }
      });

      return {
        id: `meas-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        items: items.length > 0 ? items : [
          { id: `meas-rest-${idx}`, type: 'rest', duration: 'w' } as ScoreItem
        ]
      };
    });

    return {
      id: `score-${Date.now()}`,
      title,
      composer,
      tempo,
      timeSignature: { beats, beatType },
      keySignature,
      staves: [{
        id: 'staff-1',
        name: 'Voz / Melodía',
        clef,
        measures: measures.length > 0 ? measures : [
          { id: 'm-1', items: [{ id: 'item-1', type: 'rest', duration: 'w' }] }
        ]
      }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  // Node.js / non-DOM regex-based parser fallback
  const extractTag = (xml: string, tag: string) => {
    const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
    return m ? m[1].trim() : null;
  };

  const title = extractTag(xmlString, 'work-title') || 'Partitura Importada';
  const composer = extractTag(xmlString, 'creator') || 'Desconocido';

  const soundTempoMatch = /<sound[^>]*tempo="(\d+)"/i.exec(xmlString);
  const tempo = soundTempoMatch ? parseInt(soundTempoMatch[1], 10) : 120;

  const beatsMatch = /<time[^>]*>[\s\S]*?<beats>(\d+)<\/beats>[\s\S]*?<beat-type>(\d+)<\/beat-type>/i.exec(xmlString);
  const beats = beatsMatch ? parseInt(beatsMatch[1], 10) : 4;
  const beatType = beatsMatch ? parseInt(beatsMatch[2], 10) : 4;

  const clefSign = extractTag(xmlString, 'sign');
  const clef: Clef = clefSign === 'F' ? 'bass' : (clefSign === 'C' ? 'alto' : 'treble');

  const fifthsMatch = /<key[^>]*>[\s\S]*?<fifths>(-?\d+)<\/fifths>/i.exec(xmlString);
  const modeMatch = /<key[^>]*>[\s\S]*?<mode>([a-z]+)<\/mode>/i.exec(xmlString);
  let keySignature: KeySignature = 'C';
  if (fifthsMatch) {
    const fifthsVal = parseInt(fifthsMatch[1], 10);
    const isMinor = modeMatch && modeMatch[1].toLowerCase() === 'minor';
    keySignature = isMinor
      ? (FIFTHS_TO_MINOR_KEY[fifthsVal] || 'Am')
      : (FIFTHS_TO_KEY[fifthsVal] || 'C');
  }

  const measureRegex = /<measure[^>]*>([\s\S]*?)<\/measure>/gi;
  let mMatch: RegExpExecArray | null;
  const measures = [];
  let mIdx = 0;

  while ((mMatch = measureRegex.exec(xmlString)) !== null) {
    const measureXml = mMatch[1];
    const noteRegex = /<note[^>]*>([\s\S]*?)<\/note>/gi;
    let nMatch: RegExpExecArray | null;
    const items: ScoreItem[] = [];

    while ((nMatch = noteRegex.exec(measureXml)) !== null) {
      const noteXml = nMatch[1];
      const isRest = noteXml.includes('<rest');
      const isFullMeasureRest = /<rest[^>]*measure="yes"/i.test(noteXml);
      const typeStr = extractTag(noteXml, 'type');
      const duration = isFullMeasureRest
        ? 'w'
        : (typeStr ? (XML_TYPE_TO_DURATION[typeStr] || 'q') : (isRest ? 'w' : 'q'));
      const isDotted = noteXml.includes('<dot');
      const lyric = extractTag(noteXml, 'text') || undefined;

      if (isRest) {
        items.push({
          id: `item-${mIdx}-${items.length}`,
          type: 'rest',
          duration,
          isDotted,
          lyric
        });
      } else {
        const step = (extractTag(noteXml, 'step') || 'C') as Step;
        const octave = parseInt(extractTag(noteXml, 'octave') || '4', 10);
        const alter = parseInt(extractTag(noteXml, 'alter') || '0', 10);
        const accidental = alter === 1 ? '#' : alter === -1 ? 'b' : null;

        items.push({
          id: `item-${mIdx}-${items.length}`,
          type: 'note',
          pitch: { step, octave, accidental },
          duration,
          isDotted,
          lyric
        });
      }
    }

    measures.push({
      id: `meas-${mIdx}`,
      items: items.length > 0 ? items : [
        { id: `meas-rest-${mIdx}`, type: 'rest', duration: 'w' } as ScoreItem
      ]
    });
    mIdx++;
  }

  return {
    id: `score-${Date.now()}`,
    title,
    composer,
    tempo,
    timeSignature: { beats, beatType },
    keySignature,
    staves: [{
      id: 'staff-1',
      name: 'Voz / Melodía',
      clef,
      measures: measures.length > 0 ? measures : [
        { id: 'm-1', items: [{ id: 'item-1', type: 'rest', duration: 'w' }] }
      ]
    }],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}
