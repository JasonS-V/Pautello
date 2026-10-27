/**
 * Decodificador CTC voraz (best-path) y ensamblador de representación intermedia (Score-IR)
 * a partir de los logits emitidos por el modelo CRNN-CTC sobre vocabulario Humdrum `**kern`.
 */

import { Step } from '../types/music';

export const IR_VERSION = '1.3';
export const WIDTH_REDUCTION = 4;
export const DIV_WHOLE = 192;

const BLANK = 0;
const SEP = '<b>';

const DURATIONS = new Set(['0', '1', '2', '3', '4', '6', '8', '12', '16', '24', '32']);
const ACCIDENTALS: Readonly<Record<string, number>> = {
  '#': 1,
  '##': 2,
  '-': -1,
  '--': -2,
  n: 0,
};

const BARLINE_TYPES: Readonly<Record<string, string>> = {
  '=': 'regular',
  '==': 'final',
  '=||': 'double',
  '=-': 'invisible',
  '=:|!': 'repeat-end',
  '=!|:': 'repeat-start',
  '=:|!|:': 'repeat-both',
  '==:|!': 'final-repeat-end',
};

const LEGITIMATE_ADJACENT = new Set(['= =', '= ==']);

export interface OmrTokenEvent {
  token: string;
  f0: number;
  f1: number;
  confidence: number;
}

export interface OmrStaffMeta {
  page: number;
  system: number;
  staffIndex: number;
  bbox: [number, number, number, number];
  lineSpacingPx: number;
  normSpacing: number;
  truncated?: boolean;
}

export interface OmrDurationIR {
  divisions: number;
  base: string;
  dots: number;
}

export interface OmrPitchIR {
  step: Step;
  alter: number;
  octave: number;
  rawToken?: string;
}

export interface OmrClefIR {
  sign: string;
  line: number;
  octaveChange: number;
}

export interface OmrTimeIR {
  num: number;
  den: number;
}

export interface OmrSourceSpan {
  page: number;
  system: number;
  staff: number;
  bbox: [number, number, number, number];
}

export type OmrElementIR =
  | {
      kind: 'barline';
      type: string;
      confidence: number;
      tokens?: string[];
      src?: OmrSourceSpan;
    }
  | {
      kind: 'attribute';
      confidence: number;
      clef?: OmrClefIR;
      keyFifths?: number;
      time?: OmrTimeIR;
      tokens?: string[];
      src?: OmrSourceSpan;
    }
  | {
      kind: 'note' | 'rest';
      duration: OmrDurationIR;
      confidence: number;
      pitch?: OmrPitchIR;
      pitches?: OmrPitchIR[];
      tie?: 'start' | 'stop' | 'continue' | null;
      slur?: 'start' | 'stop';
      fermata?: boolean;
      tokens?: string[];
      src?: OmrSourceSpan;
    }
  | {
      kind: 'unparseable';
      tokens: string[];
      confidence: number;
      src?: OmrSourceSpan;
    };

export interface OmrDecodedLine {
  staff: OmrStaffMeta;
  elements: OmrElementIR[];
}

export interface OmrMeasureIR {
  index: number;
  system: number;
  attributes?: {
    clef?: OmrClefIR;
    keyFifths?: number;
    time?: OmrTimeIR;
  };
  events: Array<Extract<OmrElementIR, { kind: 'note' | 'rest' }>>;
  barline?: {
    type: string;
    confidence: number;
    tokens?: string[];
    src?: OmrSourceSpan;
  };
}

export interface OmrPartIR {
  index: number;
  label: string | null;
  measures: OmrMeasureIR[];
}

export interface OmrWarning {
  code: string;
  message: string;
  page?: number;
  system?: number;
  staff?: number;
  found?: number;
  expected?: number;
  tokens?: string[];
}

export interface OmrScoreIR {
  irVersion: string;
  structure: {
    recognized: {
      stavesPerSystem: number;
      clefs: Array<string | null>;
      keyFifths: number | null;
      time: OmrTimeIR | null;
    };
  };
  parts: OmrPartIR[];
  warnings: OmrWarning[];
}

function roundPy(x: number, digits: number): number {
  const p = Math.pow(10, digits);
  const y = x * p;
  const f = Math.floor(y);
  const diff = y - f;
  let r: number;
  if (diff > 0.5) r = f + 1;
  else if (diff < 0.5) r = f;
  else r = f % 2 === 0 ? f : f + 1;
  return r / p;
}

export function i2wFromVocab(vocabTokens: string[]): Record<number, string> {
  const i2w: Record<number, string> = {};
  for (let i = 0; i < vocabTokens.length; i++) {
    i2w[i + 1] = vocabTokens[i];
  }
  return i2w;
}

export function decodeLine(
  logits: Float32Array | number[],
  T: number,
  C: number,
  i2w: Record<number, string>
): OmrTokenEvent[] {
  const rawEvents: Array<{
    token: string;
    f0: number;
    f1: number;
    _psum: number;
    _n: number;
  }> = [];

  let prev = -1;
  for (let f = 0; f < T; f++) {
    const row = f * C;
    let k = 0;
    let best = logits[row];
    for (let c = 1; c < C; c++) {
      if (logits[row + c] > best) {
        best = logits[row + c];
        k = c;
      }
    }
    if (k !== BLANK) {
      let sum = 0;
      for (let c = 0; c < C; c++) {
        sum += Math.exp(logits[row + c] - best);
      }
      const p = 1 / sum;
      if (k !== prev) {
        rawEvents.push({ token: i2w[k], f0: f, f1: f, _psum: p, _n: 1 });
      } else {
        const ev = rawEvents[rawEvents.length - 1];
        ev.f1 = f;
        ev._psum += p;
        ev._n += 1;
      }
    }
    prev = k;
  }

  return rawEvents.map((ev) => ({
    token: ev.token,
    f0: ev.f0,
    f1: ev.f1,
    confidence: roundPy(ev._psum / ev._n, 4),
  }));
}

function splitRecords(tokenEvents: OmrTokenEvent[]): OmrTokenEvent[][] {
  const recs: OmrTokenEvent[][] = [];
  let cur: OmrTokenEvent[] = [];
  for (const ev of tokenEvents) {
    if (ev.token === SEP) {
      if (cur.length > 0) recs.push(cur);
      cur = [];
    } else {
      cur.push(ev);
    }
  }
  if (cur.length > 0) recs.push(cur);
  return recs;
}

function mergeBarlines(a: OmrTokenEvent[], b: OmrTokenEvent[]): OmrTokenEvent[] {
  const keep = a[0].token === '=' && b[0].token !== '=' ? b : a;
  const f0 = Math.min(a[0].f0, b[0].f0);
  const f1 = Math.max(a[a.length - 1].f1, b[b.length - 1].f1);
  const first: OmrTokenEvent = { ...keep[0], f0, f1 };
  return [first, ...keep.slice(1)];
}

function collapseBarlines(recs: OmrTokenEvent[][]): OmrTokenEvent[][] {
  const out: OmrTokenEvent[][] = [];
  for (const rec of recs) {
    out.push(rec);
    while (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      if (!(a[0].token.startsWith('=') && b[0].token.startsWith('='))) break;
      if (LEGITIMATE_ADJACENT.has(`${a[0].token} ${b[0].token}`)) break;
      const merged = mergeBarlines(a, b);
      out.length -= 2;
      out.push(merged);
    }
  }
  return out;
}

function parseDur(token: string): OmrDurationIR | null {
  const base = token.replace(/\.+$/, '');
  if (!DURATIONS.has(base)) return null;
  const dots = token.length - base.length;
  const d = base === '0' ? DIV_WHOLE * 2 : Math.floor(DIV_WHOLE / parseInt(base, 10));
  let total = d;
  let add = d;
  for (let i = 0; i < dots; i++) {
    add = Math.floor(add / 2);
    total += add;
  }
  return { divisions: total, base, dots };
}

function parsePitchToken(token: string): { step: Step; octave: number } | null {
  if (!token || !/^[a-gA-G]+$/.test(token)) return null;
  const ch = token[0];
  if (token !== ch.repeat(token.length)) return null;
  const step = ch.toUpperCase() as Step;
  if (ch === ch.toLowerCase()) {
    return { step, octave: 3 + token.length };
  }
  return { step, octave: 4 - token.length };
}

function classify(record: OmrTokenEvent[]): OmrElementIR | null {
  const toks = record.map((ev) => ev.token).filter(Boolean);
  if (toks.length === 0) return null;

  let conf = Infinity;
  for (const ev of record) {
    if (ev.confidence < conf) conf = ev.confidence;
  }
  const first = toks[0];

  if (first.startsWith('=')) {
    return {
      kind: 'barline',
      type: BARLINE_TYPES[first] ?? 'other',
      confidence: conf,
    };
  }

  if (first.startsWith('*')) {
    const el: Extract<OmrElementIR, { kind: 'attribute' }> = {
      kind: 'attribute',
      confidence: conf,
    };
    if (first.startsWith('*clef')) {
      let body = first.slice(5);
      const octave = body.includes('v') ? -1 : body.includes('^') ? 1 : 0;
      body = body.replace('v', '').replace('^', '');
      el.clef = {
        sign: body[0],
        line: parseInt(body.slice(1) || '0', 10),
        octaveChange: octave,
      };
    } else if (first.startsWith('*k[')) {
      const inner = first.slice(3, -1);
      const sharps = (inner.match(/#/g) || []).length;
      el.keyFifths = (sharps || -(inner.match(/-/g) || []).length) + 0;
    } else if (first.startsWith('*M')) {
      const [num, den] = first.slice(2).split('/');
      el.time = { num: parseInt(num, 10), den: parseInt(den, 10) };
    } else {
      return null;
    }
    return el;
  }

  let d: OmrDurationIR | null = null;
  for (const t of toks) {
    d = parseDur(t);
    if (d) break;
  }
  if (!d) {
    return { kind: 'unparseable', tokens: toks, confidence: conf };
  }

  if (toks.includes('r')) {
    return {
      kind: 'rest',
      duration: d,
      confidence: conf,
    };
  }

  const parsedPitches: OmrPitchIR[] = [];
  for (let i = 0; i < toks.length; i++) {
    const p = parsePitchToken(toks[i]);
    if (p) {
      let alter = 0;
      let rawAcc: string | undefined = undefined;
      if (i + 1 < toks.length && toks[i + 1] in ACCIDENTALS) {
        alter = ACCIDENTALS[toks[i + 1]];
        rawAcc = toks[i + 1];
      }
      parsedPitches.push({
        step: p.step,
        alter,
        octave: p.octave,
        rawToken: rawAcc,
      });
    }
  }

  if (parsedPitches.length === 0) {
    return { kind: 'unparseable', tokens: toks, confidence: conf };
  }

  const tie: 'start' | 'stop' | 'continue' | null = toks.includes('[')
    ? 'start'
    : toks.includes(']')
      ? 'stop'
      : toks.includes('_')
        ? 'continue'
        : null;

  const slur: 'start' | 'stop' | undefined = toks.includes('(')
    ? 'start'
    : toks.includes(')')
      ? 'stop'
      : undefined;

  return {
    kind: 'note',
    duration: d,
    confidence: conf,
    pitch: parsedPitches[0],
    pitches: parsedPitches,
    tie,
    slur,
    fermata: toks.includes(';'),
  };
}

function bboxOf(record: OmrTokenEvent[], staff: OmrStaffMeta): [number, number, number, number] {
  let f0 = Infinity;
  let f1 = -Infinity;
  for (const ev of record) {
    if (ev.f0 < f0) f0 = ev.f0;
    if (ev.f1 > f1) f1 = ev.f1;
  }
  const scale = staff.lineSpacingPx / staff.normSpacing;
  const x0 = staff.bbox[0] + WIDTH_REDUCTION * f0 * scale;
  const x1 = staff.bbox[0] + WIDTH_REDUCTION * (f1 + 1) * scale;
  return [roundPy(x0, 1), staff.bbox[1], roundPy(x1 - x0, 1), staff.bbox[3]];
}

export function lineFragment(tokenEvents: OmrTokenEvent[], staff: OmrStaffMeta): OmrElementIR[] {
  const out: OmrElementIR[] = [];
  for (const record of collapseBarlines(splitRecords(tokenEvents))) {
    const el = classify(record);
    if (el === null) continue;
    el.tokens = record.map((ev) => ev.token);
    el.src = {
      page: staff.page,
      system: staff.system,
      staff: staff.staffIndex,
      bbox: bboxOf(record, staff),
    };
    out.push(el);
  }
  return out;
}

function modal(values: number[]): number {
  const uniq = [...new Set(values)].sort((a, b) => b - a);
  let best = 0;
  let n = 0;
  for (const v of uniq) {
    const c = values.filter((x) => x === v).length;
    if (c > n) {
      best = v;
      n = c;
    }
  }
  return best;
}

export function assembleIR(lines: OmrDecodedLine[]): OmrScoreIR {
  const counts = new Map<string, number>();
  for (const ln of lines) {
    const s = ln.staff;
    const key = `${s.page}/${s.system}`;
    counts.set(key, Math.max(counts.get(key) ?? 0, s.staffIndex + 1));
  }
  const m = counts.size ? modal([...counts.values()]) : 0;

  const warnings: OmrWarning[] = [];
  const keys = [...counts.keys()].sort((a, b) => {
    const [pa, sa] = a.split('/').map(Number);
    const [pb, sb] = b.split('/').map(Number);
    return pa - pb || sa - sb;
  });

  for (const key of keys) {
    const [page, sysno] = key.split('/').map(Number);
    const n = counts.get(key) ?? 0;
    if (n !== m) {
      warnings.push({
        code: 'staff-count-mismatch',
        page,
        system: sysno,
        found: n,
        expected: m,
        message: `Página ${page}, sistema ${sysno}: ${n} pentagramas detectados (esperados: ${m}).`,
      });
    }
  }

  const parts: OmrPartIR[] = [];
  for (let i = 0; i < m; i++) {
    parts.push({ index: i, label: null, measures: [] });
  }
  const openMeasures: Array<OmrMeasureIR | null> = new Array(m).fill(null);
  const structure = {
    stavesPerSystem: m,
    clefs: new Array<string | null>(m).fill(null),
    keyFifths: null as number | null,
    time: null as OmrTimeIR | null,
  };

  const open = (p: number, system: number): OmrMeasureIR => {
    let mm = openMeasures[p];
    if (mm === null) {
      mm = { index: parts[p].measures.length, system, events: [] };
      parts[p].measures.push(mm);
      openMeasures[p] = mm;
    }
    return mm;
  };

  for (const ln of lines) {
    const st = ln.staff;
    const p = st.staffIndex;
    if (st.truncated) {
      warnings.push({
        code: 'line-truncated',
        page: st.page,
        system: st.system,
        staff: p,
        message: `Página ${st.page}, sistema ${st.system}, pentagrama ${p + 1}: ancho truncado al límite máximo.`,
      });
    }
    if (p >= m) continue;

    for (const el of ln.elements) {
      if (el.kind === 'unparseable') {
        warnings.push({
          code: 'unparseable-tokens',
          page: st.page,
          system: st.system,
          staff: p,
          tokens: [...el.tokens],
          message: el.tokens.join(' '),
        });
        continue;
      }
      if (el.kind === 'attribute') {
        const mm = open(p, st.system);
        if (!mm.attributes) mm.attributes = {};
        if (el.clef) mm.attributes.clef = el.clef;
        if (el.keyFifths !== undefined) mm.attributes.keyFifths = el.keyFifths;
        if (el.time) mm.attributes.time = el.time;

        if (el.clef && structure.clefs[p] === null) {
          const c = el.clef;
          structure.clefs[p] = c.sign + String(c.line) + (c.octaveChange < 0 ? 'v8' : '');
        }
        if (el.keyFifths !== undefined && structure.keyFifths === null) {
          structure.keyFifths = el.keyFifths;
        }
        if (el.time && structure.time === null) {
          structure.time = el.time;
        }
        continue;
      }
      if (el.kind === 'barline') {
        const mm = openMeasures[p];
        if (mm !== null && mm.events.length > 0) {
          mm.barline = {
            type: el.type,
            confidence: el.confidence,
            tokens: el.tokens,
            src: el.src,
          };
          openMeasures[p] = null;
        }
        continue;
      }
      open(p, st.system).events.push(el);
    }
  }

  return {
    irVersion: IR_VERSION,
    structure: { recognized: structure },
    parts,
    warnings,
  };
}
