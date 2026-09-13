import { useState, useRef, useCallback, useEffect } from 'react';
import { detectPitchFromBuffer, PitchDetectionResult } from '../utils/pitchDetection';

interface UseMicPitchOptions {
  onPitchDetected?: (result: PitchDetectionResult) => void;
  minVolumeRms?: number;
}

export function useMicPitch(options: UseMicPitchOptions = {}) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pitchResult, setPitchResult] = useState<PitchDetectionResult | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const callbackRef = useRef(options.onPitchDetected);
  callbackRef.current = options.onPitchDetected;

  const minVolumeRms = options.minVolumeRms ?? 0.015;

  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setIsListening(false);
    setPitchResult(null);
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) return;
    setError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta captura de micrófono.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });

      mediaStreamRef.current = stream;
      setHasPermission(true);

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);

      const buffer = new Float32Array(analyser.fftSize);

      let lastMidiSent = -1;
      let lastMidiTime = 0;

      const loop = () => {
        if (!analyserRef.current || !audioContextRef.current) return;

        analyserRef.current.getFloatTimeDomainData(buffer);
        const result = detectPitchFromBuffer(buffer, audioContextRef.current.sampleRate, minVolumeRms);

        if (result) {
          setPitchResult(result);

          // Throttle / debounce duplicate notes for practice mode
          const now = Date.now();
          if (result.midi !== lastMidiSent || now - lastMidiTime > 300) {
            lastMidiSent = result.midi;
            lastMidiTime = now;
            if (callbackRef.current) {
              callbackRef.current(result);
            }
          }
        } else {
          setPitchResult(null);
        }

        animationFrameRef.current = requestAnimationFrame(loop);
      };

      animationFrameRef.current = requestAnimationFrame(loop);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'No se pudo acceder al micrófono.';
      setError(errMsg);
      setIsListening(false);
    }
  }, [isListening, minVolumeRms]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    hasPermission,
    error,
    pitchResult,
    startListening,
    stopListening,
  };
}
