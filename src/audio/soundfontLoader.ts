/**
 * Cargador de soundfonts acústicos de alta definición (FluidR3_GM) para Pautello.
 *
 * Descarga bajo demanda grabaciones de audio reales de los instrumentos universales:
 * - Piano: acoustic_grand_piano (Piano de cola Steinway)
 * - Melodía: flute (Flauta lírica / viento)
 * - Bajo: acoustic_bass (Contrabajo y bajo acústico)
 * - Armonía: string_ensemble_1 (Orquesta de cuerdas: violines, violas y cellos)
 *
 * Cuenta con caché en memoria, decodificación nativa con AudioContext y pitch-shift
 * automático. Si una muestra aún no ha descargado o el usuario está sin conexión,
 * el motor de audio delega inmediatamente en la síntesis algorítmica sin retrasos.
 */

export type UniversalInstrument = 'piano' | 'melody' | 'bass' | 'harmony';

export const SOUNDFONT_NAME_MAP: Record<string, string> = {
  piano: 'acoustic_grand_piano',
  melody: 'flute',
  bass: 'acoustic_bass',
  harmony: 'string_ensemble_1',
  // Compatibilidad hacia atrás con proyectos guardados
  flute: 'flute',
  strings: 'string_ensemble_1',
  marimba: 'marimba',
};

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-Ga-g][b#]?)(-?\d+)$/);
  if (!match) return 60;
  const rawNote = match[1];
  const formattedNote = rawNote.charAt(0).toUpperCase() + rawNote.slice(1).toLowerCase();
  const octave = parseInt(match[2], 10);
  const noteMap: Record<string, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11,
  };
  return (octave + 1) * 12 + (noteMap[formattedNote] ?? 0);
}

function base64ToArrayBuffer(base64Uri: string): ArrayBuffer {
  const base64 = base64Uri.replace(/^data:audio\/(?:mp3|ogg|wav);base64,/, '');
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  return new ArrayBuffer(0);
}

class SoundfontManager {
  private rawSampleMap = new Map<string, Map<number, string>>();
  private audioBufferCache = new Map<string, Map<number, AudioBuffer>>();
  private loadingPromises = new Map<string, Promise<boolean>>();
  private loadedInstruments = new Set<string>();

  public isInstrumentLoaded(instrument: string): boolean {
    const sfName = SOUNDFONT_NAME_MAP[instrument] || instrument;
    return this.loadedInstruments.has(sfName);
  }

  public async preloadInstrument(
    instrument: string,
    audioCtx?: AudioContext | null
  ): Promise<boolean> {
    const sfName = SOUNDFONT_NAME_MAP[instrument] || instrument;
    if (this.loadedInstruments.has(sfName)) return true;
    if (this.loadingPromises.has(sfName)) {
      return this.loadingPromises.get(sfName)!;
    }

    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
      return false;
    }

    const loadPromise = (async () => {
      try {
        const cdnUrl = `https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/${sfName}-mp3.js`;
        const fallbackUrl = `https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM/${sfName}-mp3.js`;

        let response: Response | null = null;
        try {
          response = await fetch(cdnUrl);
        } catch {
          // Intentar fallback si falla el CDN primario
          try {
            response = await fetch(fallbackUrl);
          } catch {
            return false;
          }
        }

        if (!response || !response.ok) return false;

        const scriptText = await response.text();
        const match = scriptText.match(/MIDI\.Soundfont\.\w+\s*=\s*([\s\S]*);?\s*$/);
        if (!match) return false;

        // Evaluar el objeto de datos que contiene { "A0": "data:audio/mp3...", ... }
        const fn = new Function('return ' + match[1]);
        const noteMap = fn() as Record<string, string>;
        const rawMidiMap = new Map<number, string>();

        for (const [noteName, dataUri] of Object.entries(noteMap)) {
          const midi = noteNameToMidi(noteName);
          rawMidiMap.set(midi, dataUri);
        }

        this.rawSampleMap.set(sfName, rawMidiMap);
        this.loadedInstruments.add(sfName);

        // Si tenemos un AudioContext disponible, predecodificar las notas centrales (C3-C6: 48-84)
        if (audioCtx) {
          this.warmupCenterOctaves(sfName, audioCtx, rawMidiMap);
        }

        return true;
      } catch (err) {
        console.warn(`[Soundfont] No se pudo cargar el timbre real de ${sfName}:`, err);
        return false;
      } finally {
        this.loadingPromises.delete(sfName);
      }
    })();

    this.loadingPromises.set(sfName, loadPromise);
    return loadPromise;
  }

  private async warmupCenterOctaves(
    sfName: string,
    audioCtx: AudioContext,
    rawMidiMap: Map<number, string>
  ) {
    if (!this.audioBufferCache.has(sfName)) {
      this.audioBufferCache.set(sfName, new Map());
    }
    const cache = this.audioBufferCache.get(sfName)!;
    // Decodificar un subconjunto clave de notas centrales en segundo plano
    const centerNotes = [48, 52, 55, 60, 64, 67, 72, 76, 79, 84];
    for (const midi of centerNotes) {
      if (!cache.has(midi) && rawMidiMap.has(midi)) {
        try {
          const arrBuf = base64ToArrayBuffer(rawMidiMap.get(midi)!);
          const audioBuf = await audioCtx.decodeAudioData(arrBuf.slice(0));
          cache.set(midi, audioBuf);
        } catch {
          // Ignorar fallo de precarga individual
        }
      }
    }
  }

  public async getAudioBuffer(
    sfName: string,
    midi: number,
    audioCtx: AudioContext
  ): Promise<{ buffer: AudioBuffer; playbackRate: number } | null> {
    const rawMap = this.rawSampleMap.get(sfName);
    if (!rawMap || rawMap.size === 0) return null;

    if (!this.audioBufferCache.has(sfName)) {
      this.audioBufferCache.set(sfName, new Map());
    }
    const cache = this.audioBufferCache.get(sfName)!;

    // 1. Si la nota exacta ya está decodificada en memoria
    if (cache.has(midi)) {
      return { buffer: cache.get(midi)!, playbackRate: 1.0 };
    }

    // 2. Si la nota exacta está disponible en el soundfont crudo, decodificarla
    if (rawMap.has(midi)) {
      try {
        const arrBuf = base64ToArrayBuffer(rawMap.get(midi)!);
        const audioBuf = await audioCtx.decodeAudioData(arrBuf.slice(0));
        cache.set(midi, audioBuf);
        return { buffer: audioBuf, playbackRate: 1.0 };
      } catch (err) {
        console.warn(`[Soundfont] Error decodificando muestra MIDI ${midi}:`, err);
      }
    }

    // 3. Pitch-shift desde la nota más cercana disponible en el soundfont
    let closestMidi = -1;
    let minDiff = Infinity;
    for (const m of rawMap.keys()) {
      const diff = Math.abs(m - midi);
      if (diff < minDiff) {
        minDiff = diff;
        closestMidi = m;
      }
    }

    if (closestMidi !== -1) {
      let baseBuffer = cache.get(closestMidi);
      if (!baseBuffer && rawMap.has(closestMidi)) {
        try {
          const arrBuf = base64ToArrayBuffer(rawMap.get(closestMidi)!);
          baseBuffer = await audioCtx.decodeAudioData(arrBuf.slice(0));
          cache.set(closestMidi, baseBuffer);
        } catch {
          baseBuffer = undefined;
        }
      }

      if (baseBuffer) {
        const playbackRate = Math.pow(2, (midi - closestMidi) / 12);
        return { buffer: baseBuffer, playbackRate };
      }
    }

    return null;
  }

  public playSample(
    audioCtx: AudioContext,
    destination: AudioNode,
    instrument: string,
    midi: number,
    durationSeconds: number,
    velocity: number = 0.8,
    startTime?: number
  ): { stop: () => void } | null {
    const sfName = SOUNDFONT_NAME_MAP[instrument] || instrument;
    const cache = this.audioBufferCache.get(sfName);

    // Intento sincrónico rápido si ya está en caché
    let buffer: AudioBuffer | undefined = cache?.get(midi);
    let playbackRate = 1.0;

    if (!buffer && cache && cache.size > 0) {
      let closestMidi = -1;
      let minDiff = Infinity;
      for (const m of cache.keys()) {
        const diff = Math.abs(m - midi);
        if (diff < minDiff) {
          minDiff = diff;
          closestMidi = m;
        }
      }
      if (closestMidi !== -1 && minDiff <= 6) {
        buffer = cache.get(closestMidi);
        playbackRate = Math.pow(2, (midi - closestMidi) / 12);
      }
    }

    // Si no está listo sincrónicamente, disparar decodificación asíncrona para la próxima vez
    if (!buffer) {
      this.getAudioBuffer(sfName, midi, audioCtx).catch(() => {});
      return null;
    }

    try {
      const now =
        startTime !== undefined ? Math.max(audioCtx.currentTime, startTime) : audioCtx.currentTime;
      const duration = Math.max(0.08, durationSeconds);
      const vel = Math.max(0.1, Math.min(1.0, velocity));

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.setValueAtTime(playbackRate, now);

      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.0001, now);
      // Ataque percusivo o suave según instrumento
      const attackTime = sfName.includes('string') ? 0.04 : 0.004;
      gainNode.gain.exponentialRampToValueAtTime(vel * 0.95, now + attackTime);
      gainNode.gain.setValueAtTime(vel * 0.85, now + duration * 0.8);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.25);

      source.connect(gainNode);
      gainNode.connect(destination);

      source.start(now);
      const stopTime = now + duration + 0.3;
      source.stop(stopTime);

      return {
        stop: () => {
          try {
            gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
            setTimeout(() => {
              try {
                source.disconnect();
                gainNode.disconnect();
              } catch {
                // ignorar
              }
            }, 50);
          } catch {
            // ignorar
          }
        },
      };
    } catch {
      return null;
    }
  }
}

export const soundfontManager = new SoundfontManager();
