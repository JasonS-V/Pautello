import { ScoreItem, TimeSignature, Clef, NoteDuration, getItemPitches } from '../types/music';
import { getItemBeats } from '../constants/pitches';
import { pitchToStaffStep, staffStepToY } from './engraverMath';

export interface ItemPosition {
  x: number;
  startBeat: number;
  durationBeats: number;
}

export interface BeamedNoteInfo {
  itemIdx: number;
  item: ScoreItem;
  stemX: number;
  stemEndY: number;
  noteY: number;
  stemUp: boolean;
  duration: NoteDuration;
}

export interface BeamGroup {
  id: string;
  notes: BeamedNoteInfo[];
  stemUp: boolean;
  // Primary beam line endpoints
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // Secondary beam segments for 16th notes
  secondaryBeams: { x1: number; y1: number; x2: number; y2: number }[];
}

/**
 * Calculates proportional horizontal X positions for items in a measure.
 * Blends proportional beat placement (75%) with uniform spacing (25%) for optimal legibility.
 * If a measure contains only 1 item (e.g. whole note or whole rest), it is centered.
 */
export function calculateItemPositions(
  items: ScoreItem[],
  availableWidth: number,
  timeSignature: TimeSignature
): ItemPosition[] {
  const count = items.length;
  if (count === 0) return [];

  const beatsPerMeasure = timeSignature.beats * (4 / timeSignature.beatType);

  // Single item in measure: center it aesthetically
  if (count === 1) {
    const durBeats = getItemBeats(items[0].duration, items[0].isDotted, items[0].tuplet);
    return [{ x: availableWidth / 2, startBeat: 0, durationBeats: durBeats }];
  }

  const paddingLeft = 24;
  const paddingRight = 20;
  const contentWidth = Math.max(80, availableWidth - paddingLeft - paddingRight);

  // Calculate cumulative beats
  const beatOffsets: number[] = [];
  let currentBeat = 0;
  for (let i = 0; i < count; i++) {
    beatOffsets.push(currentBeat);
    currentBeat += getItemBeats(items[i].duration, items[i].isDotted, items[i].tuplet);
  }

  const totalBeats = Math.max(beatsPerMeasure, currentBeat);
  const positions: ItemPosition[] = [];

  for (let i = 0; i < count; i++) {
    const b = beatOffsets[i];
    const dur = getItemBeats(items[i].duration, items[i].isDotted, items[i].tuplet);

    const propFrac = b / Math.max(1, totalBeats);
    const uniformFrac = i / Math.max(1, count - 1);

    // 75% proportional to beats, 25% uniform for balanced spacing
    const combinedFrac = 0.75 * propFrac + 0.25 * uniformFrac;
    const x = Math.round(paddingLeft + combinedFrac * contentWidth);

    positions.push({ x, startBeat: b, durationBeats: dur });
  }

  return positions;
}

/**
 * Detects and groups beamable notes (eighths and sixteenths) that occur within the same beat.
 * Computes stem directions, common beam slopes and secondary beams for 16th notes.
 */
export function detectBeamGroups(
  items: ScoreItem[],
  positions: ItemPosition[],
  clef: Clef,
  baseTopOffset: number,
  lineSpacing: number = 10,
  timeSignature?: TimeSignature,
  overrideStemUp?: boolean
): { beamGroups: BeamGroup[]; beamedItemIndices: Set<number> } {
  const beamGroups: BeamGroup[] = [];
  const beamedItemIndices = new Set<number>();

  if (items.length < 2) {
    return { beamGroups, beamedItemIndices };
  }

  // Determine beat unit (1.0 for quarter note meters, 1.5 for compound meters like 6/8)
  const beatUnit =
    timeSignature && timeSignature.beatType === 8 && timeSignature.beats % 3 === 0 ? 1.5 : 1.0;

  let currentGroupItems: { item: ScoreItem; idx: number }[] = [];
  let currentBeatWindow = -1;

  const flushGroup = () => {
    if (currentGroupItems.length >= 2) {
      // Create beam group
      const groupNotes: BeamedNoteInfo[] = [];

      // 1. Calculate staff steps and common stem direction
      let totalStaffStep = 0;
      currentGroupItems.forEach(({ item }) => {
        const pitches = getItemPitches(item);
        if (pitches.length > 0) {
          const avg = pitches.reduce((s, p) => s + pitchToStaffStep(p, clef), 0) / pitches.length;
          totalStaffStep += avg;
        }
      });
      const avgStaffStep = totalStaffStep / Math.max(1, currentGroupItems.length);
      // If average step is <= 4 (middle line B4 or higher), stems go DOWN; otherwise UP
      // overrideStemUp takes precedence if specified (e.g. for polyphonic voice 1 / voice 2)
      const stemUp = overrideStemUp !== undefined ? overrideStemUp : avgStaffStep > 4;

      // 2. Pre-calculate notehead Y coordinates
      const noteYList: number[] = [];
      const stemXList: number[] = [];

      currentGroupItems.forEach(({ item, idx }) => {
        const pitches = getItemPitches(item);
        let refStep = 4;
        if (pitches.length > 0) {
          const steps = pitches.map((p) => pitchToStaffStep(p, clef));
          refStep = stemUp ? Math.min(...steps) : Math.max(...steps);
        }
        const noteY = baseTopOffset + staffStepToY(refStep, lineSpacing);
        const itemX = positions[idx]?.x || 20;
        const stemX = itemX + (stemUp ? 5.8 : -5.8);

        noteYList.push(noteY);
        stemXList.push(stemX);
        beamedItemIndices.add(idx);
      });

      // 3. Beam slope and baseline calculation
      const firstNoteY = noteYList[0];
      const lastNoteY = noteYList[noteYList.length - 1];
      const deltaY = Math.max(-10, Math.min(10, (lastNoteY - firstNoteY) * 0.45));

      let beamY1: number;
      let beamY2: number;

      if (stemUp) {
        // Beam sits above the highest notehead (smallest Y)
        const highestNoteY = Math.min(...noteYList);
        beamY1 = Math.min(firstNoteY - 28, highestNoteY - 26);
        beamY2 = beamY1 + deltaY;
      } else {
        // Beam sits below the lowest notehead (largest Y)
        const lowestNoteY = Math.max(...noteYList);
        beamY1 = Math.max(firstNoteY + 28, lowestNoteY + 26);
        beamY2 = beamY1 + deltaY;
      }

      const x1 = stemXList[0];
      const x2 = stemXList[stemXList.length - 1];

      // 4. Compute exact stem end for each note along the beam line
      currentGroupItems.forEach(({ item, idx }, gIdx) => {
        const sx = stemXList[gIdx];
        const t = (sx - x1) / Math.max(1, x2 - x1);
        const stemEndY = beamY1 + t * (beamY2 - beamY1);

        groupNotes.push({
          itemIdx: idx,
          item,
          stemX: sx,
          stemEndY,
          noteY: noteYList[gIdx],
          stemUp,
          duration: item.duration,
        });
      });

      // 5. Detect secondary beams for 16th notes
      const secondaryBeams: { x1: number; y1: number; x2: number; y2: number }[] = [];
      const beamOffset = stemUp ? 4.5 : -4.5;

      for (let i = 0; i < groupNotes.length; i++) {
        if (groupNotes[i].duration === '16' || groupNotes[i].duration === '32') {
          // Check if next note is also 16th
          if (
            i < groupNotes.length - 1 &&
            (groupNotes[i + 1].duration === '16' || groupNotes[i + 1].duration === '32')
          ) {
            const sx1 = groupNotes[i].stemX;
            const sy1 = groupNotes[i].stemEndY + beamOffset;
            const sx2 = groupNotes[i + 1].stemX;
            const sy2 = groupNotes[i + 1].stemEndY + beamOffset;
            secondaryBeams.push({ x1: sx1, y1: sy1, x2: sx2, y2: sy2 });
          } else if (
            i > 0 &&
            (groupNotes[i - 1].duration === '16' || groupNotes[i - 1].duration === '32')
          ) {
            // Already connected to previous
          } else {
            // Fractional beamlet (8px) pointing towards companion note
            const sx1 = groupNotes[i].stemX;
            const sy1 = groupNotes[i].stemEndY + beamOffset;
            const dir = i === 0 ? 1 : -1;
            const slope = (beamY2 - beamY1) / Math.max(1, x2 - x1);
            secondaryBeams.push({
              x1: sx1,
              y1: sy1,
              x2: sx1 + dir * 9,
              y2: sy1 + dir * 9 * slope,
            });
          }
        }
      }

      beamGroups.push({
        id: `beam-${currentGroupItems[0].idx}-${currentGroupItems[currentGroupItems.length - 1].idx}`,
        notes: groupNotes,
        stemUp,
        x1,
        y1: beamY1,
        x2,
        y2: beamY2,
        secondaryBeams,
      });
    }

    currentGroupItems = [];
    currentBeatWindow = -1;
  };

  items.forEach((item, idx) => {
    const isBeamable = item.type === 'note' && (item.duration === '8' || item.duration === '16');

    if (!isBeamable) {
      flushGroup();
      return;
    }

    const pos = positions[idx];
    const beatIndex = Math.floor(((pos?.startBeat || 0) + 1e-5) / beatUnit);

    if (currentBeatWindow === -1 || currentBeatWindow === beatIndex) {
      currentGroupItems.push({ item, idx });
      currentBeatWindow = beatIndex;
    } else {
      flushGroup();
      currentGroupItems.push({ item, idx });
      currentBeatWindow = beatIndex;
    }
  });

  flushGroup();

  return { beamGroups, beamedItemIndices };
}
