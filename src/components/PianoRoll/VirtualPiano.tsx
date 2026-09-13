import React, { useState } from 'react';
import { Pitch, Step, Accidental, NamingConvention } from '../../types/music';
import { LATIN_STEP_NAMES, pitchToMidi } from '../../constants/pitches';
import { audioEngine } from '../../audio/synth';

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
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const VirtualPiano: React.FC<VirtualPianoProps> = ({
  onNoteClick,
  namingConvention,
  activePlaybackMidi,
  collapsed,
  onToggleCollapse,
}) => {
  const [activePressedMidi, setActivePressedMidi] = useState<number | null>(null);

  // Generate 3 Octaves: C3 (48) to B5 (83)
  const keys: PianoKey[] = [];
  const startOctave = 3;
  const endOctave = 5;

  const octaveStructure: { step: Step; accidental: Accidental; isBlack: boolean }[] = [
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

  for (let oct = startOctave; oct <= endOctave; oct++) {
    octaveStructure.forEach(item => {
      const pitch: Pitch = { step: item.step, octave: oct, accidental: item.accidental };
      keys.push({
        ...item,
        octave: oct,
        midi: pitchToMidi(pitch),
      });
    });
  }

  const handleKeyTrigger = (key: PianoKey) => {
    setActivePressedMidi(key.midi);
    audioEngine.playMidi(key.midi, 0.4, 0.85);
    onNoteClick({ step: key.step, octave: key.octave, accidental: key.accidental });
    setTimeout(() => setActivePressedMidi(null), 250);
  };

  const getKeyLabel = (key: PianoKey) => {
    const base = namingConvention === 'latin' ? LATIN_STEP_NAMES[key.step] : key.step;
    if (key.accidental) {
      return `${base}♯${key.octave}`;
    }
    return `${base}${key.octave}`;
  };

  if (collapsed) {
    return (
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151c] px-4 py-1.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 select-none">
        <span className="font-medium flex items-center gap-2">
          <span>🎹</span> Teclado Interactivo (Oculto)
        </span>
        <button
          onClick={onToggleCollapse}
          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors"
        >
          Mostrar Teclado
        </button>
      </div>
    );
  }

  return (
    <div
      id="piano-container"
      className="border-t border-slate-200 dark:border-[#202433] bg-slate-50 dark:bg-[#111319] select-none transition-all shadow-inner"
    >
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-100 dark:bg-[#161922] border-b border-slate-200 dark:border-[#202433] text-xs">
        <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
          <span>🎹</span>
          <span>Teclado de Solfeo y Entrada Rápida (C3 - B5)</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
            (Haz clic para escuchar e insertar notas directamente en la partitura)
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-0.5 rounded text-[11px]"
        >
          Ocultar
        </button>
      </div>

      <div className="overflow-x-auto py-2 px-3 flex justify-center">
        <div className="relative inline-flex h-28 bg-black/10 dark:bg-black/30 p-1 rounded-md">
          {keys.filter(k => !k.isBlack).map(whiteKey => {
            const isPlaying = activePlaybackMidi === whiteKey.midi;
            const isPressed = activePressedMidi === whiteKey.midi;
            const isMiddleC = whiteKey.step === 'C' && whiteKey.octave === 4;

            return (
              <div
                key={`white-${whiteKey.midi}`}
                onClick={() => handleKeyTrigger(whiteKey)}
                className={`relative w-9 shrink-0 h-full border border-slate-300 dark:border-slate-700 rounded-b-md cursor-pointer flex flex-col justify-end items-center pb-2 transition-all select-none
                  ${isPlaying ? '!bg-amber-400 dark:!bg-amber-500 !text-slate-950 font-bold shadow-md' : ''}
                  ${isPressed ? '!bg-blue-300 dark:!bg-blue-600' : ''}
                  ${!isPlaying && !isPressed ? 'bg-white hover:bg-slate-100 dark:bg-slate-100 dark:hover:bg-slate-200 text-slate-700' : ''}
                `}
              >
                {isMiddleC && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mb-1" title="Do Central (C4)" />
                )}
                <span className="text-[10px] tracking-tighter select-none pointer-events-none">
                  {getKeyLabel(whiteKey)}
                </span>
              </div>
            );
          })}

          {/* Black Keys overlaid absolute */}
          <div className="absolute inset-0 pointer-events-none flex p-1">
            {keys.map((k, idx) => {
              if (!k.isBlack) return null;

              // Calculate left offset based on white key index
              const whiteKeysBefore = keys.slice(0, idx).filter(item => !item.isBlack).length;
              // Center black key between whiteKeysBefore - 1 and whiteKeysBefore
              // Each white key is around 36px in sm
              const isPlaying = activePlaybackMidi === k.midi;
              const isPressed = activePressedMidi === k.midi;

              return (
                <div
                  key={`black-${k.midi}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleKeyTrigger(k);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${whiteKeysBefore * 36 - 11}px`,
                  }}
                  className={`pointer-events-auto w-5 h-16 rounded-b border border-black/50 cursor-pointer flex flex-col justify-end items-center pb-1 z-10 transition-all select-none
                    ${isPlaying ? '!bg-amber-400 dark:!bg-amber-500 !text-slate-950 font-bold shadow-lg' : ''}
                    ${isPressed ? '!bg-blue-500' : ''}
                    ${!isPlaying && !isPressed ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 shadow-md' : ''}
                  `}
                >
                  <span className="text-[8px] text-slate-300 select-none pointer-events-none">
                    {k.accidental}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
