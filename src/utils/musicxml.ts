import {
  Score,
  ScoreItem,
  Step,
  NoteDuration,
  KeySignature,
  Clef,
  getItemPitches,
  Pitch,
  Articulation,
  Dynamic,
  Accidental,
  Measure,
  Staff,
} from '../types/music';
import { KEY_SIGNATURE_DATA, getItemBeats } from '../constants/pitches';

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
  const fifths =
    keyData.type === '#' ? keyData.accidentals : keyData.type === 'b' ? -keyData.accidentals : 0;

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
      <software>Pautello Sheet Music Editor</software>
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

    const hasAnacrusis = staff.measures[0]?.isAnacrusis ?? false;
    staff.measures.forEach((measure, mIdx) => {
      const isPickup = mIdx === 0 && (measure.isAnacrusis ?? false);
      const measureNum = hasAnacrusis ? mIdx : mIdx + 1;
      const measureOpening = isPickup
        ? `<measure number="0" implicit="yes">`
        : `<measure number="${measureNum}">`;
      xml += `    ${measureOpening}\n`;

      if (measure.pageBreak) {
        xml += `      <print new-page="yes"/>\n`;
      } else if (measure.systemBreak) {
        xml += `      <print new-system="yes"/>\n`;
      }

      if (measure.multimeasureRest && measure.multimeasureRest > 1) {
        xml += `      <attributes>
        <measure-style>
          <multiple-rest>${measure.multimeasureRest}</multiple-rest>
        </measure-style>
      </attributes>\n`;
      }

      // Measure 1 holds attributes
      if (mIdx === 0) {
        const clefSign = staff.clef === 'bass' ? 'F' : staff.clef === 'alto' ? 'C' : 'G';
        const clefLine = staff.clef === 'bass' ? '4' : staff.clef === 'alto' ? '3' : '2';

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

      if (measure.repeatStart) {
        xml += `      <barline location="left">
        <bar-style>heavy-light</bar-style>
        <repeat direction="forward"/>
      </barline>\n`;
      }

      if (measure.volta) {
        const voltaNum = measure.volta.replace(/[^0-9, ]/g, '');
        xml += `      <barline location="left">
        <ending number="${voltaNum}" type="start">${measure.volta}</ending>
      </barline>\n`;
      }

      const renderItemToXml = (
        item: ScoreItem,
        defaultStem?: 'up' | 'down'
      ): { itemXml: string; durationDiv: number } => {
        let itemXml = '';
        let baseDiv = durationDivisions[item.duration] || 4;
        if (item.isDotted) baseDiv = Math.round(baseDiv * 1.5);
        const xmlType = DURATION_TO_XML_TYPE[item.duration] || 'quarter';
        const stemDir =
          item.stemDirection && item.stemDirection !== 'auto' ? item.stemDirection : defaultStem;

        if (item.type === 'rest') {
          itemXml += `      <note>\n`;
          itemXml += `        <rest/>\n`;
          itemXml += `        <duration>${baseDiv}</duration>
        <voice>${item.voice || 1}</voice>
        <type>${xmlType}</type>\n`;
          if (item.isDotted) {
            itemXml += `        <dot/>\n`;
          }
          if (item.lyric) {
            itemXml += `        <lyric>
          <text>${escapeXml(item.lyric)}</text>
        </lyric>\n`;
          }
          itemXml += `      </note>\n`;
        } else {
          const pitches = getItemPitches(item);
          pitches.forEach((p, pIdx) => {
            const alter =
              p.accidental === '##'
                ? 2
                : p.accidental === '#'
                  ? 1
                  : p.accidental === 'bb'
                    ? -2
                    : p.accidental === 'b'
                      ? -1
                      : 0;
            itemXml += `      <note>\n`;
            if (pIdx > 0) {
              itemXml += `        <chord/>\n`;
            }
            itemXml += `        <pitch>
          <step>${p.step}</step>
          ${alter !== 0 ? `<alter>${alter}</alter>` : ''}
          <octave>${p.octave}</octave>
        </pitch>\n`;
            if (p.accidental) {
              const accName =
                p.accidental === '##'
                  ? 'double-sharp'
                  : p.accidental === 'bb'
                    ? 'flat-flat'
                    : p.accidental === '#'
                      ? 'sharp'
                      : p.accidental === 'b'
                        ? 'flat'
                        : 'natural';
              itemXml += `        <accidental>${accName}</accidental>\n`;
            }
            itemXml += `        <duration>${baseDiv}</duration>
        <voice>${item.voice || 1}</voice>
        <type>${xmlType}</type>\n`;
            if (stemDir) {
              itemXml += `        <stem>${stemDir}</stem>\n`;
            }

            if (item.isTied) {
              itemXml += `        <tie type="start"/>\n`;
            }

            if (item.tuplet) {
              itemXml += `        <time-modification>
          <actual-notes>${item.tuplet.actual}</actual-notes>
          <normal-notes>${item.tuplet.normal}</normal-notes>
        </time-modification>\n`;
            }

            if (item.isDotted) {
              itemXml += `        <dot/>\n`;
            }
            if (item.isTied || item.slur || item.articulation || item.dynamic) {
              itemXml += `        <notations>\n`;
              if (item.isTied) {
                itemXml += `          <tied type="start"/>\n`;
              }
              if (item.slur) {
                itemXml += `          <slur type="${item.slur}" number="1"/>\n`;
              }
              if (item.articulation) {
                if (item.articulation === 'staccato') {
                  itemXml += `          <articulations><staccato/></articulations>\n`;
                } else if (item.articulation === 'accent') {
                  itemXml += `          <articulations><accent/></articulations>\n`;
                } else if (item.articulation === 'tenuto') {
                  itemXml += `          <articulations><tenuto/></articulations>\n`;
                } else if (item.articulation === 'fermata') {
                  itemXml += `          <fermata type="upright"/>\n`;
                }
              }
              if (item.dynamic) {
                itemXml += `          <dynamics><${item.dynamic}/></dynamics>\n`;
              }
              itemXml += `        </notations>\n`;
            }
            if (item.lyric && pIdx === 0) {
              itemXml += `        <lyric>
          <text>${escapeXml(item.lyric)}</text>
        </lyric>\n`;
            }
            itemXml += `      </note>\n`;
          });
        }
        return { itemXml, durationDiv: baseDiv };
      };

      const v1Items = measure.items.filter((it) => it.voice !== 2);
      const v2Items = measure.items.filter((it) => it.voice === 2);

      let v1Divisions = 0;
      v1Items.forEach((item) => {
        const { itemXml, durationDiv } = renderItemToXml(
          item,
          v2Items.length > 0 ? 'up' : undefined
        );
        xml += itemXml;
        v1Divisions += durationDiv;
      });

      if (v2Items.length > 0) {
        if (v1Divisions > 0) {
          xml += `      <backup>\n        <duration>${v1Divisions}</duration>\n      </backup>\n`;
        }
        v2Items.forEach((item) => {
          const { itemXml } = renderItemToXml(item, 'down');
          xml += itemXml;
        });
      }

      if (measure.repeatEnd) {
        xml += `      <barline location="right">
        <bar-style>light-heavy</bar-style>
        <repeat direction="backward"/>
        ${measure.volta ? `<ending number="${measure.volta.replace(/[^0-9, ]/g, '')}" type="stop"/>` : ''}
      </barline>\n`;
      }

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

function parseMusicXmlAccidental(alterVal: number | null, accText: string | null): Accidental {
  if (alterVal === 2 || accText === 'double-sharp' || accText === 'sharp-sharp') return '##';
  if (alterVal === -2 || accText === 'flat-flat' || accText === 'double-flat') return 'bb';
  if (alterVal === 1 || accText === 'sharp') return '#';
  if (alterVal === -1 || accText === 'flat') return 'b';
  if (alterVal === 0 && accText === 'natural') return 'n';
  if (accText === 'natural') return 'n';
  return null;
}

export function importMusicXmlToScore(xmlString: string): Score {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    const title =
      doc.querySelector('work-title')?.textContent?.trim() ||
      doc.querySelector('movement-title')?.textContent?.trim() ||
      'Partitura Importada';
    const composer =
      doc.querySelector('creator[type="composer"]')?.textContent?.trim() ||
      doc.querySelector('creator')?.textContent?.trim() ||
      'Desconocido';

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

    let keySignature: KeySignature = 'C';
    const fifthsEl = doc.querySelector('key > fifths');
    const modeEl = doc.querySelector('key > mode');
    if (fifthsEl) {
      const fifthsVal = parseInt(fifthsEl.textContent || '0', 10);
      const isMinor = modeEl?.textContent?.toLowerCase() === 'minor';
      keySignature = isMinor
        ? FIFTHS_TO_MINOR_KEY[fifthsVal] || 'Am'
        : FIFTHS_TO_KEY[fifthsVal] || 'C';
    }

    // Parse score-part definitions from <part-list>
    const partInfoMap = new Map<string, { name: string; shortName?: string }>();
    doc.querySelectorAll('part-list score-part').forEach((sp) => {
      const pId = sp.getAttribute('id') || '';
      const pName = sp.querySelector('part-name')?.textContent?.trim() || '';
      const pAbbr = sp.querySelector('part-abbreviation')?.textContent?.trim() || undefined;
      if (pId) {
        partInfoMap.set(pId, { name: pName, shortName: pAbbr });
      }
    });

    const parseClefFromEl = (clefEl: Element | null, defaultClef: Clef): Clef => {
      if (!clefEl) return defaultClef;
      const sign = clefEl.querySelector('sign')?.textContent?.trim().toUpperCase();
      if (sign === 'F') return 'bass';
      if (sign === 'C') return 'alto';
      if (sign === 'G') return 'treble';
      return defaultClef;
    };

    const parseNoteElement = (nEl: Element, mIdx: number, items: ScoreItem[]): void => {
      const isRest = !!nEl.querySelector('rest');
      const isFullMeasureRest = !!nEl.querySelector('rest[measure="yes"]');
      const typeEl = nEl.querySelector('type')?.textContent?.trim();
      const duration: NoteDuration = isFullMeasureRest
        ? 'w'
        : typeEl
          ? XML_TYPE_TO_DURATION[typeEl] || 'q'
          : isRest
            ? 'w'
            : 'q';
      const isDotted = !!nEl.querySelector('dot');
      const lyric = nEl.querySelector('lyric text')?.textContent?.trim() || undefined;
      const timeModEl = nEl.querySelector('time-modification');
      const actualNotes = timeModEl
        ? parseInt(timeModEl.querySelector('actual-notes')?.textContent || '3', 10)
        : undefined;
      const normalNotes = timeModEl
        ? parseInt(timeModEl.querySelector('normal-notes')?.textContent || '2', 10)
        : undefined;
      const tuplet =
        actualNotes && normalNotes ? { actual: actualNotes, normal: normalNotes } : undefined;

      const voiceText = nEl.querySelector('voice')?.textContent?.trim();
      const voice: 1 | 2 = voiceText === '2' ? 2 : 1;
      const stemText = nEl.querySelector('stem')?.textContent?.trim().toLowerCase();
      const stemDirection: 'up' | 'down' | 'auto' | undefined =
        stemText === 'up' || stemText === 'down' ? (stemText as 'up' | 'down') : undefined;

      if (isRest) {
        items.push({
          id: `item-${mIdx}-${items.length}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'rest',
          duration,
          isDotted,
          tuplet,
          lyric,
          voice,
        });
        return;
      }

      const isChord = !!nEl.querySelector('chord');
      const step = (nEl.querySelector('step')?.textContent?.trim().toUpperCase() || 'C') as Step;
      const octave = parseInt(nEl.querySelector('octave')?.textContent || '4', 10);
      const alterEl = nEl.querySelector('alter');
      const alterVal = alterEl ? parseInt(alterEl.textContent || '0', 10) : null;
      const accText = nEl.querySelector('accidental')?.textContent?.trim().toLowerCase() || null;
      const accidental = parseMusicXmlAccidental(alterVal, accText);
      const pitch: Pitch = { step, octave, accidental };

      const isTied =
        !!nEl.querySelector('tie[type="start"]') || !!nEl.querySelector('tied[type="start"]');
      const slurType = nEl.querySelector('slur')?.getAttribute('type') as 'start' | 'stop' | null;

      const staccatoEl = nEl.querySelector('staccato');
      const accentEl = nEl.querySelector('accent');
      const tenutoEl = nEl.querySelector('tenuto');
      const fermataEl = nEl.querySelector('fermata');
      let articulation: Articulation = null;
      if (staccatoEl) articulation = 'staccato';
      else if (accentEl) articulation = 'accent';
      else if (tenutoEl) articulation = 'tenuto';
      else if (fermataEl) articulation = 'fermata';

      const dynEl = nEl.querySelector(
        'dynamics > pp, dynamics > p, dynamics > mp, dynamics > mf, dynamics > f, dynamics > ff, dynamics > ppp, dynamics > fff'
      );
      const dynamic = (dynEl?.tagName?.toLowerCase() as Dynamic) || null;

      if (isChord && items.length > 0 && items[items.length - 1].type === 'note') {
        const prev = items[items.length - 1];
        if (!prev.pitches) {
          prev.pitches = prev.pitch ? [prev.pitch, pitch] : [pitch];
        } else {
          prev.pitches.push(pitch);
        }
        if (isTied) prev.isTied = true;
        if (slurType) prev.slur = slurType;
        if (articulation && !prev.articulation) prev.articulation = articulation;
      } else {
        items.push({
          id: `item-${mIdx}-${items.length}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'note',
          pitch,
          pitches: [pitch],
          duration,
          isDotted,
          isTied: isTied || undefined,
          slur: slurType === 'start' || slurType === 'stop' ? slurType : undefined,
          articulation: articulation || undefined,
          dynamic: dynamic || undefined,
          tuplet,
          lyric,
          voice,
          stemDirection,
        });
      }
    };

    const parseMeasureAttributes = (mEl: Element, mIdx: number) => {
      const measureNumber = mEl.getAttribute('number');
      const isImplicit = mEl.getAttribute('implicit') === 'yes';
      const isAnacrusis = mIdx === 0 && (measureNumber === '0' || isImplicit);

      const repeatStart =
        !!mEl.querySelector('barline[location="left"] repeat[direction="forward"]') ||
        !!mEl.querySelector('repeat[direction="forward"]');
      const repeatEnd =
        !!mEl.querySelector('barline[location="right"] repeat[direction="backward"]') ||
        !!mEl.querySelector('repeat[direction="backward"]');
      const endingEl = mEl.querySelector('ending');
      const endingNum = endingEl?.getAttribute('number');
      const volta = endingEl
        ? endingNum
          ? `${endingNum}.`
          : endingEl.textContent?.trim() || undefined
        : undefined;

      const printEl = mEl.querySelector('print');
      const pageBreak = printEl?.getAttribute('new-page') === 'yes';
      const systemBreak = !pageBreak && printEl?.getAttribute('new-system') === 'yes';
      const multiRestEl = mEl.querySelector('measure-style multiple-rest, multiple-rest');
      const multimeasureRest = multiRestEl
        ? parseInt(multiRestEl.textContent || '0', 10)
        : undefined;

      return {
        measureNumber,
        isAnacrusis,
        repeatStart,
        repeatEnd,
        volta,
        pageBreak,
        systemBreak,
        multimeasureRest,
      };
    };

    const createMeasureFromData = (
      mInfo: ReturnType<typeof parseMeasureAttributes>,
      mIdx: number,
      items: ScoreItem[]
    ): Measure => {
      let pickupBeats: number | undefined = undefined;
      if (mInfo.isAnacrusis) {
        pickupBeats = items.reduce(
          (sum, it) => sum + getItemBeats(it.duration, it.isDotted, it.tuplet),
          0
        );
      }

      return {
        id: `meas-${mIdx}-${Math.random().toString(36).substr(2, 5)}`,
        items:
          items.length > 0
            ? items
            : [
                {
                  id: `meas-rest-${mIdx}-${Math.random().toString(36).substr(2, 5)}`,
                  type: 'rest',
                  duration: 'w',
                } as ScoreItem,
              ],
        repeatStart: mInfo.repeatStart ? true : undefined,
        repeatEnd: mInfo.repeatEnd ? true : undefined,
        volta: mInfo.volta,
        isAnacrusis: mInfo.isAnacrusis ? true : undefined,
        pickupBeats: mInfo.isAnacrusis && pickupBeats && pickupBeats > 0 ? pickupBeats : undefined,
        pageBreak: mInfo.pageBreak || undefined,
        systemBreak: mInfo.systemBreak || undefined,
        multimeasureRest:
          mInfo.multimeasureRest && mInfo.multimeasureRest > 1 ? mInfo.multimeasureRest : undefined,
      };
    };

    let partElements = Array.from(doc.querySelectorAll('score-partwise > part'));
    if (partElements.length === 0) {
      partElements = Array.from(doc.querySelectorAll('part'));
    }

    const staves: Staff[] = [];
    let hasKeyboardGrandStaff = false;

    if (partElements.length > 0) {
      partElements.forEach((partEl, pIdx) => {
        const partId = partEl.getAttribute('id') || `P${pIdx + 1}`;
        const partInfo = partInfoMap.get(partId) || { name: `Instrumento ${pIdx + 1}` };

        // Check if part has multiple staves (e.g. keyboard)
        const stavesEl = partEl.querySelector('attributes > staves');
        const numStaves = stavesEl ? parseInt(stavesEl.textContent || '1', 10) : 1;
        const noteStaffEls = Array.from(partEl.querySelectorAll('note > staff, staff'));
        const hasStaff2 = noteStaffEls.some((s) => s.textContent?.trim() === '2');
        const isMultiStaff = numStaves >= 2 || hasStaff2;

        const measureElements = Array.from(partEl.querySelectorAll('measure'));

        if (isMultiStaff) {
          hasKeyboardGrandStaff = true;
          // Extract Clefs for staff 1 and 2
          const clefEls = Array.from(partEl.querySelectorAll('attributes clef, clef'));
          const c1El = clefEls.find((c) => c.getAttribute('number') === '1') || clefEls[0];
          const c2El = clefEls.find((c) => c.getAttribute('number') === '2') || clefEls[1];
          const clef1 = parseClefFromEl(c1El, 'treble');
          const clef2 = parseClefFromEl(c2El, 'bass');

          const measures1: Measure[] = [];
          const measures2: Measure[] = [];

          measureElements.forEach((mEl, mIdx) => {
            const mInfo = parseMeasureAttributes(mEl, mIdx);
            const items1: ScoreItem[] = [];
            const items2: ScoreItem[] = [];

            const notesEl = Array.from(mEl.querySelectorAll('note'));
            notesEl.forEach((nEl) => {
              const staffNum = nEl.querySelector('staff')?.textContent?.trim() || '1';
              if (staffNum === '2') {
                parseNoteElement(nEl, mIdx, items2);
              } else {
                parseNoteElement(nEl, mIdx, items1);
              }
            });

            measures1.push(createMeasureFromData(mInfo, mIdx, items1));
            measures2.push(createMeasureFromData(mInfo, mIdx, items2));
          });

          const isPiano = /piano|teclado|keyboard|clave/i.test(partInfo.name);
          const name1 =
            isPiano && partElements.length === 1 ? 'Mano Derecha' : `${partInfo.name} (MD)`;
          const name2 =
            isPiano && partElements.length === 1 ? 'Mano Izquierda' : `${partInfo.name} (MI)`;

          staves.push({
            id: `staff-${partId}-1`,
            name: name1,
            shortName: partInfo.shortName ? `${partInfo.shortName} 1` : undefined,
            clef: clef1,
            measures: measures1,
          });
          staves.push({
            id: `staff-${partId}-2`,
            name: name2,
            shortName: partInfo.shortName ? `${partInfo.shortName} 2` : undefined,
            clef: clef2,
            measures: measures2,
          });
        } else {
          // Single staff
          const firstClefEl = partEl.querySelector('attributes clef, clef');
          const staffClef = parseClefFromEl(firstClefEl, 'treble');

          const measures: Measure[] = [];
          measureElements.forEach((mEl, mIdx) => {
            const mInfo = parseMeasureAttributes(mEl, mIdx);
            const items: ScoreItem[] = [];
            Array.from(mEl.querySelectorAll('note')).forEach((nEl) => {
              parseNoteElement(nEl, mIdx, items);
            });
            measures.push(createMeasureFromData(mInfo, mIdx, items));
          });

          staves.push({
            id: `staff-${partId}`,
            name: partInfo.name,
            shortName: partInfo.shortName,
            clef: staffClef,
            measures:
              measures.length > 0
                ? measures
                : [
                    {
                      id: `m-1`,
                      items: [{ id: 'item-1', type: 'rest', duration: 'w' }],
                    },
                  ],
          });
        }
      });
    }

    if (staves.length === 0) {
      staves.push({
        id: 'staff-1',
        name: 'Voz / Melodía',
        clef: 'treble',
        measures: [{ id: 'm-1', items: [{ id: 'item-1', type: 'rest', duration: 'w' }] }],
      });
    }

    const isGrandStaff =
      (hasKeyboardGrandStaff && staves.length === 2) ||
      (staves.length === 2 &&
        staves[0].clef === 'treble' &&
        staves[1].clef === 'bass' &&
        /piano|teclado|mano/i.test(staves[0].name + staves[1].name));

    return {
      id: `score-${Date.now()}`,
      title,
      composer,
      tempo,
      timeSignature: { beats, beatType },
      keySignature,
      staves,
      isGrandStaff: isGrandStaff || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // Node.js / non-DOM regex-based parser fallback
  const extractTag = (xml: string, tag: string) => {
    const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
    return m ? m[1].trim() : null;
  };

  const title =
    extractTag(xmlString, 'work-title') ||
    extractTag(xmlString, 'movement-title') ||
    'Partitura Importada';
  const composer = extractTag(xmlString, 'creator') || 'Desconocido';

  const soundTempoMatch = /<sound[^>]*tempo="(\d+)"/i.exec(xmlString);
  const tempo = soundTempoMatch ? parseInt(soundTempoMatch[1], 10) : 120;

  const beatsMatch =
    /<time[^>]*>[\s\S]*?<beats>(\d+)<\/beats>[\s\S]*?<beat-type>(\d+)<\/beat-type>/i.exec(
      xmlString
    );
  const beats = beatsMatch ? parseInt(beatsMatch[1], 10) : 4;
  const beatType = beatsMatch ? parseInt(beatsMatch[2], 10) : 4;

  const fifthsMatch = /<key[^>]*>[\s\S]*?<fifths>(-?\d+)<\/fifths>/i.exec(xmlString);
  const modeMatch = /<key[^>]*>[\s\S]*?<mode>([a-z]+)<\/mode>/i.exec(xmlString);
  let keySignature: KeySignature = 'C';
  if (fifthsMatch) {
    const fifthsVal = parseInt(fifthsMatch[1], 10);
    const isMinor = modeMatch && modeMatch[1].toLowerCase() === 'minor';
    keySignature = isMinor
      ? FIFTHS_TO_MINOR_KEY[fifthsVal] || 'Am'
      : FIFTHS_TO_KEY[fifthsVal] || 'C';
  }

  // Parse part list
  const partMap = new Map<string, { name: string; shortName?: string }>();
  const scorePartRegex = /<score-part\s+id="([^"]*)"[^>]*>([\s\S]*?)<\/score-part>/gi;
  let spMatch: RegExpExecArray | null;
  while ((spMatch = scorePartRegex.exec(xmlString)) !== null) {
    const spId = spMatch[1];
    const spContent = spMatch[2];
    const nameMatch = /<part-name[^>]*>([\s\S]*?)<\/part-name>/i.exec(spContent);
    const abbrMatch = /<part-abbreviation[^>]*>([\s\S]*?)<\/part-abbreviation>/i.exec(spContent);
    partMap.set(spId, {
      name: nameMatch ? nameMatch[1].trim() : 'Instrumento',
      shortName: abbrMatch ? abbrMatch[1].trim() : undefined,
    });
  }

  const partBlockRegex = /<part\s+id="([^"]*)"[^>]*>([\s\S]*?)<\/part>/gi;
  let pbMatch: RegExpExecArray | null;
  const partBlocks: { id: string; xml: string }[] = [];
  while ((pbMatch = partBlockRegex.exec(xmlString)) !== null) {
    partBlocks.push({ id: pbMatch[1], xml: pbMatch[2] });
  }

  if (partBlocks.length === 0) {
    partBlocks.push({ id: 'P1', xml: xmlString });
  }

  const parseRegexNote = (noteXml: string, mIdx: number, items: ScoreItem[]): void => {
    const isRest = noteXml.includes('<rest');
    const isFullMeasureRest = /<rest[^>]*measure="yes"/i.test(noteXml);
    const typeStr = extractTag(noteXml, 'type');
    const duration: NoteDuration = isFullMeasureRest
      ? 'w'
      : typeStr
        ? XML_TYPE_TO_DURATION[typeStr] || 'q'
        : isRest
          ? 'w'
          : 'q';
    const isDotted = noteXml.includes('<dot');
    const lyric = extractTag(noteXml, 'text') || undefined;
    const actualMatch = /<actual-notes>(\d+)<\/actual-notes>/i.exec(noteXml);
    const normalMatch = /<normal-notes>(\d+)<\/normal-notes>/i.exec(noteXml);
    const tuplet =
      actualMatch && normalMatch
        ? { actual: parseInt(actualMatch[1], 10), normal: parseInt(normalMatch[1], 10) }
        : undefined;

    if (isRest) {
      items.push({
        id: `item-${mIdx}-${items.length}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'rest',
        duration,
        isDotted,
        tuplet,
        lyric,
      });
      return;
    }

    const step = (extractTag(noteXml, 'step') || 'C') as Step;
    const octave = parseInt(extractTag(noteXml, 'octave') || '4', 10);
    const alterVal = noteXml.includes('<alter>')
      ? parseInt(extractTag(noteXml, 'alter') || '0', 10)
      : null;
    const accText = extractTag(noteXml, 'accidental')?.toLowerCase() || null;
    const accidental = parseMusicXmlAccidental(alterVal, accText);
    const pitch: Pitch = { step, octave, accidental };

    const isTied =
      /<tie[^>]*type="start"/i.test(noteXml) || /<tied[^>]*type="start"/i.test(noteXml);
    const slurMatch = /<slur[^>]*type="(start|stop)"/i.exec(noteXml);
    const slur = slurMatch ? (slurMatch[1] as 'start' | 'stop') : undefined;

    let articulation: Articulation = null;
    if (/<staccato/i.test(noteXml)) articulation = 'staccato';
    else if (/<accent/i.test(noteXml)) articulation = 'accent';
    else if (/<tenuto/i.test(noteXml)) articulation = 'tenuto';
    else if (/<fermata/i.test(noteXml)) articulation = 'fermata';

    const dynMatch = /<(pp|p|mp|mf|f|ff)\/>/i.exec(noteXml);
    const dynamic = dynMatch ? (dynMatch[1].toLowerCase() as Dynamic) : null;

    const isChord = /<chord\s*\/?>/i.test(noteXml);
    if (isChord && items.length > 0 && items[items.length - 1].type === 'note') {
      const prev = items[items.length - 1];
      if (!prev.pitches) {
        prev.pitches = prev.pitch ? [prev.pitch, pitch] : [pitch];
      } else {
        prev.pitches.push(pitch);
      }
      if (isTied) prev.isTied = true;
      if (slur) prev.slur = slur;
      if (articulation && !prev.articulation) prev.articulation = articulation;
    } else {
      items.push({
        id: `item-${mIdx}-${items.length}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'note',
        pitch,
        pitches: [pitch],
        duration,
        isDotted,
        isTied: isTied || undefined,
        slur,
        articulation: articulation || undefined,
        dynamic: dynamic || undefined,
        tuplet,
        lyric,
      });
    }
  };

  const staves: Staff[] = [];
  let hasKeyboardGrandStaff = false;

  partBlocks.forEach((pBlock, pIdx) => {
    const partInfo = partMap.get(pBlock.id) || { name: `Instrumento ${pIdx + 1}` };
    const isDualStaff =
      /<staves>[2-9]<\/staves>/i.test(pBlock.xml) || /<staff>2<\/staff>/i.test(pBlock.xml);

    const clefMatches = [...pBlock.xml.matchAll(/<clef[^>]*>[\s\S]*?<sign>([A-Z])<\/sign>/gi)];
    const clef1Sign = clefMatches[0] ? clefMatches[0][1] : 'G';
    const clef2Sign = clefMatches[1] ? clefMatches[1][1] : 'F';
    const clef1: Clef = clef1Sign === 'F' ? 'bass' : clef1Sign === 'C' ? 'alto' : 'treble';
    const clef2: Clef = clef2Sign === 'G' ? 'treble' : clef2Sign === 'C' ? 'alto' : 'bass';

    const measureRegex = /<measure([^>]*)>([\s\S]*?)<\/measure>/gi;
    let mMatch: RegExpExecArray | null;

    if (isDualStaff) {
      hasKeyboardGrandStaff = true;
      const measures1: Measure[] = [];
      const measures2: Measure[] = [];
      let mIdx = 0;

      while ((mMatch = measureRegex.exec(pBlock.xml)) !== null) {
        const measureAttrs = mMatch[1];
        const measureXml = mMatch[2];
        const isPickup = /number="0"/i.test(measureAttrs) || /implicit="yes"/i.test(measureAttrs);
        const isAnacrusis = mIdx === 0 && isPickup;
        const repeatStart = /<repeat[^>]*direction="forward"/i.test(measureXml);
        const repeatEnd = /<repeat[^>]*direction="backward"/i.test(measureXml);
        const endingMatch = /<ending[^>]*number="([^"]*)"/i.exec(measureXml);
        const volta = endingMatch ? `${endingMatch[1]}.` : undefined;
        const pageBreak = /<print[^>]*new-page="yes"/i.test(measureXml);
        const systemBreak = !pageBreak && /<print[^>]*new-system="yes"/i.test(measureXml);
        const multiRestMatch = /<multiple-rest>(\d+)<\/multiple-rest>/i.exec(measureXml);
        const multimeasureRest = multiRestMatch ? parseInt(multiRestMatch[1], 10) : undefined;

        const noteRegex = /<note[^>]*>([\s\S]*?)<\/note>/gi;
        let nMatch: RegExpExecArray | null;
        const items1: ScoreItem[] = [];
        const items2: ScoreItem[] = [];

        while ((nMatch = noteRegex.exec(measureXml)) !== null) {
          const noteXml = nMatch[1];
          const isStaff2 = /<staff>2<\/staff>/i.test(noteXml);
          if (isStaff2) {
            parseRegexNote(noteXml, mIdx, items2);
          } else {
            parseRegexNote(noteXml, mIdx, items1);
          }
        }

        const createM = (its: ScoreItem[]) => {
          let pickupBeats: number | undefined = undefined;
          if (isAnacrusis) {
            pickupBeats = its.reduce(
              (sum, it) => sum + getItemBeats(it.duration, it.isDotted, it.tuplet),
              0
            );
          }
          return {
            id: `meas-${pBlock.id}-${mIdx}-${Math.random().toString(36).substr(2, 5)}`,
            items:
              its.length > 0
                ? its
                : [
                    {
                      id: `meas-rest-${pBlock.id}-${mIdx}-${Math.random().toString(36).substr(2, 5)}`,
                      type: 'rest',
                      duration: 'w',
                    } as ScoreItem,
                  ],
            repeatStart: repeatStart ? true : undefined,
            repeatEnd: repeatEnd ? true : undefined,
            volta,
            isAnacrusis: isAnacrusis ? true : undefined,
            pickupBeats: isAnacrusis && pickupBeats && pickupBeats > 0 ? pickupBeats : undefined,
            pageBreak: pageBreak || undefined,
            systemBreak: systemBreak || undefined,
            multimeasureRest:
              multimeasureRest && multimeasureRest > 1 ? multimeasureRest : undefined,
          };
        };

        measures1.push(createM(items1));
        measures2.push(createM(items2));
        mIdx++;
      }

      const isPiano = /piano|teclado|keyboard|clave/i.test(partInfo.name);
      const name1 = isPiano && partBlocks.length === 1 ? 'Mano Derecha' : `${partInfo.name} (MD)`;
      const name2 = isPiano && partBlocks.length === 1 ? 'Mano Izquierda' : `${partInfo.name} (MI)`;

      staves.push({
        id: `staff-${pBlock.id}-1`,
        name: name1,
        shortName: partInfo.shortName ? `${partInfo.shortName} 1` : undefined,
        clef: clef1,
        measures: measures1,
      });
      staves.push({
        id: `staff-${pBlock.id}-2`,
        name: name2,
        shortName: partInfo.shortName ? `${partInfo.shortName} 2` : undefined,
        clef: clef2,
        measures: measures2,
      });
    } else {
      const measures: Measure[] = [];
      let mIdx = 0;

      while ((mMatch = measureRegex.exec(pBlock.xml)) !== null) {
        const measureAttrs = mMatch[1];
        const measureXml = mMatch[2];
        const isPickup = /number="0"/i.test(measureAttrs) || /implicit="yes"/i.test(measureAttrs);
        const isAnacrusis = mIdx === 0 && isPickup;
        const repeatStart = /<repeat[^>]*direction="forward"/i.test(measureXml);
        const repeatEnd = /<repeat[^>]*direction="backward"/i.test(measureXml);
        const endingMatch = /<ending[^>]*number="([^"]*)"/i.exec(measureXml);
        const volta = endingMatch ? `${endingMatch[1]}.` : undefined;
        const pageBreak = /<print[^>]*new-page="yes"/i.test(measureXml);
        const systemBreak = !pageBreak && /<print[^>]*new-system="yes"/i.test(measureXml);
        const multiRestMatch = /<multiple-rest>(\d+)<\/multiple-rest>/i.exec(measureXml);
        const multimeasureRest = multiRestMatch ? parseInt(multiRestMatch[1], 10) : undefined;

        const noteRegex = /<note[^>]*>([\s\S]*?)<\/note>/gi;
        let nMatch: RegExpExecArray | null;
        const items: ScoreItem[] = [];

        while ((nMatch = noteRegex.exec(measureXml)) !== null) {
          parseRegexNote(nMatch[1], mIdx, items);
        }

        let pickupBeats: number | undefined = undefined;
        if (isAnacrusis) {
          pickupBeats = items.reduce(
            (sum, it) => sum + getItemBeats(it.duration, it.isDotted, it.tuplet),
            0
          );
        }

        measures.push({
          id: `meas-${pBlock.id}-${mIdx}-${Math.random().toString(36).substr(2, 5)}`,
          items:
            items.length > 0
              ? items
              : [
                  {
                    id: `meas-rest-${pBlock.id}-${mIdx}-${Math.random().toString(36).substr(2, 5)}`,
                    type: 'rest',
                    duration: 'w',
                  } as ScoreItem,
                ],
          repeatStart: repeatStart ? true : undefined,
          repeatEnd: repeatEnd ? true : undefined,
          volta,
          isAnacrusis: isAnacrusis ? true : undefined,
          pickupBeats: isAnacrusis && pickupBeats && pickupBeats > 0 ? pickupBeats : undefined,
          pageBreak: pageBreak || undefined,
          systemBreak: systemBreak || undefined,
          multimeasureRest: multimeasureRest && multimeasureRest > 1 ? multimeasureRest : undefined,
        });
        mIdx++;
      }

      staves.push({
        id: `staff-${pBlock.id}`,
        name: partInfo.name,
        shortName: partInfo.shortName,
        clef: clef1,
        measures:
          measures.length > 0
            ? measures
            : [{ id: 'm-1', items: [{ id: 'item-1', type: 'rest', duration: 'w' }] }],
      });
    }
  });

  const isGrandStaff =
    (hasKeyboardGrandStaff && staves.length === 2) ||
    (staves.length === 2 &&
      staves[0].clef === 'treble' &&
      staves[1].clef === 'bass' &&
      /piano|teclado|mano/i.test(staves[0].name + staves[1].name));

  return {
    id: `score-${Date.now()}`,
    title,
    composer,
    tempo,
    timeSignature: { beats, beatType },
    keySignature,
    staves,
    isGrandStaff: isGrandStaff || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
