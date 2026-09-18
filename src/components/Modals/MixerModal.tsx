import React, { useState } from 'react';
import {
  Sliders,
  Volume2,
  VolumeX,
  Clock,
  Music2,
  Piano,
  Wind,
  AudioWaveform,
  Layers,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from '../ui/icons';
import { InstrumentType, audioEngine, StaffChannelState } from '../../audio/synth';
import { Score } from '../../types/music';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader, ModalFooter } from '../ui/ModalChrome';
import { modalButton } from '../ui/modalButton';
import { useToast } from '../ui/toastContext';

/**
 * Sondea si el navegador sigue bloqueando el audio (contexto suspendido). Se
 * crea un AudioContext desechable porque el motor de audio no expone el estado
 * del suyo; se cierra de inmediato para no dejar recursos colgando.
 */
function isAudioBlocked(): boolean {
  if (typeof window === 'undefined') return true;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return true;
  try {
    const probe = new AudioCtx();
    const blocked = probe.state === 'suspended';
    void probe.close();
    return blocked;
  } catch {
    return true;
  }
}

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
  chordCompingEnabled?: boolean;
  onToggleChordComping?: () => void;
  chordCompingVolume?: number;
  onSetChordCompingVolume?: (vol: number) => void;
  score?: Score;
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
  chordCompingEnabled = false,
  onToggleChordComping,
  chordCompingVolume = 0.65,
  onSetChordCompingVolume,
  score,
}) => {
  const toast = useToast();
  const [previousVolume, setPreviousVolume] = useState<number>(volume || 0.7);
  const [channels, setChannels] = useState<Record<number, StaffChannelState>>(() =>
    audioEngine.getStaffChannels()
  );
  const [activeTab, setActiveTab] = useState<'tracks' | 'master'>('tracks');

  if (!isOpen) return null;

  const instruments: {
    id: InstrumentType;
    name: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'piano',
      name: 'Piano Acústico',
      desc: 'Muestras de piano de cola Steinway con resonancia natural',
      icon: <Piano className="w-4 h-4" />,
    },
    {
      id: 'melody',
      name: 'Melodía Lírica',
      desc: 'Timbre expresivo ideal para voces y vientos solistas',
      icon: <Wind className="w-4 h-4" />,
    },
    {
      id: 'bass',
      name: 'Bajo Profundo',
      desc: 'Contrabajo y bajo acústico con cuerpo y pegada definida',
      icon: <AudioWaveform className="w-4 h-4" />,
    },
    {
      id: 'harmony',
      name: 'Armonía Orquestal',
      desc: 'Ensemble de cuerdas suaves y colchón armónico envolvente',
      icon: <Layers className="w-4 h-4" />,
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
    if (isAudioBlocked()) {
      toast.info(
        'Audio desbloqueado',
        'Pulsa reproducir para habilitar el sonido en este navegador.'
      );
    }

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

  const updateChannel = (staffIdx: number, updates: Partial<StaffChannelState>) => {
    audioEngine.setStaffChannel(staffIdx, updates);
    setChannels(audioEngine.getStaffChannels());
  };

  const handleResetMixer = () => {
    audioEngine.resetStaffChannels();
    setChannels(audioEngine.getStaffChannels());
    toast.info('Mezclador reiniciado', 'Se restablecieron volúmenes, mute, solo y panoramas.');
  };

  const staves = score?.staves || [];
  const anySoloActive = Object.values(channels).some((c) => c.solo);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Sintetizador y mezclador multicanal"
      maxWidth="max-w-2xl"
    >
      <ModalHeader
        icon={<Sliders className="w-4 h-4" />}
        title="Mezclador & Sintetizador"
        subtitle="Web Audio 44.1 kHz • Control Multipista (Mute, Solo, Pan)"
        onClose={onClose}
        closeLabel="Cerrar mezclador"
        actions={
          <div
            role="tablist"
            aria-label="Sección del mezclador"
            className="flex bg-slate-100 dark:bg-studio-elevated rounded-lg p-0.5 text-xs font-semibold"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tracks'}
              onClick={() => setActiveTab('tracks')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'tracks'
                  ? 'bg-white dark:bg-studio-card text-studio-accent shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Pistas ({staves.length || 1})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'master'}
              onClick={() => setActiveTab('master')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'master'
                  ? 'bg-white dark:bg-studio-card text-studio-accent shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Maestro & Tempo
            </button>
          </div>
        }
      />

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {/* TAB 1: PISTAS / MULTITRACK MIXER */}
        {activeTab === 'tracks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Tiras de Canal por Instrumento
              </span>
              <button
                type="button"
                onClick={handleResetMixer}
                className="text-[11px] text-slate-500 hover:text-studio-accent transition-colors font-medium cursor-pointer"
              >
                Restablecer Mezclador
              </button>
            </div>

            {staves.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No hay pentagramas configurados.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {staves.map((staff, sIdx) => {
                  const ch = channels[sIdx] || { volume: 1, pan: 0, mute: false, solo: false };
                  const isMutedBySolo = anySoloActive && !ch.solo;
                  const isSilenced = ch.mute || isMutedBySolo;
                  const staffName = staff.name || `Pista ${sIdx + 1}`;

                  return (
                    <div
                      key={staff.id || `staff-${sIdx}`}
                      className={`p-3 rounded-xl border transition-all ${
                        isSilenced
                          ? 'bg-slate-100/70 dark:bg-studio-elevated/40 border-slate-200 dark:border-studio-lineSoft opacity-60'
                          : 'bg-slate-50 dark:bg-studio-elevated border-slate-200 dark:border-studio-lineSoft shadow-xs'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase bg-slate-200 dark:bg-studio-raised px-1.5 py-0.5 rounded font-bold text-slate-600 dark:text-slate-300">
                            {staff.clef || 'sol'}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {staffName}
                          </span>
                        </div>

                        {/* Mute and Solo buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateChannel(sIdx, { mute: !ch.mute })}
                            className={`w-7 h-6 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              ch.mute
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-200 dark:bg-studio-raised text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                            }`}
                            title={ch.mute ? 'Desmutear pista' : 'Silenciar pista (Mute)'}
                          >
                            M
                          </button>
                          <button
                            type="button"
                            onClick={() => updateChannel(sIdx, { solo: !ch.solo })}
                            className={`w-7 h-6 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              ch.solo
                                ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-400'
                                : 'bg-slate-200 dark:bg-studio-raised text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                            }`}
                            title={ch.solo ? 'Desactivar Solo' : 'Pista en Solo'}
                          >
                            S
                          </button>

                          {/* Instrument selector per staff */}
                          <select
                            value={ch.instrument || instrument}
                            onChange={(e) =>
                              updateChannel(sIdx, { instrument: e.target.value as InstrumentType })
                            }
                            className="text-[11px] bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 cursor-pointer outline-none focus:border-studio-accent"
                          >
                            {instruments.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Controls: Volume and Stereo Pan */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/60 dark:border-studio-lineSoft/60">
                        {/* Volume Fader */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-slate-500 font-medium">Volumen</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {Math.round(ch.volume * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={ch.volume}
                            onChange={(e) =>
                              updateChannel(sIdx, { volume: parseFloat(e.target.value) })
                            }
                            className="w-full accent-studio-accent cursor-pointer h-1.5 bg-slate-200 dark:bg-studio-raised rounded-lg appearance-none"
                          />
                        </div>

                        {/* Stereo Pan */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-slate-500 font-medium">Panorama (Pan)</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {ch.pan === 0
                                ? 'C'
                                : ch.pan < 0
                                  ? `L ${Math.round(Math.abs(ch.pan) * 100)}%`
                                  : `R ${Math.round(ch.pan * 100)}%`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-1}
                            max={1}
                            step={0.05}
                            value={ch.pan}
                            onChange={(e) =>
                              updateChannel(sIdx, { pan: parseFloat(e.target.value) })
                            }
                            className="w-full accent-studio-accent cursor-pointer h-1.5 bg-slate-200 dark:bg-studio-raised rounded-lg appearance-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MAESTRO & TEMPO */}
        {activeTab === 'master' && (
          <div className="space-y-4">
            {/* Master Instrument Timbre Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Timbre Maestro Predeterminado
                </span>
                <button
                  type="button"
                  onClick={handleTestSound}
                  className="text-[11px] font-bold text-studio-accent hover:text-amber-600 flex items-center gap-1 cursor-pointer"
                  title="Reproducir arpegio de prueba"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Probar Sonido</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {instruments.map((inst) => (
                  <button
                    type="button"
                    key={inst.id}
                    onClick={() => {
                      onSetInstrument(inst.id);
                      audioEngine.instrument = inst.id;
                      audioEngine.playMidi(60, 0.4);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all duration-150 flex items-start gap-2.5 text-left hover:-translate-y-0.5 active:scale-[0.98] ${
                      instrument === inst.id
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-studio-accent ring-1 ring-studio-accent/50 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-studio-elevated dark:hover:bg-studio-deep border-slate-200 dark:border-studio-lineSoft'
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
                  </button>
                ))}
              </div>
            </div>

            {/* Master Volume */}
            <div className="bg-slate-50 dark:bg-studio-elevated p-4 rounded-xl border border-slate-200 dark:border-studio-lineSoft">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleMute}
                    className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white active:scale-90 transition-all cursor-pointer"
                    title={volume > 0 ? 'Silenciar maestro' : 'Reactivar sonido'}
                  >
                    {volume > 0 ? (
                      <Volume2 className="w-4 h-4 text-studio-accent" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-red-500" />
                    )}
                  </button>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Volumen Maestro General
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
                className="w-full accent-studio-accent cursor-pointer h-1.5 bg-slate-200 dark:bg-studio-raised rounded-lg appearance-none"
              />
            </div>

            {/* Tempo & BPM Presets */}
            <div className="bg-slate-50 dark:bg-studio-elevated p-4 rounded-xl border border-slate-200 dark:border-studio-lineSoft">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-studio-accent" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Velocidad / Tempo
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  <div className="flex items-center bg-white dark:bg-studio-surface border border-slate-300 dark:border-studio-line rounded-lg overflow-hidden focus-within:border-studio-accent focus-within:ring-1 focus-within:ring-studio-accent/30 transition-all">
                    <input
                      type="number"
                      min={30}
                      max={300}
                      value={tempo}
                      onChange={(e) => onSetTempo(parseInt(e.target.value, 10) || 120)}
                      className="w-11 text-center bg-transparent py-0.5 text-xs font-bold outline-none select-none text-slate-800 dark:text-slate-200"
                    />
                    <div className="flex flex-col border-l border-slate-200 dark:border-studio-line shrink-0">
                      <button
                        type="button"
                        onClick={() => onSetTempo(Math.min(300, tempo + 1))}
                        className="px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-studio-deep text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title="Aumentar tempo"
                      >
                        <ChevronUp className="w-2.5 h-2.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetTempo(Math.max(30, tempo - 1))}
                        className="px-1 py-0.5 border-t border-slate-200 dark:border-studio-line hover:bg-slate-100 dark:hover:bg-studio-deep text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title="Disminuir tempo"
                      >
                        <ChevronDown className="w-2.5 h-2.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
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
                className="w-full accent-studio-accent cursor-pointer h-1.5 bg-slate-200 dark:bg-studio-raised rounded-lg appearance-none mb-3"
              />

              <div className="flex flex-wrap gap-1.5">
                {tempoPresets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => onSetTempo(p.bpm)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95 ${
                      tempo === p.bpm
                        ? 'bg-studio-accent text-slate-950 shadow-xs'
                        : 'bg-white hover:bg-slate-200 dark:bg-studio-card dark:hover:bg-studio-raised text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-studio-lineSoft'
                    }`}
                  >
                    {p.label} ({p.bpm})
                  </button>
                ))}
              </div>
            </div>

            {/* Metronome */}
            <div className="bg-slate-50 dark:bg-studio-elevated p-4 rounded-xl border border-slate-200 dark:border-studio-lineSoft flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-studio-accent/10 text-amber-700 dark:text-studio-accent">
                  <Clock className="w-4 h-4" />
                </div>
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
                aria-pressed={metronomeEnabled}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  metronomeEnabled
                    ? 'bg-studio-accent text-slate-950 shadow-xs ring-2 ring-studio-accent/40 hover:bg-amber-400'
                    : 'bg-slate-200 dark:bg-studio-lineSoft text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-studio-raised'
                }`}
              >
                {metronomeEnabled ? 'Activado' : 'Desactivado'}
              </button>
            </div>

            {/* Chord Comping */}
            <div className="bg-slate-50 dark:bg-studio-elevated p-4 rounded-xl border border-slate-200 dark:border-studio-lineSoft space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Piano className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block leading-tight">
                      Acompañamiento de Cifrado (Chord Comping)
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Realiza automáticamente los acordes armónicos (ej. Cmaj7, Sol7, Lam) en la
                      reproducción
                    </span>
                  </div>
                </div>

                {onToggleChordComping && (
                  <button
                    onClick={onToggleChordComping}
                    aria-pressed={chordCompingEnabled}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                      chordCompingEnabled
                        ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400/40 hover:bg-amber-400'
                        : 'bg-slate-200 dark:bg-studio-lineSoft text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-studio-raised'
                    }`}
                  >
                    {chordCompingEnabled ? 'Activado' : 'Desactivado'}
                  </button>
                )}
              </div>

              {chordCompingEnabled && onSetChordCompingVolume && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-studio-lineSoft/60 flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                    Volumen Acordes:
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={chordCompingVolume}
                    onChange={(e) => onSetChordCompingVolume(parseFloat(e.target.value) || 0.65)}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-studio-raised rounded-lg appearance-none"
                  />
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 shrink-0">
                    {Math.round(chordCompingVolume * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ModalFooter
        className="mt-4"
        hint={
          <button
            type="button"
            onClick={handleTestSound}
            className="flex items-center gap-1 text-xs font-bold text-studio-accent hover:text-amber-600 active:scale-95 transition-all cursor-pointer"
          >
            <Music2 className="w-3.5 h-3.5" />
            <span>Escuchar prueba de audio</span>
          </button>
        }
      >
        <button type="button" onClick={onClose} className={modalButton.secondary}>
          Listo
        </button>
      </ModalFooter>
    </ModalBase>
  );
};
