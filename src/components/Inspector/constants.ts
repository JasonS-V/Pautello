import { NoteDuration } from '../../types/music';

export const DURATION_INFO: Record<NoteDuration, { symbol: string; label: string }> = {
  w: { symbol: '𝅝', label: 'Redonda' },
  h: { symbol: '𝅗𝅥', label: 'Blanca' },
  q: { symbol: '𝅘𝅥', label: 'Negra' },
  '8': { symbol: '𝅘𝅥𝅮', label: 'Corchea' },
  '16': { symbol: '𝅘𝅥𝅯', label: 'Semicorchea' },
  '32': { symbol: '𝅘𝅥𝅰', label: 'Fusa' },
};
