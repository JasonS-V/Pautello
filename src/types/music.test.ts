import { describe, it, expect } from 'vitest';
import { Score, Staff, isPianoGrandStaff } from './music';

const staff = (name: string, clef: Staff['clef'] = 'treble'): Staff => ({
  id: `staff-${name}`,
  name,
  clef,
  measures: [{ id: 'm1', items: [{ id: 'r1', type: 'rest', duration: 'w' }] }],
});

const score = (staves: Staff[], isGrandStaff?: boolean): Score => ({
  id: 'score-1',
  title: 'Prueba',
  composer: '',
  tempo: 120,
  timeSignature: { beats: 4, beatType: 4 },
  keySignature: 'C',
  staves,
  ...(isGrandStaff ? { isGrandStaff: true } : {}),
  createdAt: 0,
  updatedAt: 0,
});

describe('isPianoGrandStaff', () => {
  it('reconoce el par marcado con la bandera aunque conserve el nombre y la clave del instrumento', () => {
    const s = score([staff('Saxofón Alto', 'alto'), staff('Mano Izquierda', 'bass')], true);
    expect(isPianoGrandStaff(s)).toBe(true);
    expect(s.staves[0].name).toBe('Saxofón Alto');
    expect(s.staves[0].clef).toBe('alto');
  });

  it('no considera gran pentagrama dos instrumentos independientes', () => {
    expect(isPianoGrandStaff(score([staff('Flauta'), staff('Violonchelo', 'bass')]))).toBe(false);
  });

  it('mantiene la compatibilidad con partituras antiguas renombradas', () => {
    expect(isPianoGrandStaff(score([staff('Mano Derecha'), staff('Mano Izquierda', 'bass')]))).toBe(
      true
    );
  });

  it('no resucita la llave si solo el pentagrama inferior se llama "Mano Izquierda"', () => {
    // Caso real: se quita el bajo, se añade otro instrumento y el nuevo
    // pentagrama queda con ese nombre heredado.
    expect(
      isPianoGrandStaff(score([staff('Saxofón Alto', 'alto'), staff('Mano Izquierda', 'bass')]))
    ).toBe(false);
  });

  it('exige exactamente dos pentagramas', () => {
    expect(isPianoGrandStaff(score([staff('Mano Derecha')], true))).toBe(false);
    expect(
      isPianoGrandStaff(
        score([staff('Mano Derecha'), staff('Mano Izquierda', 'bass'), staff('Voz')], true)
      )
    ).toBe(false);
  });
});
