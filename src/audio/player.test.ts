import { describe, it, expect } from 'vitest';
import { ScorePlayer, PlaybackState } from './player';
import { Score } from '../types/music';

const mock34Score: Score = {
  id: 'test-34',
  title: 'Vals en 3/4',
  composer: 'Chopin',
  tempo: 120,
  timeSignature: { beats: 3, beatType: 4 },
  keySignature: 'C',
  staves: [{
    id: 's1',
    name: 'Piano',
    clef: 'treble',
    measures: [
      {
        id: 'm1',
        items: [
          { id: 'n1', type: 'note', pitch: { step: 'C', octave: 4, accidental: null }, duration: 'q' },
          { id: 'n2', type: 'note', pitch: { step: 'E', octave: 4, accidental: null }, duration: 'q' },
          { id: 'n3', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'q' },
        ]
      },
      {
        id: 'm2',
        items: [
          { id: 'r1', type: 'rest', duration: 'w' }
        ]
      }
    ]
  }],
  createdAt: 0,
  updatedAt: 0,
};

describe('ScorePlayer Playback Scheduler', () => {
  it('correctly manages play, pause, and stop transitions', () => {
    const player = new ScorePlayer();
    player.setScore(mock34Score);

    const states: PlaybackState[] = [];
    const unsub = player.subscribe(state => states.push({ ...state }));

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
});
