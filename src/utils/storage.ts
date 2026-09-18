import { Score, KeySignature, TimeSignature, KeyboardInputMode } from '../types/music';
import { TEMPLATES } from '../constants/templates';
import { normalizeScore } from './scoreSchema';

export const STORAGE_KEY = 'pautello_active_score';
export const THEME_KEY = 'pautello_theme';
export const NAMING_KEY = 'pautello_naming_convention';
export const KEYBOARD_MODE_KEY = 'pautello_keyboard_input_mode';

export const DB_NAME = 'pautello_scores_db';
export const DB_VERSION = 1;
export const STORE_NAME = 'scores';
export const LIBRARY_INDEX_KEY = 'pautello_library_index';
export const LIBRARY_SCORE_PREFIX = 'pautello_library_score_';

/** Bases IndexedDB de versiones anteriores; se copian una sola vez al abrir. */
const LEGACY_DB_NAMES = ['stavio_scores_db', 'sonata_scores_db'];

/** Prefijo del proyecto en las claves persistidas. */
const STORAGE_PREFIX = 'pautello_';
/** Prefijos heredados: se siguen leyendo para no perder datos de otras versiones. */
const LEGACY_STORAGE_PREFIXES = ['stavio_', 'sonata_'];

const IDB_MIGRATED_KEY = 'pautello_idb_migrated';
const FALLBACK_INITIALIZED_KEY = 'pautello_fallback_initialized';
const LEGACY_DB_MIGRATED_KEY = 'pautello_legacy_db_migrated';

/** Claves heredadas equivalentes a `key` (mismo sufijo, otro prefijo). */
function legacyStorageKeys(key: string): string[] {
  if (!key.startsWith(STORAGE_PREFIX)) return [];
  const suffix = key.slice(STORAGE_PREFIX.length);
  return LEGACY_STORAGE_PREFIXES.map((prefix) => `${prefix}${suffix}`);
}

/**
 * Lee `key` y, si no existe, rescata el valor de la clave heredada equivalente
 * escribiéndolo en la clave nueva. Así la migración ocurre sola, una vez, sin
 * perder partituras ni preferencias guardadas con el nombre anterior.
 */
function readStoredValue(storage: Storage, key: string): string | null {
  let value: string | null;
  try {
    value = storage.getItem(key);
  } catch {
    return null;
  }
  if (value !== null) return value;

  for (const legacyKey of legacyStorageKeys(key)) {
    let legacyValue: string | null;
    try {
      legacyValue = storage.getItem(legacyKey);
    } catch {
      continue;
    }
    if (legacyValue === null) continue;
    try {
      storage.setItem(key, legacyValue);
    } catch {
      // Sin espacio para duplicar: se usa igualmente el valor heredado.
    }
    return legacyValue;
  }

  return null;
}

/** Elimina `key` y sus variantes heredadas para que no reaparezcan al leer. */
function removeStoredValue(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Almacenamiento no disponible
  }
  for (const legacyKey of legacyStorageKeys(key)) {
    try {
      storage.removeItem(legacyKey);
    } catch {
      // Almacenamiento no disponible
    }
  }
}

export interface ScoreMetadata {
  id: string;
  title: string;
  composer: string;
  updatedAt: number;
  createdAt: number;
  measuresCount: number;
  stavesCount: number;
  keySignature: KeySignature;
  timeSignature: TimeSignature;
  tempo: number;
}

/**
 * Presupuesto de caracteres del almacenamiento local. Los navegadores rondan
 * 5 millones de caracteres por origen (el doble en bytes, porque JavaScript usa
 * UTF-16); se usa el presupuesto conservador para avisar antes de chocar.
 */
export const STORAGE_BUDGET_CHARS = 5_000_000;

/** A partir de aqui se considera que la partitura esta cerca del limite. */
export const STORAGE_WARN_RATIO = 0.8;

export type StorageFailureReason = 'quota' | 'unavailable' | 'unknown';

export type StorageWriteResult =
  | { ok: true; chars: number; usageRatio: number }
  | { ok: false; reason: StorageFailureReason; chars: number; usageRatio: number; error?: unknown };

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: string; code?: number; message?: string };
  return (
    candidate.name === 'QuotaExceededError' ||
    candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate.code === 22 ||
    candidate.code === 1014
  );
}

/** Tamano serializado de una partitura, en caracteres. */
export function measureScoreChars(score: Score): number {
  try {
    return JSON.stringify(score).length;
  } catch {
    return 0;
  }
}

/** Proporcion del presupuesto de almacenamiento ya ocupada por la partitura. */
export function getStorageUsageRatio(chars: number): number {
  if (chars <= 0) return 0;
  return Math.min(1, chars / STORAGE_BUDGET_CHARS);
}

/**
 * Guarda la partitura. Nunca lanza: devuelve un resultado que quien llama debe
 * convertir en aviso para el usuario. Antes cualquier fallo (cuota agotada,
 * almacenamiento bloqueado) solo dejaba un `console.warn` y el usuario creia
 * que su trabajo estaba a salvo.
 */
export function saveScoreToStorage(score: Score): StorageWriteResult {
  const chars = measureScoreChars(score);
  const usageRatio = getStorageUsageRatio(chars);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(score));
    saveScoreToLibrary(score).catch(() => {});
    return { ok: true, chars, usageRatio };
  } catch (error) {
    const reason: StorageFailureReason = isQuotaError(error)
      ? 'quota'
      : error instanceof Error
        ? 'unavailable'
        : 'unknown';
    console.warn('No se pudo guardar la partitura en el almacenamiento local:', error);
    return { ok: false, reason, chars, usageRatio, error };
  }
}

/**
 * Partitura autoguardada, validada y migrada. Si el contenido guardado no se
 * puede interpretar se devuelve la plantilla inicial (normalizada, no por
 * referencia, para que nadie contamine TEMPLATES).
 */
export function loadScoreFromStorage(): Score {
  try {
    const storage = getLocalStorage();
    const data = storage ? readStoredValue(storage, STORAGE_KEY) : null;
    if (data) {
      const score = normalizeScore(JSON.parse(data));
      if (score) return score;
      console.warn('La partitura guardada no se pudo recuperar; se carga la plantilla inicial.');
    }
  } catch (error) {
    console.warn('No se pudo leer la partitura guardada:', error);
  }
  return normalizeScore(TEMPLATES[0].score) ?? TEMPLATES[0].score;
}

export interface StorageDiagnostics {
  hasStoredScore: boolean;
  chars: number;
  usageRatio: number;
  nearLimit: boolean;
}

/** Estado del almacenamiento, para mostrarlo en la barra de estado. */
export function readStorageDiagnostics(score: Score): StorageDiagnostics {
  const chars = measureScoreChars(score);
  const usageRatio = getStorageUsageRatio(chars);
  let hasStoredScore: boolean;
  try {
    const storage = getLocalStorage();
    hasStoredScore = storage ? readStoredValue(storage, STORAGE_KEY) !== null : false;
  } catch {
    hasStoredScore = false;
  }
  return {
    hasStoredScore,
    chars,
    usageRatio,
    nearLimit: usageRatio >= STORAGE_WARN_RATIO,
  };
}

/**
 * Devuelve la partitura autoguardada en crudo (texto JSON), sin interpretarla.
 * Se usa para rescatar el trabajo del usuario cuando la app falla al dibujarla.
 */
export function readStoredScoreJson(): string | null {
  try {
    const storage = getLocalStorage();
    return storage ? readStoredValue(storage, STORAGE_KEY) : null;
  } catch (error) {
    console.warn('No se pudo leer la partitura guardada:', error);
    return null;
  }
}

/** Elimina la partitura autoguardada (la app arranca con la plantilla inicial). */
export function clearStoredScore(): void {
  try {
    const storage = getLocalStorage();
    if (storage) removeStoredValue(storage, STORAGE_KEY);
  } catch (error) {
    console.warn('No se pudo borrar la partitura guardada:', error);
  }
}

export function saveThemePreference(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.warn('No se pudo guardar la preferencia de tema:', error);
  }
}

export function loadThemePreference(): 'dark' | 'light' {
  try {
    const storage = getLocalStorage();
    const stored = storage ? readStoredValue(storage, THEME_KEY) : null;
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // sin preferencia guardada: valor por defecto
  }
  return 'dark';
}

export function saveNamingPreference(naming: 'latin' | 'english'): void {
  try {
    localStorage.setItem(NAMING_KEY, naming);
  } catch (error) {
    console.warn('No se pudo guardar la preferencia de nombres:', error);
  }
}

export function loadNamingPreference(): 'latin' | 'english' {
  try {
    const storage = getLocalStorage();
    const stored = storage ? readStoredValue(storage, NAMING_KEY) : null;
    if (stored === 'latin' || stored === 'english') return stored;
  } catch {
    // sin preferencia guardada: valor por defecto
  }
  return 'latin';
}

export function saveKeyboardModePreference(mode: KeyboardInputMode): void {
  try {
    localStorage.setItem(KEYBOARD_MODE_KEY, mode);
  } catch (error) {
    console.warn('No se pudo guardar la preferencia de modo de teclado:', error);
  }
}

export function loadKeyboardModePreference(): KeyboardInputMode {
  try {
    const storage = getLocalStorage();
    const stored = storage ? readStoredValue(storage, KEYBOARD_MODE_KEY) : null;
    if (stored === 'piano' || stored === 'notation') return stored;
  } catch {
    // sin preferencia guardada: valor por defecto
  }
  return 'piano';
}

/** Extrae los metadatos esenciales de una partitura para listados ligeros */
export function extractScoreMetadata(score: Score): ScoreMetadata {
  const measuresCount = score.staves?.[0]?.measures?.length ?? 0;
  return {
    id: score.id || `score-${Date.now()}`,
    title: score.title || 'Sin título',
    composer: score.composer || 'Desconocido',
    updatedAt: score.updatedAt || Date.now(),
    createdAt: score.createdAt || score.updatedAt || Date.now(),
    measuresCount,
    stavesCount: score.staves?.length || 1,
    keySignature: score.keySignature || 'C',
    timeSignature: score.timeSignature || { beats: 4, beatType: 4 },
    tempo: score.tempo || 120,
  };
}

function getIndexedDB(): IDBFactory | null {
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      return window.indexedDB;
    }
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB
    ) {
      return (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB;
    }
  } catch {
    // Entorno sin acceso a IndexedDB
  }
  return null;
}

export function isIndexedDBAvailable(): boolean {
  return getIndexedDB() !== null;
}

function openDatabase(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error('IndexedDB no está disponible en este entorno'));
  }

  return new Promise((resolve, reject) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Error al abrir IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB bloqueada'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Abre una base heredada solo si ya existe. Si no existe, IndexedDB dispararía
 * `onupgradeneeded` para crearla; se aborta ahí para no dejar bases vacías con
 * el nombre antiguo ni crear la base nueva antes de tiempo.
 */
type LegacyDatabaseOpenResult =
  | { status: 'open'; db: IDBDatabase }
  /** La base heredada no existe en este navegador. */
  | { status: 'missing' }
  /** Otra pestaña la mantiene bloqueada: la migración debe reintentarse luego. */
  | { status: 'blocked' };

function openLegacyDatabase(name: string): Promise<LegacyDatabaseOpenResult> {
  const idb = getIndexedDB();
  if (!idb) return Promise.resolve({ status: 'missing' });

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = idb.open(name);
    } catch {
      resolve({ status: 'missing' });
      return;
    }

    request.onupgradeneeded = () => {
      try {
        request.transaction?.abort();
      } catch {
        // Ignorar: si no se puede abortar, la base quedará vacía y se ignorará.
      }
    };
    request.onsuccess = () => resolve({ status: 'open', db: request.result });
    request.onerror = () => resolve({ status: 'missing' });
    request.onblocked = () => resolve({ status: 'blocked' });
  });
}

/** Lee todas las partituras de una base (con fallback a cursor si no hay `getAll`). */
function getAllScores(db: IDBDatabase): Promise<Score[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    if (typeof store.getAll === 'function') {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      return;
    }
    const results: Score[] = [];
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

function getScoreById(db: IDBDatabase, id: string): Promise<Score | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve((req.result as Score | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

function putScore(db: IDBDatabase, score: Score): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(score);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Copia una sola vez las partituras de las bases IndexedDB de versiones
 * anteriores (`sonata_scores_db`, `stavio_scores_db`) a la base actual. No
 * borra las bases heredadas: quien vuelva a una versión previa conserva su
 * biblioteca intacta.
 */
async function migrateLegacyDatabases(target: IDBDatabase, storage: Storage): Promise<void> {
  if (readStoredValue(storage, LEGACY_DB_MIGRATED_KEY) === 'true') return;

  let wasBlocked = false;

  for (const name of LEGACY_DB_NAMES) {
    const result = await openLegacyDatabase(name);
    if (result.status === 'blocked') {
      wasBlocked = true;
      continue;
    }
    if (result.status !== 'open') continue;

    const legacy = result.db;
    try {
      const records = await getAllScores(legacy);
      for (const record of records) {
        const normalized = normalizeScore(record);
        if (!normalized?.id) continue;
        // Sin sobrescribir: lo que ya vive en la base actual manda.
        if (await getScoreById(target, normalized.id)) continue;
        await putScore(target, normalized);
      }
    } catch {
      // Una base heredada ilegible no debe impedir abrir la biblioteca actual.
    } finally {
      legacy.close();
    }
  }

  // Con una base bloqueada no se marca la migración: se reintenta al reabrir.
  if (wasBlocked) return;

  try {
    storage.setItem(LEGACY_DB_MIGRATED_KEY, 'true');
  } catch {
    // Sin espacio: se reintentará en la próxima sesión.
  }
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { localStorage?: Storage }).localStorage
    ) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    // Almacenamiento local bloqueado o no disponible
  }
  return null;
}

function getFallbackIndex(): ScoreMetadata[] {
  const storage = getLocalStorage();
  if (!storage) return [];
  try {
    const raw = readStoredValue(storage, LIBRARY_INDEX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error al leer índice de biblioteca fallback:', e);
  }
  return [];
}

function saveFallbackIndex(index: ScoreMetadata[]): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(LIBRARY_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn('Error al guardar índice de biblioteca fallback:', e);
  }
}

/**
 * Lista los metadatos de todas las partituras guardadas en la biblioteca.
 * Usa IndexedDB si está disponible con fallback automático y transparente a localStorage.
 */
export async function listLibraryScores(): Promise<ScoreMetadata[]> {
  try {
    const db = await openDatabase();

    // Antes de leer nada, trae al día las bibliotecas guardadas con el nombre
    // anterior del proyecto.
    const storage = getLocalStorage();
    if (storage) {
      await migrateLegacyDatabases(db, storage);
    }

    const scores = await getAllScores(db);

    const isMigrated = storage ? readStoredValue(storage, IDB_MIGRATED_KEY) : null;

    // Primera vez abriendo IndexedDB: si la BD está vacía y nunca se ha migrado, importar la partitura activa si existe
    if (scores.length === 0 && !isMigrated && storage) {
      const activeRaw = readStoredValue(storage, STORAGE_KEY);
      if (activeRaw) {
        try {
          const parsed = JSON.parse(activeRaw) as Score;
          const normalized = normalizeScore(parsed);
          if (normalized) {
            const scoreToMigrate: Score = {
              ...normalized,
              id: normalized.id || `score-${Date.now()}`,
              updatedAt: normalized.updatedAt || Date.now(),
            };
            await new Promise<void>((res, rej) => {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              const putReq = store.put(scoreToMigrate);
              putReq.onsuccess = () => res();
              putReq.onerror = () => rej(putReq.error);
            });
            storage.setItem(IDB_MIGRATED_KEY, 'true');
            return [extractScoreMetadata(scoreToMigrate)];
          }
        } catch {
          // Ignorar
        }
      }
      storage.setItem(IDB_MIGRATED_KEY, 'true');
      return [];
    }

    storage?.setItem(IDB_MIGRATED_KEY, 'true');
    const list = scores.map(extractScoreMetadata);
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  } catch {
    // Continuar a fallback si IndexedDB falla o no está disponible
  }

  // Fallback a localStorage
  const storage = getLocalStorage();
  const list = getFallbackIndex();
  if (list.length === 0 && storage) {
    const initialized = readStoredValue(storage, FALLBACK_INITIALIZED_KEY);
    if (!initialized) {
      const activeRaw = readStoredValue(storage, STORAGE_KEY);
      if (activeRaw) {
        try {
          const parsed = JSON.parse(activeRaw) as Score;
          const normalized = normalizeScore(parsed);
          if (normalized) {
            const meta = extractScoreMetadata(normalized);
            list.push(meta);
            saveFallbackIndex(list);
            storage.setItem(LIBRARY_SCORE_PREFIX + normalized.id, JSON.stringify(normalized));
          }
        } catch {
          // Ignorar
        }
      }
      storage.setItem(FALLBACK_INITIALIZED_KEY, 'true');
    }
  }

  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return list;
}

export const listScoresFromLibrary = listLibraryScores;

/**
 * Carga una partitura completa por su ID desde la biblioteca.
 */
export async function loadScoreFromLibrary(id: string): Promise<Score | null> {
  try {
    const db = await openDatabase();
    const raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });

    if (raw) {
      const normalized = normalizeScore(raw);
      if (normalized) return normalized;
    }
  } catch {
    // Continuar a fallback
  }

  // Fallback localStorage
  const storage = getLocalStorage();
  if (storage) {
    try {
      const data = readStoredValue(storage, LIBRARY_SCORE_PREFIX + id);
      if (data) {
        const parsed = JSON.parse(data);
        const normalized = normalizeScore(parsed);
        if (normalized) return normalized;
      }

      const activeRaw = readStoredValue(storage, STORAGE_KEY);
      if (activeRaw) {
        const parsedActive = JSON.parse(activeRaw) as Score;
        if (parsedActive && parsedActive.id === id) {
          const normalized = normalizeScore(parsedActive);
          if (normalized) return normalized;
        }
      }
    } catch (e) {
      console.warn(`Error al cargar partitura ${id} desde fallback:`, e);
    }
  }

  return null;
}

/**
 * Guarda o actualiza una partitura en la biblioteca.
 */
export async function saveScoreToLibrary(score: Score): Promise<{ ok: boolean; error?: unknown }> {
  const normalized = normalizeScore(score) ?? score;
  const scoreToSave: Score = {
    ...normalized,
    id: normalized.id || `score-${Date.now()}`,
    updatedAt: Date.now(),
  };
  const meta = extractScoreMetadata(scoreToSave);

  let idbSaved = false;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(scoreToSave);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    idbSaved = true;
  } catch {
    // Fallback
  }

  // Si IndexedDB falló o no está disponible, guardar el contenido completo en localStorage como fallback.
  // Si IndexedDB funcionó, solo mantenemos el índice liviano en localStorage para no agotar la cuota de 5MB.
  const storage = getLocalStorage();
  if (storage) {
    if (!idbSaved) {
      try {
        storage.setItem(LIBRARY_SCORE_PREFIX + scoreToSave.id, JSON.stringify(scoreToSave));
      } catch {
        // Ignorar si cuota llena
      }
    }
    const list = getFallbackIndex().filter((m) => m.id !== scoreToSave.id);
    list.unshift(meta);
    saveFallbackIndex(list);
  }

  return { ok: idbSaved || storage !== null };
}

/**
 * Elimina una partitura de la biblioteca por su ID.
 */
export async function deleteScoreFromLibrary(id: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Continuar a fallback
  }

  const storage = getLocalStorage();
  if (storage) {
    try {
      removeStoredValue(storage, LIBRARY_SCORE_PREFIX + id);
      const activeRaw = readStoredValue(storage, STORAGE_KEY);
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw) as Score;
        if (parsed && parsed.id === id) {
          removeStoredValue(storage, STORAGE_KEY);
        }
      }
    } catch {
      // Ignorar
    }
    const list = getFallbackIndex().filter((m) => m.id !== id);
    saveFallbackIndex(list);
  }

  return true;
}

/**
 * Duplica una partitura existente generando una copia con nuevo ID y fecha.
 */
export async function duplicateScoreInLibrary(
  id: string,
  newTitle?: string
): Promise<Score | null> {
  const original = await loadScoreFromLibrary(id);
  if (!original) return null;

  const now = Date.now();
  const cloned: Score = JSON.parse(JSON.stringify(original));
  cloned.id = `score-${now}-${Math.random().toString(36).substr(2, 5)}`;
  const baseTitle = original.title?.trim() || 'Sin título';
  cloned.title = newTitle?.trim() || `${baseTitle} (Copia)`;
  cloned.createdAt = now;
  cloned.updatedAt = now;

  await saveScoreToLibrary(cloned);
  return cloned;
}

/**
 * Renombra el título de una partitura en la biblioteca.
 */
export async function renameScoreInLibrary(id: string, newTitle: string): Promise<boolean> {
  const score = await loadScoreFromLibrary(id);
  if (!score) return false;

  score.title = newTitle.trim() || 'Sin título';
  score.updatedAt = Date.now();

  await saveScoreToLibrary(score);

  // Si coincide con la partitura activa actual en localStorage, sincronizarla
  const storage = getLocalStorage();
  if (storage) {
    try {
      const activeRaw = readStoredValue(storage, STORAGE_KEY);
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw) as Score;
        if (parsed && parsed.id === id) {
          parsed.title = score.title;
          parsed.updatedAt = score.updatedAt;
          storage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      }
    } catch {
      // Ignorar
    }
  }

  return true;
}
