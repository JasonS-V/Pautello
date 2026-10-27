import { Pitch, Clef, NoteDuration, Accidental, NamingConvention } from '../../types/music';

export interface ScoreDragState {
  itemId: string;
  sourceMeasureIdx: number;
  sourceStaffIdx: number;
  initialPitch: Pitch;
  currentPitch: Pitch;
  targetMeasureIdx: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  hasMoved: boolean;
}

export interface GhostNoteState {
  isHovered: boolean;
  hoveredStaffStep: number | null;
  hoveredStaffIdx: number;
  hoveredX: number | null;
  isRestMode: boolean;
  activeDuration: NoteDuration;
  activeAccidental: Accidental;
  activeOctave: number;
  isOctaveLockEnabled: boolean;
  namingConvention: NamingConvention;
  targetClef: Clef;
}
