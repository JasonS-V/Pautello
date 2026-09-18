import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Cable, Piano, Keyboard } from '../ui/icons';
import { Pitch, Step, Accidental, NamingConvention, KeyboardInputMode } from '../../types/music';
import { LATIN_STEP_NAMES, pitchToMidi } from '../../constants/pitches';
import { getKeycapLabelForPitch } from '../../constants/keyboardLayout';
import { audioEngine } from '../../audio/synth';
import { useTimeout } from '../../hooks/useTimeout';

interface PianoKey {
  step: Step;
  octave: number;
  accidental: Accidental;
  isBlack: boolean;
  midi: number;
}

interface VirtualPianoProps {
  onNoteClick: (pitch: Pitch) => void;
  namingConvention: NamingConvention;
  activePlaybackMidi?: number | null;
  activeMidiPitch?: number | null;
  isMidiConnected?: boolean;
  connectedDevices?: string[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  keyboardMode?: KeyboardInputMode;
  onToggleKeyboardMode?: () => void;
  pianoBaseOctave?: number;
  onShiftOctave?: (delta: number) => void;
  onSelectOctave?: (octave: number) => void;
  isOctaveLockEnabled?: boolean;
  onToggleOctaveLock?: () => void;
}

const OCTAVE_STRUCTURE: { step: Step; accidental: Accidental; isBlack: boolean }[] = [
  { step: 'C', accidental: null, isBlack: false },
  { step: 'C', accidental: '#', isBlack: true },
  { step: 'D', accidental: null, isBlack: false },
  { step: 'D', accidental: '#', isBlack: true },
  { step: 'E', accidental: null, isBlack: false },
  { step: 'F', accidental: null, isBlack: false },
  { step: 'F', accidental: '#', isBlack: true },
  { step: 'G', accidental: null, isBlack: false },
  { step: 'G', accidental: '#', isBlack: true },
  { step: 'A', accidental: null, isBlack: false },
  { step: 'A', accidental: '#', isBlack: true },
  { step: 'B', accidental: null, isBlack: false },
];

/**
 * Teclado de entrada con selector de 8 octavas navegable con pestañas y atajos Z/X.
 * Las teclas se desplazan dinámicamente según la octava seleccionada.
 *
 * Los colores de resalte distinguen el origen del sonido: ambar cuando lo toca
 * la reproduccion, esmeralda cuando viene de un dispositivo MIDI y azul cuando
 * lo pulsa el usuario (mismo codigo de color en los auriculares del mixer).
 */
export const VirtualPiano: React.FC<VirtualPianoProps> = ({
  onNoteClick,
  namingConvention,
  activePlaybackMidi,
  activeMidiPitch,
  isMidiConnected,
  connectedDevices,
  collapsed,
  onToggleCollapse,
  keyboardMode = 'piano',
  onToggleKeyboardMode,
  pianoBaseOctave = 4,
  onShiftOctave,
  onSelectOctave,
  isOctaveLockEnabled = true,
  onToggleOctaveLock,
}) => {
  const [activePressedMidi, setActivePressedMidi] = useState<number | null>(null);
  const [focusedMidi, setFocusedMidi] = useState<number | null>(null);
  const keyFlash = useTimeout();
  const keyRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const keys = useMemo<PianoKey[]>(() => {
    const list: PianoKey[] = [];
    const startOctave = Math.max(1, Math.min(8, pianoBaseOctave));
    const endOctave = Math.min(8, startOctave + 1);

    for (let octave = startOctave; octave <= endOctave; octave++) {
      OCTAVE_STRUCTURE.forEach((item) => {
        const pitch: Pitch = { step: item.step, octave, accidental: item.accidental };
        list.push({ ...item, octave, midi: pitchToMidi(pitch) });
      });
    }

    // Rematar con la tecla Do de la octava superior para cerrar la escala
    const finalOctave = endOctave + 1;
    const finalPitch: Pitch = { step: 'C', octave: finalOctave, accidental: null };
    list.push({
      step: 'C',
      octave: finalOctave,
      accidental: null,
      isBlack: false,
      midi: pitchToMidi(finalPitch),
    });

    return list;
  }, [pianoBaseOctave]);

  const whiteKeys = useMemo(() => keys.filter((key) => !key.isBlack), [keys]);

  const handleKeyTrigger = useCallback(
    (key: PianoKey) => {
      setActivePressedMidi(key.midi);
      audioEngine.playMidi(key.midi, 0.4, 0.85);
      onNoteClick({ step: key.step, octave: key.octave, accidental: key.accidental });
      keyFlash.schedule(() => setActivePressedMidi(null), 250);
    },
    [onNoteClick, keyFlash]
  );

  const getKeyLabel = (key: PianoKey) => {
    const base = namingConvention === 'latin' ? LATIN_STEP_NAMES[key.step] : key.step;
    return key.accidental ? `${base}♯${key.octave}` : `${base}${key.octave}`;
  };

  /** Mueve el foco entre teclas blancas y devuelve la tecla destino. */
  const moveFocus = (fromMidi: number, direction: -1 | 1) => {
    const index = whiteKeys.findIndex((key) => key.midi === fromMidi);
    const nextIndex = Math.max(0, Math.min(whiteKeys.length - 1, index + direction));
    const next = whiteKeys[nextIndex];
    if (!next) return;
    setFocusedMidi(next.midi);
    keyRefs.current.get(next.midi)?.focus();
  };

  /** Flechas = navegar, Inicio/Fin = extremos, Intro/Espacio = tocar. */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>, key: PianoKey) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveFocus(key.midi, 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveFocus(key.midi, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = whiteKeys[0];
      if (first) {
        setFocusedMidi(first.midi);
        keyRefs.current.get(first.midi)?.focus();
      }
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = whiteKeys[whiteKeys.length - 1];
      if (last) {
        setFocusedMidi(last.midi);
        keyRefs.current.get(last.midi)?.focus();
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleKeyTrigger(key);
    }
  };

  const rovingTabIndex = focusedMidi ?? whiteKeys[Math.floor(whiteKeys.length / 2)]?.midi ?? null;

  return (
    <div
      id="piano-container"
      className="border-t border-slate-200 bg-slate-50 select-none dark:border-studio-border dark:bg-studio-surface"
    >
      {/* Header bar — always visible */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-xs dark:border-studio-border dark:bg-studio-card">
        <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
          <Piano className="w-4 h-4 text-amber-500" aria-hidden="true" />
          <span>
            {collapsed ? 'Piano y entrada MIDI' : 'Teclado de Solfeo y Entrada Rápida (C3 - B5)'}
          </span>
          {!collapsed && isMidiConnected ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <Cable className="w-3 h-3" aria-hidden="true" />
              MIDI: {connectedDevices?.[0] || 'Conectado'}
            </span>
          ) : !collapsed ? (
            <span className="hidden text-[11px] font-normal text-slate-500 md:inline dark:text-slate-400">
              (Clic o flechas + Intro)
            </span>
          ) : null}

          {/* Mode Switcher: Piano QWERTY vs Notación Clásica */}
          {!collapsed && onToggleKeyboardMode && (
            <button
              type="button"
              onClick={onToggleKeyboardMode}
              title={
                keyboardMode === 'piano'
                  ? 'Modo activo: Piano QWERTY (A=Do, W=Do#...). Clic para cambiar a Cifrado A-G'
                  : 'Modo activo: Cifrado A-G. Clic para cambiar a Piano QWERTY'
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                keyboardMode === 'piano'
                  ? 'bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-xs'
                  : 'bg-slate-200/80 dark:bg-studio-surface border border-slate-300 dark:border-studio-line text-slate-700 dark:text-slate-300'
              }`}
            >
              <Keyboard className="w-3 h-3 text-amber-500" aria-hidden="true" />
              <span>{keyboardMode === 'piano' ? 'Piano QWERTY' : 'Cifrado A-G'}</span>
            </button>
          )}

          {/* Octave Selector (Tabs 1 to 8, Z/X shortcuts & Staff guide toggle) */}
          {!collapsed && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                Octava:
              </span>
              <div
                role="tablist"
                aria-label="Selector de octava"
                className="inline-flex items-center rounded-lg border border-slate-300 dark:border-studio-line bg-white/90 dark:bg-studio-surface/90 p-0.5 shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => onShiftOctave?.(-1)}
                  disabled={pianoBaseOctave <= 1}
                  title="Bajar octava (Tecla Z)"
                  aria-label="Bajar una octava (Tecla Z)"
                  className="px-1.5 py-0.5 text-[9px] font-extrabold rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-studio-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  ◄ Z
                </button>

                <div className="flex items-center gap-0.5 mx-0.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((oct) => {
                    const isActive = pianoBaseOctave === oct;
                    return (
                      <button
                        key={oct}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onSelectOctave?.(oct)}
                        title={`Octava ${oct} (Do${oct} a Si${oct})`}
                        className={`min-w-[19px] h-4.5 px-1 rounded text-[9.5px] font-extrabold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-400'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-studio-hover hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {oct}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => onShiftOctave?.(1)}
                  disabled={pianoBaseOctave >= 8}
                  title="Subir octava (Tecla X)"
                  aria-label="Subir una octava (Tecla X)"
                  className="px-1.5 py-0.5 text-[9px] font-extrabold rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-studio-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  X ►
                </button>
              </div>

              {/* Toggle de restricción / guía en partitura */}
              {onToggleOctaveLock && (
                <button
                  type="button"
                  onClick={onToggleOctaveLock}
                  title={
                    isOctaveLockEnabled
                      ? `Guía activa: el ratón en la partitura solo coloca notas de la Octava ${pianoBaseOctave}. Clic para permitir todas las octavas.`
                      : 'Modo libre: el ratón coloca cualquier nota sin filtrar por octava. Clic para restringir a la octava activa.'
                  }
                  className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold border transition-all cursor-pointer ${
                    isOctaveLockEnabled
                      ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-xs'
                      : 'bg-transparent border-slate-300 dark:border-studio-line text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOctaveLockEnabled ? 'bg-amber-500' : 'bg-slate-400'
                    }`}
                  />
                  <span>{isOctaveLockEnabled ? `Guía Oct ${pianoBaseOctave}` : 'Libre'}</span>
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-all duration-150 hover:bg-slate-200/60 hover:text-slate-700 active:scale-95 dark:text-slate-400 dark:hover:bg-studio-hover dark:hover:text-slate-200"
        >
          {collapsed ? (
            <ChevronUp className="w-3 h-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3 h-3" aria-hidden="true" />
          )}
          {collapsed ? 'Mostrar Teclado' : 'Ocultar'}
        </button>
      </div>

      {/* Collapsible piano body with smooth animation */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          collapsed ? 'max-h-0 opacity-0' : 'max-h-[200px] opacity-100'
        }`}
      >
        <div className="flex justify-center overflow-x-auto px-3 py-2">
          {/* Las dimensiones viven en variables CSS: el ancho de tecla blanca
              (--pk-w) y negra (--pbk-w) son fuente única, así el offset de las
              negras se deriva de los mismos valores y nunca se desalinean. */}
          <div
            role="group"
            aria-label="Teclado de piano interactivo"
            className="relative inline-flex h-[clamp(5.5rem,12vh,7rem)] rounded-md bg-black/10 p-1 dark:bg-black/30"
            style={{ '--pk-w': '2.25rem', '--pbk-w': '1.25rem' } as React.CSSProperties}
          >
            {whiteKeys.map((whiteKey) => {
              const isPlaying = activePlaybackMidi === whiteKey.midi;
              const isMidiActive = activeMidiPitch === whiteKey.midi;
              const isPressed = activePressedMidi === whiteKey.midi;
              const isMiddleC = whiteKey.step === 'C' && whiteKey.octave === 4;
              const keycap =
                keyboardMode === 'piano'
                  ? getKeycapLabelForPitch(
                      whiteKey.step,
                      whiteKey.octave,
                      whiteKey.accidental,
                      pianoBaseOctave
                    )
                  : null;

              return (
                <button
                  type="button"
                  key={`white-${whiteKey.midi}`}
                  ref={(element) => {
                    if (element) keyRefs.current.set(whiteKey.midi, element);
                    else keyRefs.current.delete(whiteKey.midi);
                  }}
                  tabIndex={whiteKey.midi === rovingTabIndex ? 0 : -1}
                  onClick={() => handleKeyTrigger(whiteKey)}
                  onFocus={() => setFocusedMidi(whiteKey.midi)}
                  onKeyDown={(event) => handleKeyDown(event, whiteKey)}
                  aria-label={`Tecla ${getKeyLabel(whiteKey)}${keycap ? ` (Atajo: ${keycap})` : ''}`}
                  aria-pressed={isPlaying || isMidiActive || isPressed}
                  className={`relative flex h-full w-[var(--pk-w)] shrink-0 cursor-pointer flex-col items-center justify-end rounded-b-md border border-slate-300 pb-2 shadow-studio-key transition-all duration-75 select-none active:translate-y-1 active:brightness-95 dark:border-slate-600
                    ${
                      isMidiActive
                        ? '!bg-emerald-400 !text-emerald-950 font-bold ring-2 ring-emerald-400/70 shadow-md translate-y-0.5 dark:!bg-emerald-500'
                        : ''
                    }
                    ${
                      isPlaying && !isMidiActive
                        ? '!bg-amber-400 !text-amber-950 font-bold ring-2 ring-amber-400/70 shadow-md translate-y-0.5 dark:!bg-amber-500'
                        : ''
                    }
                    ${
                      isPressed && !isMidiActive && !isPlaying
                        ? '!bg-blue-300 !text-blue-950 translate-y-1 shadow-inner dark:!bg-blue-500 dark:!text-white'
                        : ''
                    }
                    ${
                      !isPlaying && !isPressed && !isMidiActive
                        ? 'bg-white text-slate-600 hover:bg-slate-50 hover:shadow-studio-card dark:bg-slate-100 dark:text-slate-700 dark:hover:bg-white'
                        : ''
                    }
                  `}
                >
                  {keycap && (
                    <span
                      className="mb-1 inline-flex items-center justify-center rounded px-1 min-w-[15px] h-3.5 text-[9px] font-black bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 shadow-xs leading-none"
                      title={`Tecla física: ${keycap}`}
                    >
                      {keycap}
                    </span>
                  )}
                  {isMiddleC && !keycap && (
                    <span
                      className="mb-1 h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-amber-500/25"
                      title="Do Central (C4)"
                      aria-hidden="true"
                    />
                  )}
                  <span className="pointer-events-none text-[10px] tracking-tighter select-none">
                    {getKeyLabel(whiteKey)}
                  </span>
                </button>
              );
            })}

            {/* Black Keys overlaid absolute */}
            <div className="pointer-events-none absolute inset-0 flex p-1">
              {keys.map((key, index) => {
                if (!key.isBlack) return null;

                // Calculate left offset based on white key index
                const whiteKeysBefore = keys.slice(0, index).filter((item) => !item.isBlack).length;
                const isPlaying = activePlaybackMidi === key.midi;
                const isMidiActive = activeMidiPitch === key.midi;
                const isPressed = activePressedMidi === key.midi;
                const keycap =
                  keyboardMode === 'piano'
                    ? getKeycapLabelForPitch(key.step, key.octave, key.accidental, pianoBaseOctave)
                    : null;

                return (
                  <button
                    type="button"
                    key={`black-${key.midi}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleKeyTrigger(key);
                    }}
                    tabIndex={-1}
                    aria-label={`Tecla ${getKeyLabel(key)}${keycap ? ` (Atajo: ${keycap})` : ''}`}
                    aria-pressed={isPlaying || isMidiActive || isPressed}
                    style={{
                      position: 'absolute',
                      left: `calc(${whiteKeysBefore} * var(--pk-w) - var(--pbk-w) / 2 - 1px)`,
                    }}
                    className={`pointer-events-auto z-keys flex h-3/5 w-[var(--pbk-w)] cursor-pointer flex-col items-center justify-end rounded-b border border-black/60 bg-gradient-to-b from-slate-800 to-slate-950 pb-1 shadow-studio-key-black transition-all duration-75 select-none active:translate-y-1 active:brightness-125
                      ${
                        isMidiActive
                          ? '!bg-emerald-400 !text-emerald-950 font-bold ring-2 ring-emerald-400/70 translate-y-0.5 dark:!bg-emerald-500'
                          : ''
                      }
                      ${
                        isPlaying && !isMidiActive
                          ? '!bg-amber-400 !text-amber-950 font-bold ring-2 ring-amber-400/70 translate-y-0.5 dark:!bg-amber-500'
                          : ''
                      }
                      ${
                        isPressed && !isMidiActive && !isPlaying
                          ? '!bg-blue-500 !text-white translate-y-1 shadow-inner'
                          : ''
                      }
                      ${!isPlaying && !isPressed && !isMidiActive ? 'text-slate-300 hover:to-slate-900' : ''}
                    `}
                  >
                    {keycap && (
                      <span
                        className="mb-0.5 inline-flex items-center justify-center rounded px-0.5 min-w-[13px] h-3 text-[8px] font-black bg-slate-900 text-amber-300 border border-amber-400/50 shadow-xs leading-none"
                        title={`Tecla física: ${keycap}`}
                      >
                        {keycap}
                      </span>
                    )}
                    <span className="pointer-events-none text-[8px] select-none">
                      {key.accidental === '#' ? '♯' : key.accidental}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
