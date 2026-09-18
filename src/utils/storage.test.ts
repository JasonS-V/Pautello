import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TEMPLATES } from '../constants/templates';
import {
  clearStoredScore,
  loadScoreFromStorage,
  loadThemePreference,
  loadNamingPreference,
  loadKeyboardModePreference,
  readStoredScoreJson,
  saveScoreToStorage,
  listLibraryScores,
  loadScoreFromLibrary,
  saveScoreToLibrary,
  deleteScoreFromLibrary,
  duplicateScoreInLibrary,
  renameScoreInLibrary,
  extractScoreMetadata,
} from './storage';
import { SCORE_SCHEMA_VERSION } from './scoreSchema';

const STORAGE_KEY = 'pautello_active_score';
const TARGET_DB_NAME = 'pautello_scores_db';

const globalWithStorage = globalThis as unknown as { localStorage?: Storage };

function createMemoryStorage() {
  const entries = new Map<string, string>();
  const storage: Storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    clear: () => entries.clear(),
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  };
  return { storage, entries };
}

const setStoredValue = (value: string | null) => {
  const { storage, entries } = createMemoryStorage();
  if (value !== null) entries.set(STORAGE_KEY, value);
  globalWithStorage.localStorage = storage;
};

beforeEach(() => {
  globalWithStorage.localStorage = createMemoryStorage().storage;
});

afterEach(() => {
  delete globalWithStorage.localStorage;
});

describe('storage: ida y vuelta', () => {
  it('devuelve la partitura guardada tal cual la escribió la app', () => {
    const score = TEMPLATES[0].score;
    saveScoreToStorage(score);

    const loaded = loadScoreFromStorage();

    expect(loaded.title).toBe(score.title);
    expect(loaded.composer).toBe(score.composer);
    expect(loaded.staves).toHaveLength(score.staves.length);
    expect(loaded.schemaVersion).toBe(SCORE_SCHEMA_VERSION);
  });

  it('escribe la partitura como JSON en la clave esperada', () => {
    saveScoreToStorage({ ...TEMPLATES[0].score, title: 'Mi obra' });

    const raw = globalWithStorage.localStorage!.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect((JSON.parse(raw!) as { title: string }).title).toBe('Mi obra');
  });

  it('no falla si el almacenamiento rechaza la escritura', () => {
    globalWithStorage.localStorage = {
      ...createMemoryStorage().storage,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    expect(() => saveScoreToStorage(TEMPLATES[0].score)).not.toThrow();
  });
});

describe('storage: migración y reparación', () => {
  it('migra una partitura guardada por una versión anterior', () => {
    setStoredValue(
      JSON.stringify({
        id: 'old',
        title: 'Antigua',
        composer: 'Anónimo',
        tempo: 90,
        timeSignature: { beats: 3, beatType: 4 },
        keySignature: 'G',
        staves: [
          {
            id: 'staff-1',
            name: 'Mano Derecha',
            clef: 'treble',
            measures: [{ id: 'm-1', items: [] }],
          },
          {
            id: 'staff-2',
            name: 'Mano Izquierda',
            clef: 'bass',
            measures: [{ id: 'm-2', items: [] }],
          },
        ],
      })
    );

    const loaded = loadScoreFromStorage();

    expect(loaded.title).toBe('Antigua');
    expect(loaded.tempo).toBe(90);
    expect(loaded.timeSignature).toEqual({ beats: 3, beatType: 4 });
    expect(loaded.isGrandStaff).toBe(true);
    expect(loaded.schemaVersion).toBe(SCORE_SCHEMA_VERSION);
  });

  it('repara un compás vacío en vez de dejar la app sin notas que dibujar', () => {
    setStoredValue(JSON.stringify({ staves: [{ measures: [{ items: [] }] }] }));

    const loaded = loadScoreFromStorage();

    expect(loaded.staves[0].measures[0].items).toHaveLength(1);
    expect(loaded.staves[0].measures[0].items[0].type).toBe('rest');
  });
});

describe('storage: migración desde las claves con el nombre anterior', () => {
  it('rescata la partitura activa guardada como sonata_active_score', () => {
    const { storage, entries } = createMemoryStorage();
    entries.set(
      'sonata_active_score',
      JSON.stringify({ ...TEMPLATES[0].score, title: 'Heredada' })
    );
    globalWithStorage.localStorage = storage;

    expect(loadScoreFromStorage().title).toBe('Heredada');
    // La clave nueva se rellena para que la migración ocurra una sola vez.
    expect(entries.has('pautello_active_score')).toBe(true);
  });

  it('rescata preferencias guardadas con claves heredadas', () => {
    const { storage, entries } = createMemoryStorage();
    entries.set('sonata_theme', 'light');
    entries.set('stavio_naming_convention', 'english');
    entries.set('sonata_keyboard_input_mode', 'notation');
    globalWithStorage.localStorage = storage;

    expect(loadThemePreference()).toBe('light');
    expect(loadNamingPreference()).toBe('english');
    expect(loadKeyboardModePreference()).toBe('notation');
  });

  it('borra también las claves heredadas para que no reaparezca la partitura', () => {
    const { storage, entries } = createMemoryStorage();
    entries.set(
      'sonata_active_score',
      JSON.stringify({ ...TEMPLATES[0].score, title: 'Heredada' })
    );
    globalWithStorage.localStorage = storage;

    clearStoredScore();

    expect(loadScoreFromStorage().title).toBe(TEMPLATES[0].score.title);
  });

  it('encuentra una partitura de biblioteca guardada con el prefijo heredado', async () => {
    const { storage, entries } = createMemoryStorage();
    const score = { ...TEMPLATES[0].score, id: 'legacy-lib', title: 'Biblioteca heredada' };
    entries.set('sonata_library_score_legacy-lib', JSON.stringify(score));
    globalWithStorage.localStorage = storage;

    const loaded = await loadScoreFromLibrary('legacy-lib');
    expect(loaded?.title).toBe('Biblioteca heredada');
  });
});

describe('storage: respaldo y copia de la plantilla', () => {
  it('carga la plantilla inicial si no hay nada guardado', () => {
    expect(loadScoreFromStorage().title).toBe(TEMPLATES[0].score.title);
  });

  it('carga la plantilla inicial si el JSON está corrupto', () => {
    setStoredValue('{ esto no es JSON');
    expect(loadScoreFromStorage().title).toBe(TEMPLATES[0].score.title);
  });

  it('carga la plantilla inicial si el contenido no es una partitura', () => {
    const invalidContents = ['null', '"hola"', '42', '[]', '{}', '{"staves":[]}', '{"staves":[3]}'];

    invalidContents.forEach((content) => {
      setStoredValue(content);
      expect(loadScoreFromStorage().title).toBe(TEMPLATES[0].score.title);
    });
  });

  it('carga la plantilla inicial si el almacenamiento no se puede leer', () => {
    globalWithStorage.localStorage = {
      ...createMemoryStorage().storage,
      getItem: () => {
        throw new Error('SecurityError');
      },
    };

    expect(() => loadScoreFromStorage()).not.toThrow();
    expect(loadScoreFromStorage().title).toBe(TEMPLATES[0].score.title);
  });

  it('no devuelve la plantilla compartida por referencia', () => {
    const first = loadScoreFromStorage();
    const second = loadScoreFromStorage();

    expect(first).not.toBe(second);
    expect(first.staves[0]).not.toBe(TEMPLATES[0].score.staves[0]);

    first.title = 'Mutada';
    first.staves[0].name = 'Mutado';
    expect(TEMPLATES[0].score.title).not.toBe('Mutada');
    expect(TEMPLATES[0].score.staves[0].name).not.toBe('Mutado');
  });
});

describe('storage: rescate del autoguardado', () => {
  it('devuelve el JSON en crudo sin interpretarlo', () => {
    saveScoreToStorage(TEMPLATES[0].score);

    const raw = readStoredScoreJson();

    expect(JSON.parse(raw!).title).toBe(TEMPLATES[0].score.title);
  });

  it('devuelve el contenido aunque esté corrupto, para poder rescatarlo', () => {
    setStoredValue('{ roto');
    expect(readStoredScoreJson()).toBe('{ roto');
  });

  it('devuelve null si no hay nada guardado o no se puede leer', () => {
    expect(readStoredScoreJson()).toBeNull();

    globalWithStorage.localStorage = {
      ...createMemoryStorage().storage,
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(readStoredScoreJson()).toBeNull();
  });

  it('borra la partitura guardada y vuelve a la plantilla inicial', () => {
    saveScoreToStorage({ ...TEMPLATES[0].score, title: 'Mi obra' });
    expect(loadScoreFromStorage().title).toBe('Mi obra');

    clearStoredScore();

    expect(readStoredScoreJson()).toBeNull();
    expect(loadScoreFromStorage().title).toBe(TEMPLATES[0].score.title);
  });

  it('no falla si el almacenamiento rechaza el borrado', () => {
    globalWithStorage.localStorage = {
      ...createMemoryStorage().storage,
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };

    expect(() => clearStoredScore()).not.toThrow();
  });
});

describe('storage: biblioteca de proyectos (fallback localStorage)', () => {
  it('extrae metadatos precisos de una partitura', () => {
    const meta = extractScoreMetadata(TEMPLATES[0].score);
    expect(meta.id).toBe(TEMPLATES[0].score.id);
    expect(meta.title).toBe(TEMPLATES[0].score.title);
    expect(meta.composer).toBe(TEMPLATES[0].score.composer);
    expect(meta.measuresCount).toBe(TEMPLATES[0].score.staves[0].measures.length);
    expect(meta.stavesCount).toBe(TEMPLATES[0].score.staves.length);
    expect(meta.keySignature).toBe('C');
    expect(meta.tempo).toBe(TEMPLATES[0].score.tempo);
  });

  it('lista la partitura activa existente cuando la biblioteca está vacía', async () => {
    saveScoreToStorage({ ...TEMPLATES[0].score, id: 'score-active-1', title: 'Partitura Única' });

    const list = await listLibraryScores();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(
      list.some((item) => item.id === 'score-active-1' && item.title === 'Partitura Única')
    ).toBe(true);
  });

  it('guarda, lista y carga múltiples partituras en la biblioteca', async () => {
    const score1 = { ...TEMPLATES[0].score, id: 'obra-1', title: 'Primera Obra' };
    const score2 = { ...TEMPLATES[0].score, id: 'obra-2', title: 'Segunda Obra' };

    await saveScoreToLibrary(score1);
    await saveScoreToLibrary(score2);

    const list = await listLibraryScores();
    expect(list.some((s) => s.id === 'obra-1')).toBe(true);
    expect(list.some((s) => s.id === 'obra-2')).toBe(true);

    const loaded1 = await loadScoreFromLibrary('obra-1');
    expect(loaded1).not.toBeNull();
    expect(loaded1?.title).toBe('Primera Obra');

    const loaded2 = await loadScoreFromLibrary('obra-2');
    expect(loaded2).not.toBeNull();
    expect(loaded2?.title).toBe('Segunda Obra');
  });

  it('duplica una partitura con nuevo id y sufijo (Copia)', async () => {
    const original = { ...TEMPLATES[0].score, id: 'base-score', title: 'Tema Principal' };
    await saveScoreToLibrary(original);

    const copy = await duplicateScoreInLibrary('base-score');
    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe('base-score');
    expect(copy?.title).toBe('Tema Principal (Copia)');

    const list = await listLibraryScores();
    expect(list.some((s) => s.id === copy?.id)).toBe(true);
    expect(list.some((s) => s.id === 'base-score')).toBe(true);
  });

  it('renombra una partitura en la biblioteca y sincroniza la activa', async () => {
    const score = { ...TEMPLATES[0].score, id: 'score-renombrar', title: 'Boceto 1' };
    await saveScoreToLibrary(score);
    saveScoreToStorage(score); // Marcada como activa

    const success = await renameScoreInLibrary('score-renombrar', 'Sinfonía Terminada');
    expect(success).toBe(true);

    const loaded = await loadScoreFromLibrary('score-renombrar');
    expect(loaded?.title).toBe('Sinfonía Terminada');

    // La activa también debe haberse sincronizado
    const active = loadScoreFromStorage();
    expect(active.title).toBe('Sinfonía Terminada');
  });

  it('elimina una partitura de la biblioteca', async () => {
    const score = { ...TEMPLATES[0].score, id: 'a-borrar', title: 'Temporal' };
    await saveScoreToLibrary(score);

    let list = await listLibraryScores();
    expect(list.some((s) => s.id === 'a-borrar')).toBe(true);

    const deleted = await deleteScoreFromLibrary('a-borrar');
    expect(deleted).toBe(true);

    list = await listLibraryScores();
    expect(list.some((s) => s.id === 'a-borrar')).toBe(false);

    const loaded = await loadScoreFromLibrary('a-borrar');
    expect(loaded).toBeNull();
  });
});

describe('storage: biblioteca con IndexedDB nativo simulado', () => {
  const globalWithIdb = globalThis as unknown as { indexedDB?: IDBFactory };

  /** Base simulada con soporte para varias bases IndexedDB nombradas. */
  function createMockDatabase(memoryStore: Map<string, unknown>): IDBDatabase {
    return {
      objectStoreNames: {
        contains: (name: string) => name === 'scores',
      },
      close: () => {},
      createObjectStore: () => ({
        createIndex: () => {},
      }),
      transaction: () => ({
        objectStore: () => ({
          getAll: () => {
            const req = {
              result: Array.from(memoryStore.values()),
              onsuccess: null as ((e: unknown) => void) | null,
              onerror: null as ((e: unknown) => void) | null,
            };
            setTimeout(() => req.onsuccess?.({ target: req }), 0);
            return req;
          },
          get: (id: string) => {
            const req = {
              result: memoryStore.get(id) ?? null,
              onsuccess: null as ((e: unknown) => void) | null,
              onerror: null as ((e: unknown) => void) | null,
            };
            setTimeout(() => req.onsuccess?.({ target: req }), 0);
            return req;
          },
          put: (val: { id: string }) => {
            memoryStore.set(val.id, val);
            const req = {
              onsuccess: null as ((e: unknown) => void) | null,
              onerror: null as ((e: unknown) => void) | null,
            };
            setTimeout(() => req.onsuccess?.({ target: req }), 0);
            return req;
          },
          delete: (id: string) => {
            memoryStore.delete(id);
            const req = {
              onsuccess: null as ((e: unknown) => void) | null,
              onerror: null as ((e: unknown) => void) | null,
            };
            setTimeout(() => req.onsuccess?.({ target: req }), 0);
            return req;
          },
        }),
      }),
    } as unknown as IDBDatabase;
  }

  /** Cada nombre de base tiene su propio almacén, como en un navegador real. */
  function createMockIndexedDB() {
    const databases = new Map<string, Map<string, unknown>>();
    const storeFor = (name: string) => {
      let store = databases.get(name);
      if (!store) {
        store = new Map<string, unknown>();
        databases.set(name, store);
      }
      return store;
    };

    const mockIdb: unknown = {
      open: (name: string) => {
        const req = {
          result: createMockDatabase(storeFor(name)),
          onupgradeneeded: null as ((e: unknown) => void) | null,
          onsuccess: null as ((e: unknown) => void) | null,
          onerror: null as ((e: unknown) => void) | null,
          onblocked: null as ((e: unknown) => void) | null,
        };
        setTimeout(() => {
          req.onsuccess?.({ target: req });
        }, 0);
        return req;
      },
    };

    return { mockIdb: mockIdb as IDBFactory, storeFor, memoryStore: storeFor(TARGET_DB_NAME) };
  }

  it('guarda, recupera y lista partituras a través de IndexedDB', async () => {
    const { mockIdb, memoryStore } = createMockIndexedDB();
    globalWithIdb.indexedDB = mockIdb;

    try {
      const score = { ...TEMPLATES[0].score, id: 'idb-score-1', title: 'Partitura en IndexedDB' };
      const res = await saveScoreToLibrary(score);
      expect(res.ok).toBe(true);
      expect(memoryStore.has('idb-score-1')).toBe(true);

      const loaded = await loadScoreFromLibrary('idb-score-1');
      expect(loaded).not.toBeNull();
      expect(loaded?.title).toBe('Partitura en IndexedDB');

      const list = await listLibraryScores();
      expect(list.some((item) => item.id === 'idb-score-1')).toBe(true);

      await deleteScoreFromLibrary('idb-score-1');
      expect(memoryStore.has('idb-score-1')).toBe(false);

      // Una biblioteca vacía no debe resucitar nada
      const emptyList = await listLibraryScores();
      expect(emptyList).toHaveLength(0);
    } finally {
      delete globalWithIdb.indexedDB;
    }
  });

  it('no llena localStorage con partituras completas cuando IndexedDB está activo', async () => {
    const { mockIdb } = createMockIndexedDB();
    globalWithIdb.indexedDB = mockIdb;

    try {
      const score = { ...TEMPLATES[0].score, id: 'idb-quota-test', title: 'Partitura Pesada' };
      await saveScoreToLibrary(score);

      // En localStorage no debe existir la copia completa serializada de la partitura
      const localScore = globalWithStorage.localStorage?.getItem(
        'pautello_library_score_idb-quota-test'
      );
      expect(localScore).toBeNull();
    } finally {
      delete globalWithIdb.indexedDB;
    }
  });

  it('migra las partituras de una base IndexedDB con el nombre anterior', async () => {
    const { mockIdb, storeFor, memoryStore } = createMockIndexedDB();
    globalWithIdb.indexedDB = mockIdb;

    try {
      const legacyScore = {
        ...TEMPLATES[0].score,
        id: 'legacy-score',
        title: 'Partitura heredada',
      };
      storeFor('sonata_scores_db').set('legacy-score', legacyScore);

      const list = await listLibraryScores();
      expect(list.some((s) => s.id === 'legacy-score' && s.title === 'Partitura heredada')).toBe(
        true
      );
      expect(memoryStore.has('legacy-score')).toBe(true);

      // La base heredada se conserva para quien vuelva a una versión anterior.
      expect(storeFor('sonata_scores_db').has('legacy-score')).toBe(true);
    } finally {
      delete globalWithIdb.indexedDB;
    }
  });

  it('eliminar la partitura activa de la biblioteca también limpia la clave activa evitando resurrección', async () => {
    const score = { ...TEMPLATES[0].score, id: 'active-to-delete', title: 'Partitura a Eliminar' };
    await saveScoreToLibrary(score);
    saveScoreToStorage(score); // guardada como activa en STORAGE_KEY

    // Verificamos que esté en la biblioteca
    let list = await listLibraryScores();
    expect(list.some((s) => s.id === 'active-to-delete')).toBe(true);

    // Eliminamos
    await deleteScoreFromLibrary('active-to-delete');

    // Debe eliminarse de la lista sin resucitar
    list = await listLibraryScores();
    expect(list.some((s) => s.id === 'active-to-delete')).toBe(false);

    // Tampoco debe cargarse desde la biblioteca
    const loaded = await loadScoreFromLibrary('active-to-delete');
    expect(loaded).toBeNull();
  });

  it('sanitiza el título al duplicar si la partitura original tiene título vacío o espacios', async () => {
    const score = { ...TEMPLATES[0].score, id: 'empty-title-score', title: '   ' };
    await saveScoreToLibrary(score);

    const copy = await duplicateScoreInLibrary('empty-title-score');
    expect(copy?.title).toBe('Sin título (Copia)');
  });
});
