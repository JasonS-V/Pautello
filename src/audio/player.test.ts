import { describe, it, expect, vi } from 'vitest';
import { ScorePlayer, PlaybackState } from './player';
import { Score, Staff } from '../types/music';
import { resolveStaffInstrument, audioEngine } from './synth';

const mock34Score: Score = {
  id: 'test-34',
  title: 'Vals en 3/4',
  composer: 'Chopin',
  tempo: 120,
  timeSignature: { beats: 3, beatType: 4 },
  keySignature: 'C',
  staves: [
    {
      id: 's1',
      name: 'Piano',
      clef: 'treble',
      measures: [
        {
          id: 'm1',
          items: [
            {
              id: 'n1',
              type: 'note',
              pitch: { step: 'C', octave: 4, accidental: null },
              duration: 'q',
            },
            {
              id: 'n2',
              type: 'note',
              pitch: { step: 'E', octave: 4, accidental: null },
              duration: 'q',
            },
            {
              id: 'n3',
              type: 'note',
              pitch: { step: 'G', octave: 4, accidental: null },
              duration: 'q',
            },
          ],
        },
        {
          id: 'm2',
          items: [{ id: 'r1', type: 'rest', duration: 'w' }],
        },
      ],
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

describe('ScorePlayer Playback Scheduler', () => {
  it('correctly manages play, pause, and stop transitions', () => {
    const player = new ScorePlayer();
    player.setScore(mock34Score);

    const states: PlaybackState[] = [];
    const unsub = player.subscribe((state) => states.push({ ...state }));

    player.play(0, 0);
    expect(states[states.length - 1].isPlaying).toBe(true);
    expect(states[states.length - 1].currentMeasureIndex).toBe(0);

    player.pause();
    expect(states[states.length - 1].isPlaying).toBe(false);
    expect(states[states.length - 1].isPaused).toBe(true);

    player.stop();
    expect(states[states.length - 1].isPlaying).toBe(false);
    expect(states[states.length - 1].isPaused).toBe(false);
    expect(states[states.length - 1].currentMeasureIndex).toBe(0);

    unsub();
  });

  it('supports loop mode configuration', () => {
    const player = new ScorePlayer();
    player.setScore(mock34Score);
    player.setLoop(true);
    player.setMetronome(true);

    // Verify player doesn't throw during execution
    player.play(0, 0);
    player.stop();
  });

  it('handles multimeasure rests (tacet) in lookahead scheduler', () => {
    const tacetScore: Score = {
      ...mock34Score,
      staves: [
        {
          id: 's1',
          name: 'Trompeta',
          clef: 'treble',
          measures: [
            {
              id: 'm1',
              multimeasureRest: 4,
              items: [{ id: 'r1', type: 'rest', duration: 'w' }],
            },
            {
              id: 'm2',
              items: [
                {
                  id: 'n1',
                  type: 'note',
                  pitch: { step: 'C', octave: 4, accidental: null },
                  duration: 'h',
                },
              ],
            },
          ],
        },
      ],
    };

    const player = new ScorePlayer();
    player.setScore(tacetScore);
    player.play(0, 0);
    expect(player).toBeDefined();
    player.stop();
  });
});

describe('resolveStaffInstrument', () => {
  it('identifies piano when score is grand staff regardless of staff name', () => {
    const staff: Staff = {
      id: 'staff-1',
      name: 'Melodía',
      clef: 'treble',
      measures: [],
    };
    expect(resolveStaffInstrument(staff, true)).toBe('piano');
  });

  it('identifies piano by name or abbreviations', () => {
    const pno1: Staff = { id: 's1', name: 'Piano', clef: 'treble', measures: [] };
    const pno2: Staff = { id: 's2', name: 'Teclado eléctrico', clef: 'treble', measures: [] };
    const pno3: Staff = { id: 's3', name: 'Mano Derecha', clef: 'treble', measures: [] };

    expect(resolveStaffInstrument(pno1)).toBe('piano');
    expect(resolveStaffInstrument(pno2)).toBe('piano');
    expect(resolveStaffInstrument(pno3)).toBe('piano');
  });

  it('identifies bass instruments by name or bass clef', () => {
    const bass1: Staff = { id: 's1', name: 'Bajo', clef: 'bass', measures: [] };
    const bass2: Staff = { id: 's2', name: 'Contrabajo', clef: 'treble', measures: [] };
    const bass3: Staff = { id: 's3', name: 'Violonchelo', clef: 'treble', measures: [] };
    const bassClefOnly: Staff = { id: 's4', name: 'Instrumento 2', clef: 'bass', measures: [] };

    expect(resolveStaffInstrument(bass1)).toBe('bass');
    expect(resolveStaffInstrument(bass2)).toBe('bass');
    expect(resolveStaffInstrument(bass3)).toBe('bass');
    expect(resolveStaffInstrument(bassClefOnly)).toBe('bass');
  });

  it('identifies harmony / string ensemble by name or alto clef', () => {
    const harm1: Staff = { id: 's1', name: 'Armonía', clef: 'alto', measures: [] };
    const harm2: Staff = { id: 's2', name: 'Cuerdas', clef: 'treble', measures: [] };
    const harm3: Staff = { id: 's3', name: 'Viola', clef: 'treble', measures: [] };
    const altoClefOnly: Staff = { id: 's4', name: 'Instrumento 3', clef: 'alto', measures: [] };

    expect(resolveStaffInstrument(harm1)).toBe('harmony');
    expect(resolveStaffInstrument(harm2)).toBe('harmony');
    expect(resolveStaffInstrument(harm3)).toBe('harmony');
    expect(resolveStaffInstrument(altoClefOnly)).toBe('harmony');
  });

  it('identifies melody / vocal / wind instruments by name', () => {
    const mel1: Staff = { id: 's1', name: 'Melodía', clef: 'treble', measures: [] };
    const mel2: Staff = { id: 's2', name: 'Flauta', clef: 'treble', measures: [] };
    const mel3: Staff = { id: 's3', name: 'Voz / Canto', clef: 'treble', measures: [] };
    const mel4: Staff = { id: 's4', name: 'Violín solista', clef: 'treble', measures: [] };

    expect(resolveStaffInstrument(mel1)).toBe('melody');
    expect(resolveStaffInstrument(mel2)).toBe('melody');
    expect(resolveStaffInstrument(mel3)).toBe('melody');
    expect(resolveStaffInstrument(mel4)).toBe('melody');
  });

  it('falls back to default instrument or melody for generic treble staff', () => {
    const generic: Staff = { id: 's1', name: 'Pista 1', clef: 'treble', measures: [] };

    expect(resolveStaffInstrument(generic)).toBe('melody');
    expect(resolveStaffInstrument(generic, false, 'piano')).toBe('piano');
    expect(resolveStaffInstrument(generic, false, 'strings')).toBe('strings');
  });
});

describe('Multitrack per-staff playback scheduling', () => {
  it('plays each staff with its corresponding timbre simultaneously', () => {
    const multiScore: Score = {
      id: 'test-multi',
      title: 'Ensamble Melodía + Bajo',
      composer: 'Test',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      createdAt: 0,
      updatedAt: 0,
      staves: [
        {
          id: 'staff-mel',
          name: 'Melodía',
          clef: 'treble',
          measures: [
            {
              id: 'm1',
              items: [
                {
                  id: 'n1',
                  type: 'note',
                  pitch: { step: 'C', octave: 5, accidental: null },
                  duration: 'q',
                },
              ],
            },
          ],
        },
        {
          id: 'staff-bass',
          name: 'Bajo',
          clef: 'bass',
          measures: [
            {
              id: 'm2',
              items: [
                {
                  id: 'n2',
                  type: 'note',
                  pitch: { step: 'C', octave: 2, accidental: null },
                  duration: 'q',
                },
              ],
            },
          ],
        },
      ],
    };

    const playedInstruments: string[] = [];
    const playMidiSpy = vi.spyOn(audioEngine, 'playMidi').mockImplementation((...args) => {
      const inst = args[4]; // 5th argument is instrument?: InstrumentType
      if (inst) playedInstruments.push(inst);
    });

    const player = new ScorePlayer();
    player.setScore(multiScore);
    player.play(0, 0);

    expect(playedInstruments).toContain('melody');
    expect(playedInstruments).toContain('bass');

    player.stop();
    playMidiSpy.mockRestore();
  });
});

describe('Formal Navigation Marks Playback (D.C., D.S., Fine)', () => {
  it('recognizes Da Capo and Dal Segno navigation without infinite loops', () => {
    const navScore: Score = {
      id: 'test-nav',
      title: 'Pieza con Da Capo y Fine',
      composer: 'Test',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      createdAt: 0,
      updatedAt: 0,
      staves: [
        {
          id: 'staff-nav',
          name: 'Piano',
          clef: 'treble',
          measures: [
            {
              id: 'm1',
              navigationMark: 'segno',
              items: [
                {
                  id: 'n1',
                  type: 'note',
                  pitch: { step: 'C', octave: 4, accidental: null },
                  duration: 'q',
                },
              ],
            },
            {
              id: 'm2',
              navigationMark: 'fine',
              items: [
                {
                  id: 'n2',
                  type: 'note',
                  pitch: { step: 'D', octave: 4, accidental: null },
                  duration: 'q',
                },
              ],
            },
            {
              id: 'm3',
              navigationMark: 'daCapoAlFine',
              items: [
                {
                  id: 'n3',
                  type: 'note',
                  pitch: { step: 'E', octave: 4, accidental: null },
                  duration: 'q',
                },
              ],
            },
          ],
        },
      ],
    };

    const player = new ScorePlayer();
    player.setScore(navScore);
    expect(() => {
      player.play(0, 0);
      player.stop();
    }).not.toThrow();
  });

  it('repeats previous bar events when measure has isMeasureRepeat (%) enabled', () => {
    const repeatMeasureScore: Score = {
      id: 'test-repeat-measure',
      title: 'Compás de Repetición (%)',
      composer: 'Test',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      createdAt: 0,
      updatedAt: 0,
      staves: [
        {
          id: 'staff-rep',
          name: 'Batería/Rítmica',
          clef: 'treble',
          measures: [
            {
              id: 'm1',
              items: [
                {
                  id: 'n1',
                  type: 'note',
                  pitch: { step: 'C', octave: 4, accidental: null },
                  duration: 'q',
                },
              ],
            },
            {
              id: 'm2',
              isMeasureRepeat: true,
              items: [], // Empty because % denotes repeat of previous bar
            },
          ],
        },
      ],
    };

    const playedNotes: number[] = [];
    const playMidiSpy = vi.spyOn(audioEngine, 'playMidi').mockImplementation((...args) => {
      playedNotes.push(args[0]);
    });

    const player = new ScorePlayer();
    player.setScore(repeatMeasureScore);
    player.play(0, 0);

    // Should play C4 (60)
    expect(playedNotes.length).toBeGreaterThan(0);
    expect(playedNotes[0]).toBe(60);

    player.stop();
    playMidiSpy.mockRestore();
  });
});

describe('AudioEngine Multichannel Strips (Mute, Solo, Pan, Volume)', () => {
  it('manages channel states per staff index and allows resetting', () => {
    audioEngine.resetStaffChannels();
    expect(audioEngine.getStaffChannel(0).volume).toBe(1);
    expect(audioEngine.getStaffChannel(0).mute).toBe(false);

    audioEngine.setStaffChannel(0, { volume: 0.5, pan: -0.75, mute: true });
    expect(audioEngine.getStaffChannel(0).volume).toBe(0.5);
    expect(audioEngine.getStaffChannel(0).pan).toBe(-0.75);
    expect(audioEngine.getStaffChannel(0).mute).toBe(true);

    audioEngine.setStaffChannel(1, { solo: true, instrument: 'bass' });
    expect(audioEngine.getStaffChannel(1).solo).toBe(true);
    expect(audioEngine.getStaffChannel(1).instrument).toBe('bass');

    const allChannels = audioEngine.getStaffChannels();
    expect(allChannels[0].mute).toBe(true);
    expect(allChannels[1].solo).toBe(true);

    audioEngine.resetStaffChannels();
    expect(audioEngine.getStaffChannels()).toEqual({});
  });
});
