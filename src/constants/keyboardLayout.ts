import { Step, Accidental, Pitch } from '../types/music';

export interface PianoKeyMapping {
  code: string;
  key: string;
  step: Step;
  octaveOffset: number;
  accidental: Accidental;
  isBlack: boolean;
  label: string;
}

export const PIANO_KEY_MAPPINGS: PianoKeyMapping[] = [
  // Fila Central: Teclas Blancas (Octava base)
  {
    code: 'KeyA',
    key: 'a',
    step: 'C',
    octaveOffset: 0,
    accidental: null,
    isBlack: false,
    label: 'A',
  },
  {
    code: 'KeyS',
    key: 's',
    step: 'D',
    octaveOffset: 0,
    accidental: null,
    isBlack: false,
    label: 'S',
  },
  {
    code: 'KeyD',
    key: 'd',
    step: 'E',
    octaveOffset: 0,
    accidental: null,
    isBlack: false,
    label: 'D',
  },
  {
    code: 'KeyF',
    key: 'f',
    step: 'F',
    octaveOffset: 0,
    accidental: null,
    isBlack: false,
    label: 'F',
  },
  {
    code: 'KeyG',
    key: 'g',
    step: 'G',
    octaveOffset: 0,
    accidental: null,
    isBlack: false,
    label: 'G',
  },
  {
    code: 'KeyH',
    key: 'h',
    step: 'A',
    octaveOffset: 0,
    accidental: null,
    isBlack: false,
    label: 'H',
  },
  {
    code: 'KeyJ',
    key: 'j',
    step: 'B',
    octaveOffset: 0,
    accidental: null,
    isBlack: false,
    label: 'J',
  },

  // Fila Central: Teclas Blancas (Octava siguiente)
  {
    code: 'KeyK',
    key: 'k',
    step: 'C',
    octaveOffset: 1,
    accidental: null,
    isBlack: false,
    label: 'K',
  },
  {
    code: 'KeyL',
    key: 'l',
    step: 'D',
    octaveOffset: 1,
    accidental: null,
    isBlack: false,
    label: 'L',
  },
  {
    code: 'Semicolon',
    key: ';',
    step: 'E',
    octaveOffset: 1,
    accidental: null,
    isBlack: false,
    label: 'Ñ/;',
  },

  // Fila Superior: Teclas Negras (Octava base)
  {
    code: 'KeyW',
    key: 'w',
    step: 'C',
    octaveOffset: 0,
    accidental: '#',
    isBlack: true,
    label: 'W',
  },
  {
    code: 'KeyE',
    key: 'e',
    step: 'D',
    octaveOffset: 0,
    accidental: '#',
    isBlack: true,
    label: 'E',
  },
  // Hueco: la tecla 'R' queda libre para Silencio (Rest)
  {
    code: 'KeyT',
    key: 't',
    step: 'F',
    octaveOffset: 0,
    accidental: '#',
    isBlack: true,
    label: 'T',
  },
  {
    code: 'KeyY',
    key: 'y',
    step: 'G',
    octaveOffset: 0,
    accidental: '#',
    isBlack: true,
    label: 'Y',
  },
  {
    code: 'KeyU',
    key: 'u',
    step: 'A',
    octaveOffset: 0,
    accidental: '#',
    isBlack: true,
    label: 'U',
  },

  // Fila Superior: Teclas Negras (Octava siguiente)
  {
    code: 'KeyO',
    key: 'o',
    step: 'C',
    octaveOffset: 1,
    accidental: '#',
    isBlack: true,
    label: 'O',
  },
  {
    code: 'KeyP',
    key: 'p',
    step: 'D',
    octaveOffset: 1,
    accidental: '#',
    isBlack: true,
    label: 'P',
  },
];

/**
 * Busca si un evento de teclado corresponde a una nota en la disposición de piano QWERTY.
 * Soporta coincidencia por `event.code` (ubicación física) y por `event.key` (carácter).
 */
export function getPianoKeyMapping(event: KeyboardEvent): PianoKeyMapping | null {
  const code = event.code;
  const key = event.key ? event.key.toLowerCase() : '';

  // Especial para teclados en español donde la tecla al lado de la L es 'ñ'
  if (key === 'ñ' || code === 'Semicolon' || key === ';') {
    return PIANO_KEY_MAPPINGS.find((m) => m.code === 'Semicolon') || null;
  }

  return PIANO_KEY_MAPPINGS.find((m) => m.code === code || m.key === key) || null;
}

/**
 * Obtiene la altura (Pitch) resultante dada la tecla presionada y la octava base.
 */
export function getPitchFromPianoKey(mapping: PianoKeyMapping, baseOctave: number): Pitch {
  return {
    step: mapping.step,
    octave: baseOctave + mapping.octaveOffset,
    accidental: mapping.accidental,
  };
}

/**
 * Devuelve la etiqueta de tecla física ('A', 'W', 'S', etc.) para una nota del piano virtual
 * según la octava base actualmente configurada. Si la nota no cae en el rango del teclado QWERTY,
 * devuelve null.
 */
export function getKeycapLabelForPitch(
  step: Step,
  octave: number,
  accidental: Accidental,
  baseOctave: number
): string | null {
  const offset = octave - baseOctave;
  if (offset !== 0 && offset !== 1) return null;

  // Normalizar alteraciones simples para búsqueda
  const normAcc = accidental === '#' ? '#' : null;

  const found = PIANO_KEY_MAPPINGS.find(
    (m) => m.step === step && m.octaveOffset === offset && m.accidental === normAcc
  );

  return found ? found.label : null;
}
