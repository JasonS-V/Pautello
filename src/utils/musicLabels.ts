import { MetronomeBeatUnit, MetronomeMark, MetricEquivalence } from '../types/music';

const symbols: Record<MetronomeBeatUnit, string> = { w: '𝅝', h: '𝅗𝅥', q: '♩', '8': '♪', '16': '𝅘𝅥𝅯' };
const unit = (beat: MetronomeBeatUnit, dots: number) => `${symbols[beat]}${'·'.repeat(dots)}`;

export const metronomeLabel = (mark: MetronomeMark) =>
  `${unit(mark.beatUnit, mark.dots)} = ${mark.perMinute}`;
export const metricEquivalenceLabel = (mark: MetricEquivalence) =>
  `${unit(mark.previousUnit, mark.previousDots)} = ${unit(mark.nextUnit, mark.nextDots)}`;
