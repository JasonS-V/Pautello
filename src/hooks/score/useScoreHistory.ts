import { useState, useRef, useEffect, useCallback } from 'react';
import { Score } from '../../types/music';
import { loadScoreFromStorage, saveScoreToStorage } from '../../utils/storage';

export type SaveState = 'saved' | 'saving';

export const AUTOSAVE_DEBOUNCE_MS = 500;

export interface UseScoreHistoryReturn {
  score: Score;
  setScore: React.Dispatch<React.SetStateAction<Score>>;
  pushHistory: (currentScore: Score) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: SaveState;
}

export function useScoreHistory(initialScoreLoader?: () => Score): UseScoreHistoryReturn {
  const [score, setScoreInternal] = useState<Score>(() => {
    if (initialScoreLoader) return initialScoreLoader();
    return loadScoreFromStorage();
  });

  const historyRef = useRef<Score[]>([]);
  const futureRef = useRef<Score[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  const [saveState, setSaveState] = useState<SaveState>('saved');
  const pendingScoreRef = useRef<Score | null>(null);

  const setScore = useCallback<React.Dispatch<React.SetStateAction<Score>>>((action) => {
    setSaveState('saving');
    setScoreInternal(action);
  }, []);

  useEffect(() => {
    pendingScoreRef.current = score;
    const timer = setTimeout(() => {
      saveScoreToStorage(score);
      pendingScoreRef.current = null;
      setSaveState('saved');
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [score]);

  useEffect(() => {
    const flushPendingSave = () => {
      const pending = pendingScoreRef.current;
      if (!pending) return;
      pendingScoreRef.current = null;
      saveScoreToStorage(pending);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSave();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushPendingSave);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushPendingSave);
    };
  }, []);

  const pushHistory = useCallback((currentScore: Score) => {
    historyRef.current.push(JSON.parse(JSON.stringify(currentScore)));
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    futureRef.current.push(JSON.parse(JSON.stringify(score)));
    setScore(prev);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  }, [score, setScore]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    historyRef.current.push(JSON.parse(JSON.stringify(score)));
    setScore(next);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }, [score, setScore]);

  return {
    score,
    setScore,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
  };
}
