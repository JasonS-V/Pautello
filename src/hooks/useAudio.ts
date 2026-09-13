import { useState, useEffect, useCallback } from 'react';
import { Score } from '../types/music';
import { scorePlayer, PlaybackState } from '../audio/player';
import { audioEngine, InstrumentType } from '../audio/synth';

export function useAudio(score: Score) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentMeasureIndex: 0,
    currentItemIndex: -1,
    currentBeat: 0,
  });

  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean>(false);
  const [instrument, setInstrument] = useState<InstrumentType>('piano');
  const [volume, setVolume] = useState<number>(0.7);

  // Keep score synchronized in scorePlayer
  useEffect(() => {
    scorePlayer.setScore(score);
  }, [score]);

  // Subscribe to playback changes
  useEffect(() => {
    const unsubscribe = scorePlayer.subscribe(state => {
      setPlaybackState(state);
    });
    return () => {
      unsubscribe();
      scorePlayer.stop();
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (playbackState.isPlaying) {
      scorePlayer.pause();
    } else {
      scorePlayer.play(playbackState.currentMeasureIndex, Math.max(0, playbackState.currentItemIndex));
    }
  }, [playbackState]);

  const stop = useCallback(() => {
    scorePlayer.stop();
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping(prev => {
      const next = !prev;
      scorePlayer.setLoop(next);
      return next;
    });
  }, []);

  const toggleMetronome = useCallback(() => {
    setMetronomeEnabled(prev => {
      const next = !prev;
      scorePlayer.setMetronome(next);
      return next;
    });
  }, []);

  const handleSetInstrument = useCallback((inst: InstrumentType) => {
    setInstrument(inst);
    audioEngine.instrument = inst;
  }, []);

  const handleSetVolume = useCallback((vol: number) => {
    setVolume(vol);
    audioEngine.setVolume(vol);
  }, []);

  return {
    playbackState,
    isLooping,
    metronomeEnabled,
    instrument,
    volume,
    togglePlay,
    stop,
    toggleLoop,
    toggleMetronome,
    setInstrument: handleSetInstrument,
    setVolume: handleSetVolume,
  };
}
