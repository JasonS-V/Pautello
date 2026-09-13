import React, { useState } from 'react';
import {
  X,
  Sliders,
  Volume2,
  VolumeX,
  Clock,
  Music,
  Sparkles,
} from 'lucide-react';
import { InstrumentType, audioEngine } from '../../audio/synth';

interface MixerModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrument: InstrumentType;
  onSetInstrument: (inst: InstrumentType) => void;
  volume: number;
  onSetVolume: (vol: number) => void;
  tempo: number;
  onSetTempo: (tempo: number) => void;
  metronomeEnabled: boolean;
  onToggleMetronome: () => void;
}

export const MixerModal: React.FC<MixerModalProps> = ({
  isOpen,
  onClose,
  instrument,
  onSetInstrument,
  volume,
  onSetVolume,
  tempo,
  onSetTempo,
  metronomeEnabled,
  onToggleMetronome,
}) => {
  const [previousVolume, setPreviousVolume] = useState<number>(volume || 0.7);

  if (!isOpen) return null;

  const instruments: { id: InstrumentType; name: string; desc: string; icon: string }[] = [
    {
      id: 'piano',
      name: 'Piano Acústico',
      desc: 'Sonido armónico rico con respuesta percusiva natural',
      icon: '🎹',
    },
    {
      id: 'marimba',
      name: 'Marimba Orquestal',
      desc: 'Ataque nítido de madera con resonancia cálida',
      icon: '🪵',
    },
    {
      id: 'strings',
      name: 'Cuerdas (Strings)',
      desc: 'Ensemble orquestal suave con sustain expresivo',
      icon: '🎻',
    },
    {
      id: 'flute',
      name: 'Flauta / Viento',
      desc: 'Timbre puro y dulce ideal para melodías líricas',
      icon: '🪈',
    },
  ];

  const tempoPresets = [
    { label: 'Largo', bpm: 60 },
    { label: 'Andante', bpm: 80 },
    { label: 'Moderato', bpm: 108 },
    { label: 'Allegro', bpm: 132 },
    { label: 'Presto', bpm: 168 },
  ];

  const handleTestSound = () => {
    // Play an ascending arpeggio C4 - E4 - G4 - C5
    const notes = [60, 64, 67, 72];
    notes.forEach((m, idx) => {
      setTimeout(() => {
        audioEngine.playMidi(m, 0.45, 0.85);
      }, idx * 160);
    });
  };

  const handleToggleMute = () => {
    if (volume > 0) {
      setPreviousVolume(volume);
      onSetVolume(0);
    } else {
      onSetVolume(previousVolume || 0.7);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none animate-fadeIn no-print"
    >
      <div className="bg-white dark:bg-[#161922] text-slate-900 dark:text-slate-100 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-[#232836] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#232836] mb-5">
          <div className="flex items-center gap-2.5 font-bold text-base">
            <div className="w-8 h-8 rounded-xl bg-[#c4b5fd]/30 flex items-center justify-center text-[#8b5cf6]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <span className="block leading-none">Sintetizador & Mezclador</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Web Audio API 44.1 kHz Polifónico
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
          {/* Section 1: Instruments Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Timbre del Instrumento
              </label>
              <button
                onClick={handleTestSound}
                className="text-[11px] font-bold text-[#f59e0b] hover:text-[#d97706] flex items-center gap-1 transition-colors"
                title="Reproducir arpegio de prueba"
              >
                <Sparkles className="w-3 h-3" />
                <span>Probar Sonido</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {instruments.map((inst) => (
                <div
                  key={inst.id}
                  onClick={() => {
                    onSetInstrument(inst.id);
                    audioEngine.instrument = inst.id;
                    audioEngine.playMidi(60, 0.4);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all duration-150 flex items-start gap-2.5 ${
                    instrument === inst.id
                      ? 'bg-purple-50 dark:bg-[#201d32] border-[#8b5cf6] ring-1 ring-[#8b5cf6]'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#1a1d29] dark:hover:bg-[#202534] border-slate-200 dark:border-[#282d40]'
                  }`}
                >
                  <span className="text-xl leading-none">{inst.icon}</span>
                  <div>
                    <span className="font-bold text-xs block text-slate-900 dark:text-white">
                      {inst.name}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                      {inst.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Master Volume */}
          <div className="bg-slate-50 dark:bg-[#1a1d29] p-4 rounded-xl border border-slate-200 dark:border-[#282d40]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleMute}
                  className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                  title={volume > 0 ? 'Silenciar' : 'Reactivar sonido'}
                >
                  {volume > 0 ? (
                    <Volume2 className="w-4 h-4 text-[#f59e0b]" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-red-500" />
                  )}
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Volumen Maestro
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                {Math.round(volume * 100)}%
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onSetVolume(parseFloat(e.target.value))}
              className="w-full accent-[#f59e0b] cursor-pointer h-1.5 bg-slate-200 dark:bg-[#2c3246] rounded-lg appearance-none"
            />
          </div>

          {/* Section 3: Tempo & BPM Presets */}
          <div className="bg-slate-50 dark:bg-[#1a1d29] p-4 rounded-xl border border-slate-200 dark:border-[#282d40]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#bef264] dark:text-[#bef264]" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Velocidad / Tempo
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                <input
                  type="number"
                  min={30}
                  max={300}
                  value={tempo}
                  onChange={(e) => onSetTempo(parseInt(e.target.value, 10) || 120)}
                  className="w-14 text-center bg-white dark:bg-[#111319] border border-slate-300 dark:border-[#2a3042] rounded-lg px-1 py-0.5 text-xs font-bold outline-none focus:border-[#f59e0b]"
                />
                <span className="text-slate-500 font-sans font-normal text-[11px]">BPM</span>
              </div>
            </div>

            <input
              type="range"
              min={30}
              max={300}
              step={1}
              value={tempo}
              onChange={(e) => onSetTempo(parseInt(e.target.value, 10) || 120)}
              className="w-full accent-[#bef264] cursor-pointer h-1.5 bg-slate-200 dark:bg-[#2c3246] rounded-lg appearance-none mb-3"
            />

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {tempoPresets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => onSetTempo(p.bpm)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                    tempo === p.bpm
                      ? 'bg-[#bef264] text-lime-950 shadow-xs'
                      : 'bg-white hover:bg-slate-200 dark:bg-[#161922] dark:hover:bg-[#242938] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#282d40]'
                  }`}
                >
                  {p.label} ({p.bpm})
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Metronome */}
          <div className="bg-slate-50 dark:bg-[#1a1d29] p-4 rounded-xl border border-slate-200 dark:border-[#282d40] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⏱️</span>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block leading-tight">
                  Metrónomo Rítmico
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Acentúa el primer tiempo de cada compás durante la reproducción
                </span>
              </div>
            </div>

            <button
              onClick={onToggleMetronome}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                metronomeEnabled
                  ? 'bg-[#bef264] text-lime-950 shadow-xs ring-2 ring-lime-400/40'
                  : 'bg-slate-200 dark:bg-[#282d40] text-slate-600 dark:text-slate-300'
              }`}
            >
              {metronomeEnabled ? 'Activado' : 'Desactivado'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-[#232836] flex items-center justify-between">
          <button
            onClick={handleTestSound}
            className="flex items-center gap-1 text-xs font-bold text-[#f59e0b] hover:text-[#d97706]"
          >
            <Music className="w-3.5 h-3.5" />
            <span>Escuchar escala de prueba</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold transition-colors shadow-xs"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
