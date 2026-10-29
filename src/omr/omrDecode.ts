/**
 * Decodificador CTC voraz (best-path) y ensamblador de representación intermedia (Score-IR)
 * a partir de los logits emitidos por el modelo CRNN-CTC sobre vocabulario Humdrum `**kern`.
 */

import { Step } from '../types/music';
import { mapBox, type Transform } from './omrGeometry';
import type { NotationEvidence } from './omrNotationGeometry';

export const IR_VERSION = '1.5';
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
  window?: { index: number; start: number; end: number; fullWidth: number; contextPrefix?: number };
  normalizedToOriginal?: Transform;
  partIndex?: number;
  assignmentAmbiguous?: boolean;
  partLabel?: string;
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
  normalizedRange?: [number, number];
  windowIndex?: number;
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
      tieCount?: number;
      slur?: 'start' | 'stop';
      fermata?: boolean;
      voice?: 1 | 2;
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
  warnings?: OmrWarning[];
  notationEvidence?: NotationEvidence[];
  hypotheses?: Array<{ staff: OmrStaffMeta; elements: OmrElementIR[] }>;
}

export interface OmrMeasureIR {
  index: number;
  page?: number;
  system: number;
  leftBarline?: OmrMeasureIR['barline'];
  attributeEvents?: Array<Extract<OmrElementIR, { kind: 'attribute' }>>;
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
  severity: 'warning' | 'error';
  provenance: 'observed' | 'inferred' | 'modified' | 'unsupported';
  src?: OmrSourceSpan;
  page?: number;
  system?: number;
  staff?: number;
  found?: number;
  expected?: number;
  tokens?: string[];
}

export interface OmrScoreIR {
  irVersion: string;
  indications?: import('./omrIndications').OmrIndication[];
  lines?: OmrDecodedLine[];
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

function expandCombinedKernToken(t: string): string[] {
  if (t.startsWith('*') || t.startsWith('=') || t === '<b>' || t === 'r' || t === ';') {
    return [t];
  }
  const m = t.match(/^([[\]_])?(\d+\.*)?([a-gA-G]+)(#{1,2}|-{1,2}|n)?([[\]_])?$/);
  if (m && (m[1] || m[2] || m[4] || m[5])) {
    const parts: string[] = [];
    if (m[1]) parts.push(m[1]);
    if (m[2]) parts.push(m[2]);
    if (m[3]) parts.push(m[3]);
    if (m[4]) parts.push(m[4]);
    if (m[5]) parts.push(m[5]);
    return parts;
  }
  return [t];
}

function classify(record: OmrTokenEvent[]): OmrElementIR | null {
  const rawToks = record.map((ev) => ev.token).filter(Boolean);
  if (rawToks.length === 0) return null;

  const toks: string[] = [];
  for (const t of rawToks) {
    if (t.includes(' ') && !t.startsWith('*')) {
      for (const sub of t.split(/\s+/).filter(Boolean)) {
        toks.push(...expandCombinedKernToken(sub));
      }
    } else {
      toks.push(...expandCombinedKernToken(t));
    }
  }
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
      return { kind: 'unparseable', tokens: toks, confidence: conf };
    }
    return el;
  }

  const voiceToken = toks.find(
    (t) => t === '*v1' || t === '*v2' || t === 'voice:1' || t === 'voice:2'
  );
  const voice: 1 | 2 | undefined = voiceToken ? (voiceToken.includes('2') ? 2 : 1) : undefined;

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
      fermata: toks.includes(';'),
      voice,
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
      } else if (i > 0 && toks[i - 1] in ACCIDENTALS && (i < 2 || !parsePitchToken(toks[i - 2]))) {
        alter = ACCIDENTALS[toks[i - 1]];
        rawAcc = toks[i - 1];
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

  const tieTokens = toks.filter((t) => t.includes('[') || t.includes(']') || t.includes('_'));
  const tieCount = tieTokens.length;

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
    tieCount,
    slur,
    fermata: toks.includes(';'),
    voice,
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
  if (staff.normalizedToOriginal) {
    return mapBox(staff.normalizedToOriginal, [
      WIDTH_REDUCTION * f0,
      0,
      WIDTH_REDUCTION * (f1 + 1 - f0),
      128,
    ]).map((v) => roundPy(v, 1)) as [number, number, number, number];
  }
  const x0 = staff.bbox[0] + WIDTH_REDUCTION * f0 * scale;
  const x1 = staff.bbox[0] + WIDTH_REDUCTION * (f1 + 1) * scale;
  return [roundPy(x0, 1), staff.bbox[1], roundPy(x1 - x0, 1), staff.bbox[3]];
}

export function lineFragment(tokenEvents: OmrTokenEvent[], staff: OmrStaffMeta): OmrElementIR[] {
  const out: OmrElementIR[] = [];
  for (const record of splitRecords(tokenEvents)) {
    const frameStart = Math.min(...record.map((e) => e.f0)) * WIDTH_REDUCTION;
    const frameEnd = (Math.max(...record.map((e) => e.f1)) + 1) * WIDTH_REDUCTION;
    const prefix = staff.window?.contextPrefix ?? 0;
    if (prefix && frameEnd <= prefix) continue;
    let el = classify(record);
    if (el === null) continue;
    if (prefix && frameStart < prefix && frameEnd > prefix)
      el = {
        kind: 'unparseable',
        tokens: record.map((event) => event.token),
        confidence: Math.min(...record.map((event) => event.confidence)),
      };
    el.tokens = record.map((ev) => ev.token);
    el.src = {
      page: staff.page,
      system: staff.system,
      staff: staff.staffIndex,
      bbox: bboxOf(
        prefix && frameStart < prefix
          ? record.map((event) => ({
              ...event,
              f0: Math.max(event.f0, prefix / WIDTH_REDUCTION),
              f1: Math.max(event.f1, prefix / WIDTH_REDUCTION),
            }))
          : record,
        staff
      ),
      ...(staff.window
        ? {
            normalizedRange: [
              staff.window.start + Math.max(frameStart, prefix) - prefix,
              staff.window.start + frameEnd - prefix,
            ] as [number, number],
            windowIndex: staff.window.index,
          }
        : {}),
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
  const expectedCount = counts.size ? modal([...counts.values()]) : 0;
  const maxStavesPerSystem = counts.size ? Math.max(...counts.values()) : 0;
  const m = counts.size
    ? Math.max(...lines.map((ln) => (ln.staff.partIndex ?? ln.staff.staffIndex) + 1))
    : 0;

  const warnings: OmrWarning[] = lines.flatMap((ln) => ln.warnings ?? []);
  const keys = [...counts.keys()].sort((a, b) => {
    const [pa, sa] = a.split('/').map(Number);
    const [pb, sb] = b.split('/').map(Number);
    return pa - pb || sa - sb;
  });

  for (const key of keys) {
    const [page, sysno] = key.split('/').map(Number);
    const n = counts.get(key) ?? 0;
    if (n !== expectedCount || maxStavesPerSystem !== expectedCount) {
      warnings.push({
        code: 'staff-assignment-uncertain',
        severity: 'warning',
        provenance: 'inferred',
        page,
        system: sysno,
        found: n,
        expected: expectedCount,
        message: `Página ${page}, sistema ${sysno}: ${n} pautas (habituales: ${expectedCount}); se conservan todas y la identidad de las partes requiere revisión.`,
      });
    }
  }

  const parts: OmrPartIR[] = [];
  for (let i = 0; i < m; i++) {
    parts.push({
      index: i,
      label:
        lines.find(
          (line) => (line.staff.partIndex ?? line.staff.staffIndex) === i && line.staff.partLabel
        )?.staff.partLabel ?? null,
      measures: [],
    });
  }
  const openMeasures: Array<OmrMeasureIR | null> = new Array(m).fill(null);
  const clefVotes: Array<Map<string, number>> = Array.from(
    { length: m },
    () => new Map<string, number>()
  );
  const structure = {
    stavesPerSystem: maxStavesPerSystem,
    clefs: new Array<string | null>(m).fill(null),
    keyFifths: null as number | null,
    time: null as OmrTimeIR | null,
  };

  const open = (p: number, page: number, system: number): OmrMeasureIR => {
    let mm = openMeasures[p];
    if (mm === null) {
      mm = { index: parts[p].measures.length, page, system, events: [] };
      parts[p].measures.push(mm);
      openMeasures[p] = mm;
    } else if (mm.events.length === 0) {
      mm.page = page;
      mm.system = system;
    }
    return mm;
  };

  for (const ln of [...lines].sort(
    (a, b) =>
      a.staff.page - b.staff.page ||
      a.staff.system - b.staff.system ||
      a.staff.staffIndex - b.staff.staffIndex
  )) {
    const st = ln.staff;
    const p = st.partIndex ?? st.staffIndex;
    if (st.truncated) {
      warnings.push({
        code: 'line-truncated',
        severity: 'error',
        provenance: 'modified',
        src: { page: st.page, system: st.system, staff: p, bbox: st.bbox },
        page: st.page,
        system: st.system,
        staff: p,
        message: `Página ${st.page}, sistema ${st.system}, pentagrama ${p + 1}: ancho truncado al límite máximo.`,
      });
    }
    const previous = openMeasures[p];
    if (
      previous &&
      previous.events.length &&
      (previous.page !== st.page || previous.system !== st.system)
    ) {
      warnings.push({
        code: 'measure-crosses-system',
        severity: 'warning',
        provenance: 'observed',
        src: { page: st.page, system: st.system, staff: p, bbox: st.bbox },
        message: 'Continúa un compás sin barra observada al cambiar de sistema; revisar la fuente.',
      });
    }

    for (const el of ln.elements) {
      if (el.kind === 'unparseable') {
        warnings.push({
          code: 'unparseable-tokens',
          severity: 'error',
          provenance: 'unsupported',
          src: el.src,
          page: st.page,
          system: st.system,
          staff: p,
          tokens: [...el.tokens],
          message: el.tokens.join(' '),
        });
        continue;
      }
      if (el.kind === 'attribute') {
        const mm = open(p, st.page, st.system);
        (mm.attributeEvents ??= []).push(el);
        if (mm.events.length) {
          warnings.push({
            code: 'attribute-inside-measure',
            severity: 'warning',
            provenance: 'unsupported',
            src: el.src,
            tokens: el.tokens,
            message:
              'Atributo dentro de un compás abierto: conservado en el IR, requiere revisar su posición.',
          });
          continue;
        }
        if (!mm.attributes) mm.attributes = {};
        if (el.clef) mm.attributes.clef = el.clef;
        if (el.keyFifths !== undefined) mm.attributes.keyFifths = el.keyFifths;
        if (el.time) mm.attributes.time = el.time;

        if (el.clef) {
          const c = el.clef;
          const clefKey = c.sign + String(c.line) + (c.octaveChange < 0 ? 'v8' : '');
          clefVotes[p].set(clefKey, (clefVotes[p].get(clefKey) || 0) + 1);
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
        const barline = {
          type: el.type,
          confidence: el.confidence,
          tokens: el.tokens,
          src: el.src,
        };
        if (mm !== null && mm.events.length > 0) {
          mm.barline = barline;
          openMeasures[p] = null;
          if (el.type === 'repeat-start' || el.type === 'repeat-both') {
            open(p, st.page, st.system).leftBarline = { ...barline, type: 'repeat-start' };
          }
        } else if (el.type === 'repeat-start' || el.type === 'repeat-both') {
          open(p, st.page, st.system).leftBarline = barline;
        } else if (el.type !== 'regular') {
          warnings.push({
            code: 'unattached-barline',
            severity: 'warning',
            provenance: 'unsupported',
            src: el.src,
            tokens: el.tokens,
            message:
              'Barra sin eventos entre límites: conservada en la línea original para revisión.',
          });
        }
        continue;
      }
      open(p, st.page, st.system).events.push(el);
    }
  }

  // Asignar clave canónica por consenso mayoritario de todas las líneas del pentagrama
  for (let p = 0; p < m; p++) {
    const votes = clefVotes[p];
    if (votes.size > 0) {
      let bestClef: string | null = null;
      let maxVotes = 0;
      for (const [cKey, count] of votes.entries()) {
        if (count > maxVotes) {
          maxVotes = count;
          bestClef = cKey;
        }
      }
      structure.clefs[p] = bestClef;
    }
  }

  return {
    irVersion: IR_VERSION,
    lines,
    structure: { recognized: structure },
    parts,
    warnings,
  };
}
