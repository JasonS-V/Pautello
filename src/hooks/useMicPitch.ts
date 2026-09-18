import { useState, useRef, useCallback, useEffect } from 'react';
import { detectPitchFromBuffer, PitchDetectionResult } from '../utils/pitchDetection';
import { OnsetDetector } from '../audio/practiceEngine';

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
  // Guarda síncrona de arranque: `isListening` es estado de React y no se
  // actualiza hasta el siguiente render, así que dos clics seguidos lo verían a
  // `false` los dos y acabarían pidiendo el micrófono dos veces.
  const isStartingRef = useRef<boolean>(false);
  // Cada stopListening invalida los arranques en vuelo (por ejemplo mientras el
  // navegador muestra el diálogo de permiso).
  const sessionIdRef = useRef<number>(0);
  const callbackRef = useRef(options.onPitchDetected);
  callbackRef.current = options.onPitchDetected;

  const minVolumeRms = options.minVolumeRms ?? 0.015;

  const stopListening = useCallback(() => {
    // Invalida cualquier arranque que siga esperando permiso: al resolver, se
    // dará cuenta de que ya no toca y liberará su stream en vez de encender el
    // micrófono a espaldas del usuario.
    sessionIdRef.current += 1;

    if (animationFrameRef.current !== null) {
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

    // Sin esto el bucle seguiría leyendo un analizador ya desconectado.
    analyserRef.current = null;

    setIsListening(false);
    setPitchResult(null);
  }, []);

  const startListening = useCallback(async (): Promise<void> => {
    // No reabrir el micrófono si ya está activo o si hay un arranque en curso.
    if (mediaStreamRef.current || isStartingRef.current) return;

    isStartingRef.current = true;
    const session = sessionIdRef.current;
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

      // Se pudo detener la escucha mientras el navegador pedía permiso.
      if (session !== sessionIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

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

      const onset = new OnsetDetector();

      const loop = () => {
        if (!analyserRef.current || !audioContextRef.current) return;

        analyserRef.current.getFloatTimeDomainData(buffer);
        const result = detectPitchFromBuffer(
          buffer,
          audioContextRef.current.sampleRate,
          minVolumeRms
        );

        // Solo se avisa del ataque de cada nota: sostenerla no genera avisos
        // repetidos (antes se contaba cada lectura como un intento nuevo).
        if (onset.update(result?.midi ?? null, Date.now()) && result) {
          callbackRef.current?.(result);
        }

        setPitchResult(result ?? null);

        animationFrameRef.current = requestAnimationFrame(loop);
      };

      animationFrameRef.current = requestAnimationFrame(loop);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'No se pudo acceder al micrófono.';
      setError(errMsg);
      setIsListening(false);
    } finally {
      // Solo lo libera el propio intento: mientras esté en true no puede
      // empezar otro, así que nunca pisa la guarda de un arranque más reciente.
      isStartingRef.current = false;
    }
  }, [minVolumeRms]);

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
