import { useState, useCallback, useMemo } from 'react';
import { Score, Pitch } from '../types/music';
import { pitchToMidi } from '../constants/pitches';
import { audioEngine } from '../audio/synth';

export interface PracticeStats {
  correctHits: number;
  totalAttempts: number;
  streak: number;
  accuracy: number;
}

interface UsePracticeModeOptions {
  score: Score;
  onNoteHit?: (measureIdx: number, itemIdx: number) => void;
}

export function usePracticeMode({ score, onNoteHit }: UsePracticeModeOptions) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [currentMeasureIdx, setCurrentMeasureIdx] = useState<number>(0);
  const [currentItemIdx, setCurrentItemIdx] = useState<number>(0);
  const [correctHits, setCorrectHits] = useState<number>(0);
  const [totalAttempts, setTotalAttempts] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [lastHitResult, setLastHitResult] = useState<'correct' | 'incorrect' | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Flatten all playable notes in the score with their positions
  const playableNotes = useMemo(() => {
    const list: { measureIdx: number; itemIdx: number; pitch: Pitch; midi: number }[] = [];
    const staff = score.staves[0];
    if (!staff) return list;

    staff.measures.forEach((measure, mIdx) => {
      measure.items.forEach((item, iIdx) => {
        if (item.type === 'note' && item.pitch) {
          list.push({
            measureIdx: mIdx,
            itemIdx: iIdx,
            pitch: item.pitch,
            midi: pitchToMidi(item.pitch),
          });
        }
      });
    });

    return list;
  }, [score]);

  // Find index in playableNotes matching current measure & item
  const currentNoteIndex = useMemo(() => {
    return playableNotes.findIndex(
      (n) => n.measureIdx === currentMeasureIdx && n.itemIdx === currentItemIdx
    );
  }, [playableNotes, currentMeasureIdx, currentItemIdx]);

  const targetNote = useMemo(() => {
    if (playableNotes.length === 0) return null;
    if (currentNoteIndex >= 0 && currentNoteIndex < playableNotes.length) {
      return playableNotes[currentNoteIndex];
    }
    return playableNotes[0];
  }, [playableNotes, currentNoteIndex]);

  const startPractice = useCallback(() => {
    setIsActive(true);
    setIsCompleted(false);
    setCorrectHits(0);
    setTotalAttempts(0);
    setStreak(0);
    setLastHitResult(null);

    if (playableNotes.length > 0) {
      setCurrentMeasureIdx(playableNotes[0].measureIdx);
      setCurrentItemIdx(playableNotes[0].itemIdx);
      onNoteHit?.(playableNotes[0].measureIdx, playableNotes[0].itemIdx);
    }
  }, [playableNotes, onNoteHit]);

  const stopPractice = useCallback(() => {
    setIsActive(false);
    setLastHitResult(null);
  }, []);

  const resetPractice = useCallback(() => {
    setIsCompleted(false);
    setCorrectHits(0);
    setTotalAttempts(0);
    setStreak(0);
    setLastHitResult(null);
    if (playableNotes.length > 0) {
      setCurrentMeasureIdx(playableNotes[0].measureIdx);
      setCurrentItemIdx(playableNotes[0].itemIdx);
    }
  }, [playableNotes]);

  // Called whenever user presses a key on Virtual Piano or MIDI Keyboard
  const checkPlayedMidi = useCallback(
    (playedMidi: number) => {
      if (!isActive || !targetNote) return false;

      setTotalAttempts((prev) => prev + 1);

      // Verify if note matches (handling enharmonic/octave or exact pitch)
      // Allow exact MIDI match, or same pitch class if desired. Here we match exact MIDI or same pitch class.
      const isMatch = playedMidi === targetNote.midi;

      if (isMatch) {
        setCorrectHits((prev) => prev + 1);
        setStreak((prev) => prev + 1);
        setLastHitResult('correct');

        // Play feedback tone
        audioEngine.playMidi(playedMidi, 0.35, 0.9);

        // Advance to next note
        const nextIdx = currentNoteIndex + 1;
        if (nextIdx < playableNotes.length) {
          const nextNote = playableNotes[nextIdx];
          setCurrentMeasureIdx(nextNote.measureIdx);
          setCurrentItemIdx(nextNote.itemIdx);
          onNoteHit?.(nextNote.measureIdx, nextNote.itemIdx);
        } else {
          // Completed the entire score!
          setIsCompleted(true);
        }

        setTimeout(() => setLastHitResult(null), 350);
        return true;
      } else {
        setStreak(0);
        setLastHitResult('incorrect');
        setTimeout(() => setLastHitResult(null), 400);
        return false;
      }
    },
    [isActive, targetNote, currentNoteIndex, playableNotes, onNoteHit]
  );

  const accuracy = totalAttempts > 0 ? Math.round((correctHits / totalAttempts) * 100) : 100;

  return {
    isActive,
    targetNote,
    currentMeasureIdx,
    currentItemIdx,
    correctHits,
    totalAttempts,
    streak,
    accuracy,
    lastHitResult,
    isCompleted,
    totalNotes: playableNotes.length,
    currentNoteNumber: currentNoteIndex >= 0 ? currentNoteIndex + 1 : 1,
    startPractice,
    stopPractice,
    resetPractice,
    checkPlayedMidi,
  };
}
