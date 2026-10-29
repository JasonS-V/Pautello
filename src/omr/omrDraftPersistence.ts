import type { Score } from '../types/music';
import { normalizeScore } from '../utils/scoreSchema';
import type { OmrResult } from './omrEngine';

export interface OmrDraft {
  version: 1;
  savedAt: number;
  score: Score;
  result: OmrResult;
  acceptedMeasureIds: string[];
  acceptedIndicationIds: string[];
  rejectedIndicationIds: string[];
  reviewedWarningIds: string[];
  reviewedMeasureIds: string[];
  manualEditMeasureIds: string[];
}

const DB_NAME = 'pautello_omr_drafts';
const MAX_CHARS = 24_000_000;
let writeQueue: Promise<void> = Promise.resolve();

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined')
      return reject(new Error('El almacenamiento local no está disponible.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function writeOmrDraft(draft: OmrDraft): Promise<void> {
  if (JSON.stringify(draft).length > MAX_CHARS)
    throw new Error(
      'El borrador y sus imágenes superan el límite local de 24 millones de caracteres.'
    );
  const db = await openDraftDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').put(draft, 'active');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function saveOmrDraft(draft: OmrDraft): Promise<void> {
  writeQueue = writeQueue.catch(() => {}).then(() => writeOmrDraft(draft));
  return writeQueue;
}

export async function loadOmrDraft(): Promise<OmrDraft | null> {
  const db = await openDraftDb();
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readonly');
      const request = tx.objectStore('drafts').get('active');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!value || typeof value !== 'object') return null;
    const draft = value as OmrDraft;
    if (draft.version !== 1 || !draft.result || !Array.isArray(draft.result.warnings)) return null;
    const score = normalizeScore(draft.score);
    if (!score) return null;
    return {
      ...draft,
      score,
      acceptedMeasureIds: draft.acceptedMeasureIds ?? [],
      acceptedIndicationIds: draft.acceptedIndicationIds ?? [],
      rejectedIndicationIds: draft.rejectedIndicationIds ?? [],
      reviewedWarningIds: draft.reviewedWarningIds ?? [],
      reviewedMeasureIds: draft.reviewedMeasureIds ?? [],
      manualEditMeasureIds: draft.manualEditMeasureIds ?? [],
    };
  } finally {
    db.close();
  }
}

export async function clearOmrDraft(): Promise<void> {
  const db = await openDraftDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').delete('active');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
