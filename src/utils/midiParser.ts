import {
  Score,
  ScoreItem,
  Step,
  Accidental,
  Pitch,
  NoteDuration,
  KeySignature,
  Clef,
} from '../types/music';

interface ParsedMidiNote {
  midi: number;
  startTick: number;
  durationTicks: number;
}

/**
 * Reads a variable-length integer from a Uint8Array starting at offset
 */
function readVarLength(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let bytesRead = 0;

  while (offset + bytesRead < data.length) {
    const byte = data[offset + bytesRead];
    value = (value << 7) | (byte & 0x7f);
    bytesRead++;
    // El byte alto a 1 indica que la longitud continúa en el siguiente byte.
    if ((byte & 0x80) === 0) break;
  }

  return { value, bytesRead };
}

/**
 * Parses a standard MIDI binary buffer (format 0 or 1) into a Pautello Score
 */
export function parseMidiToScore(arrayBuffer: ArrayBuffer, fileName = 'Obra MIDI'): Score {
  const data = new Uint8Array(arrayBuffer);
  let pos = 0;

  // 1. Verify MThd header
  const headerTag = String.fromCharCode(...data.slice(pos, pos + 4));
  if (headerTag !== 'MThd') {
    throw new Error(
      'El archivo seleccionado no es un archivo MIDI válido (cabecera MThd ausente).'
    );
  }
  pos += 4;

  const headerLength =
    (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
  pos += 4;

  const _format = (data[pos] << 8) | data[pos + 1];
  void _format;
  const numTracks = (data[pos + 2] << 8) | data[pos + 3];
  const timeDivision = (data[pos + 4] << 8) | data[pos + 5];
  const ticksPerQuarter = timeDivision > 0 ? timeDivision : 480;
  pos += headerLength;

  let title = fileName.replace(/\.[^/.]+$/, '');
  const composer = 'Desconocido';
  let tempo = 120;
  let beats = 4;
  let beatType = 4;
  let keySignature: KeySignature = 'C';

  const collectedNotes: ParsedMidiNote[] = [];

  // 2. Parse Tracks
  for (let t = 0; t < numTracks && pos < data.length; t++) {
    const trackTag = String.fromCharCode(...data.slice(pos, pos + 4));
    pos += 4;
    if (trackTag !== 'MTrk') {
      // Skip unknown chunk
      const chunkLen =
        (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
      pos += 4 + chunkLen;
      continue;
    }

    const trackLen =
      (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
    pos += 4;
    const trackEnd = pos + trackLen;

    let currentTick = 0;
    let runningStatus = 0;
    const activeNoteOns = new Map<number, number>(); // midi -> startTick

    while (pos < trackEnd && pos < data.length) {
      const { value: delta, bytesRead } = readVarLength(data, pos);
      pos += bytesRead;
      currentTick += delta;

      let statusByte = data[pos];

      // Handle running status
      if (statusByte < 0x80) {
        statusByte = runningStatus;
      } else {
        pos++;
        runningStatus = statusByte;
      }

      const eventType = statusByte & 0xf0;

      // Meta event
      if (statusByte === 0xff) {
        const metaType = data[pos];
        pos++;
        const { value: metaLen, bytesRead: metaLenBytes } = readVarLength(data, pos);
        pos += metaLenBytes;

        if (metaType === 0x03 && metaLen > 0) {
          // Sequence / Track Name
          const nameBytes = data.slice(pos, pos + metaLen);
          const name = new TextDecoder('utf-8').decode(nameBytes).trim();
          if (name && (title === fileName || title === 'Obra MIDI')) {
            title = name;
          }
        } else if (metaType === 0x51 && metaLen === 3) {
          // Set Tempo
          const usPerQuarter = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
          if (usPerQuarter > 0) {
            tempo = Math.round(60000000 / usPerQuarter);
          }
        } else if (metaType === 0x58 && metaLen >= 2) {
          // Time Signature
          beats = data[pos] || 4;
          beatType = Math.pow(2, data[pos + 1] || 2);
        } else if (metaType === 0x59 && metaLen >= 2) {
          // Key Signature (sf: signed sharps/flats, mi: 0=major, 1=minor)
          let sf = data[pos];
          if (sf > 127) sf -= 256; // convert uint8 to int8
          const isMinor = data[pos + 1] === 1;

          const FIFTHS_MAJOR: Record<number, KeySignature> = {
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
          const FIFTHS_MINOR: Record<number, KeySignature> = {
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
          keySignature = isMinor ? FIFTHS_MINOR[sf] || 'Am' : FIFTHS_MAJOR[sf] || 'C';
        }

        pos += metaLen;
      } else if (eventType === 0x90) {
        // Note On
        const note = data[pos];
        const velocity = data[pos + 1];
        pos += 2;

        if (velocity > 0) {
          activeNoteOns.set(note, currentTick);
        } else {
          // Note On with velocity 0 is Note Off
          const start = activeNoteOns.get(note);
          if (start !== undefined) {
            collectedNotes.push({
              midi: note,
              startTick: start,
              durationTicks: Math.max(ticksPerQuarter / 4, currentTick - start),
            });
            activeNoteOns.delete(note);
          }
        }
      } else if (eventType === 0x80) {
        // Note Off
        const note = data[pos];
        pos += 2;
        const start = activeNoteOns.get(note);
        if (start !== undefined) {
          collectedNotes.push({
            midi: note,
            startTick: start,
            durationTicks: Math.max(ticksPerQuarter / 4, currentTick - start),
          });
          activeNoteOns.delete(note);
        }
      } else if (eventType === 0xc0 || eventType === 0xd0) {
        // Program Change or Channel Pressure (1 byte)
        pos += 1;
      } else if (eventType === 0xb0 || eventType === 0xe0 || eventType === 0xa0) {
        // Control Change, Pitch Bend, Poly Key Pressure (2 bytes)
        pos += 2;
      } else if (statusByte === 0xf0 || statusByte === 0xf7) {
        // SysEx
        const { value: sysExLen, bytesRead: sysExBytes } = readVarLength(data, pos);
        pos += sysExBytes + sysExLen;
      } else {
        // Unknown or unsupported event - bail safely to next track
        pos = trackEnd;
      }
    }
  }

  // 3. Sort notes chronologically
  collectedNotes.sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);

  // 4. Quantize and convert to measures
  const beatsPerMeasure = (beats * 4) / beatType;
  const ticksPerMeasure = beatsPerMeasure * ticksPerQuarter;

  // Determine appropriate clef based on average note pitch
  const avgMidi =
    collectedNotes.length > 0
      ? collectedNotes.reduce((acc, n) => acc + n.midi, 0) / collectedNotes.length
      : 60;
  const clef: Clef = avgMidi < 55 ? 'bass' : 'treble';

  const quantizeDuration = (ticks: number): { duration: NoteDuration; isDotted: boolean } => {
    const qBeats = ticks / ticksPerQuarter;
    if (qBeats >= 3.5) return { duration: 'w', isDotted: false };
    if (qBeats >= 2.5) return { duration: 'h', isDotted: true };
    if (qBeats >= 1.75) return { duration: 'h', isDotted: false };
    if (qBeats >= 1.25) return { duration: 'q', isDotted: true };
    if (qBeats >= 0.75) return { duration: 'q', isDotted: false };
    if (qBeats >= 0.6) return { duration: '8', isDotted: true };
    if (qBeats >= 0.35) return { duration: '8', isDotted: false };
    return { duration: '16', isDotted: false };
  };

  const midiToPitch = (midi: number): Pitch => {
    const octave = Math.floor(midi / 12) - 1;
    const pc = midi % 12;
    const map: { step: Step; accidental: Accidental }[] = [
      { step: 'C', accidental: null },
      { step: 'C', accidental: '#' },
      { step: 'D', accidental: null },
      { step: 'E', accidental: 'b' },
      { step: 'E', accidental: null },
      { step: 'F', accidental: null },
      { step: 'F', accidental: '#' },
      { step: 'G', accidental: null },
      { step: 'A', accidental: 'b' },
      { step: 'A', accidental: null },
      { step: 'B', accidental: 'b' },
      { step: 'B', accidental: null },
    ];
    return {
      step: map[pc].step,
      octave,
      accidental: map[pc].accidental,
    };
  };

  // Group notes into measures
  const maxTick =
    collectedNotes.length > 0
      ? Math.max(...collectedNotes.map((n) => n.startTick + n.durationTicks))
      : ticksPerMeasure;
  const totalMeasures = Math.max(1, Math.ceil(maxTick / ticksPerMeasure));

  const measures = [];
  for (let m = 0; m < totalMeasures; m++) {
    const mStartTick = m * ticksPerMeasure;
    const mEndTick = (m + 1) * ticksPerMeasure;

    const measureNotes = collectedNotes.filter(
      (n) => n.startTick >= mStartTick && n.startTick < mEndTick
    );

    const items: ScoreItem[] = [];

    if (measureNotes.length === 0) {
      items.push({
        id: `rest-${m}-0`,
        type: 'rest',
        duration: 'w',
      });
    } else {
      measureNotes.forEach((n, idx) => {
        const { duration, isDotted } = quantizeDuration(n.durationTicks);
        items.push({
          id: `note-${m}-${idx}-${n.midi}`,
          type: 'note',
          pitch: midiToPitch(n.midi),
          duration,
          isDotted,
        });
      });
    }

    measures.push({
      id: `meas-${m}`,
      items,
    });
  }

  return {
    id: `score-${Date.now()}`,
    title,
    composer,
    tempo: Math.max(30, Math.min(300, tempo)),
    timeSignature: { beats, beatType },
    keySignature,
    staves: [
      {
        id: 'staff-1',
        name: 'Melodía MIDI',
        clef,
        measures,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
