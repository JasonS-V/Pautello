import { useState, useRef, useEffect, useCallback } from 'react';

export function usePlayAlong() {
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRateState] = useState<number>(1.0);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [isAudioLoaded, setIsAudioLoaded] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Initialize or get the audio element
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preservesPitch = true; // Preserve musical pitch when adjusting playback speed
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const loadAudioFile = useCallback(
    (file: File) => {
      const audio = getAudio();

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      audio.src = url;
      audio.playbackRate = playbackRate;
      audio.volume = volume;

      setAudioName(file.name);
      setIsAudioLoaded(true);

      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration || 0);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime || 0);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
    },
    [getAudio, playbackRate, volume]
  );

  const removeAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setAudioName(null);
    setAudioDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setIsAudioLoaded(false);
  }, []);

  const play = useCallback(() => {
    if (!audioRef.current || !isAudioLoaded) return;
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);
  }, [isAudioLoaded]);

  const pause = useCallback(() => {
    if (!audioRef.current || !isAudioLoaded) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }, [isAudioLoaded]);

  const stop = useCallback(() => {
    if (!audioRef.current || !isAudioLoaded) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, [isAudioLoaded]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
    setCurrentTime(audioRef.current.currentTime);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return {
    audioName,
    audioDuration,
    currentTime,
    isPlaying,
    playbackRate,
    volume,
    isAudioLoaded,
    loadAudioFile,
    removeAudio,
    play,
    pause,
    stop,
    seek,
    setPlaybackRate,
    setVolume,
  };
}
