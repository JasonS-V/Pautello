import { lineFragment, type OmrTokenEvent } from './omrDecode';

const add = (a: number, b: number) => {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  const max = Math.max(a, b);
  return max + Math.log(Math.exp(a - max) + Math.exp(b - max));
};
interface Path {
  score: number;
  events: OmrTokenEvent[];
}
interface Prefix {
  ids: number[];
  blank: number;
  nonblank: number;
  bp: Path;
  np: Path;
}
const emptyPath = (): Path => ({ score: -Infinity, events: [] });

/** Experimental prefix beam; never selected automatically by the importer. */
export function decodeBeam(
  logits: Float32Array,
  frames: number,
  classes: number,
  vocab: Record<number, string>,
  options: { width?: number; topK?: number; grammarPenalty?: number } = {}
): { events: OmrTokenEvent[]; peakPrefixes: number } {
  const width = options.width ?? 8,
    topK = options.topK ?? 4;
  if (
    !Number.isInteger(width) ||
    width < 1 ||
    width > 32 ||
    !Number.isInteger(topK) ||
    topK < 1 ||
    topK > 16 ||
    logits.length !== frames * classes ||
    classes < 2
  )
    throw new Error('Límites o dimensiones CTC inválidos.');
  let prefixes: Prefix[] = [
    { ids: [], blank: 0, nonblank: -Infinity, bp: { score: 0, events: [] }, np: emptyPath() },
  ];
  let peakPrefixes = 1;
  for (let f = 0; f < frames; f++) {
    const row = logits.subarray(f * classes, (f + 1) * classes);
    let max = -Infinity;
    for (const n of row) max = Math.max(max, n);
    let sum = 0;
    for (const n of row) sum += Math.exp(n - max);
    const normalizer = max + Math.log(sum);
    const candidates = Array.from({ length: classes - 1 }, (_, i) => i + 1)
      .sort((a, b) => row[b] - row[a])
      .slice(0, topK);
    const next = new Map<string, Prefix>();
    const get = (ids: number[]) => {
      const key = ids.join(',');
      let p = next.get(key);
      if (!p) {
        p = { ids, blank: -Infinity, nonblank: -Infinity, bp: emptyPath(), np: emptyPath() };
        next.set(key, p);
      }
      return p;
    };
    const update = (p: Prefix, blank: boolean, probability: number, path: Path) => {
      if (blank) {
        p.blank = add(p.blank, probability);
        if (path.score > p.bp.score) p.bp = path;
      } else {
        p.nonblank = add(p.nonblank, probability);
        if (path.score > p.np.score) p.np = path;
      }
    };
    for (const p of prefixes) {
      const total = add(p.blank, p.nonblank);
      const best = p.bp.score > p.np.score ? p.bp : p.np;
      const blankLog = row[0] - normalizer;
      update(get(p.ids), true, total + blankLog, {
        score: best.score + blankLog,
        events: best.events,
      });
      // A prefix's last class can continue even outside the frame's top K.
      const choices = new Set([...candidates, ...p.ids.slice(-1)]);
      for (const id of choices) {
        const log = row[id] - normalizer,
          repeated = id === p.ids[p.ids.length - 1];
        if (repeated) {
          const events = p.np.events.map((e, i, a) => (i === a.length - 1 ? { ...e, f1: f } : e));
          update(get(p.ids), false, p.nonblank + log, { score: p.np.score + log, events });
        }
        const origin = repeated ? p.bp : best;
        if (origin.score === -Infinity) continue;
        let penalty = 0;
        if (vocab[id] === '<b>' && options.grammarPenalty) {
          const lastSeparator = origin.events.map((e) => e.token).lastIndexOf('<b>');
          const record = origin.events.slice(lastSeparator + 1);
          if (
            lineFragment(record, {
              page: 1,
              system: 0,
              staffIndex: 0,
              bbox: [0, 0, 1, 128],
              lineSpacingPx: 10,
              normSpacing: 10,
            }).some((e) => e.kind === 'unparseable')
          )
            penalty = options.grammarPenalty;
        }
        const events = [
          ...origin.events,
          { token: vocab[id], f0: f, f1: f, confidence: Math.exp(log) },
        ];
        update(get([...p.ids, id]), false, (repeated ? p.blank : total) + log - penalty, {
          score: origin.score + log - penalty,
          events,
        });
      }
    }
    prefixes = [...next.values()]
      .sort((a, b) => add(b.blank, b.nonblank) - add(a.blank, a.nonblank))
      .slice(0, width);
    peakPrefixes = Math.max(peakPrefixes, prefixes.length);
  }
  const best = prefixes[0];
  return {
    events: best.bp.score > best.np.score ? best.bp.events : best.np.events,
    peakPrefixes,
  };
}
