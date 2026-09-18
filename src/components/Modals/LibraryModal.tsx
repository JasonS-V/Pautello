import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  FolderOpen,
  Plus,
  Copy,
  Trash2,
  Download,
  Search,
  Sparkles,
  Clock,
  Music,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from '../ui/icons';
import { Score } from '../../types/music';
import {
  ScoreMetadata,
  listScoresFromLibrary,
  loadScoreFromLibrary,
  deleteScoreFromLibrary,
  duplicateScoreInLibrary,
  STORAGE_BUDGET_CHARS,
} from '../../utils/storage';
import { ModalBase } from '../ui/ModalBase';
import { useToast } from '../ui/toastContext';
import { KEY_SIGNATURE_DATA } from '../../constants/pitches';
import { saveFile, safeFileName } from '../../utils/download';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScoreId: string;
  onSelectScore: (score: Score) => void;
  onCreateNewScore: () => void;
}

type SortOption = 'updated-desc' | 'updated-asc' | 'title-asc' | 'composer-asc';

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  currentScoreId,
  onSelectScore,
  onCreateNewScore,
}) => {
  const toast = useToast();
  const [scores, setScores] = useState<ScoreMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listScoresFromLibrary();
      setScores(list);
    } catch (err) {
      console.error('Error cargando lista de partituras:', err);
      toast.error('Error de biblioteca', 'No se pudieron recuperar las partituras.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      fetchScores();
      setDeleteConfirmId(null);
      setActionLoadingId(null);
    }
  }, [isOpen, fetchScores]);

  const handleOpenScore = async (id: string) => {
    if (id === currentScoreId) {
      toast.info('Partitura activa', 'Esta partitura ya está abierta en el editor.');
      onClose();
      return;
    }

    setActionLoadingId(id);
    try {
      const fullScore = await loadScoreFromLibrary(id);
      if (fullScore) {
        onSelectScore(fullScore);
        toast.success('Partitura cargada', `Se abrió "${fullScore.title}".`);
        onClose();
      } else {
        toast.error('Error al abrir', 'No se pudo leer la partitura seleccionada.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al abrir', 'Ocurrió un fallo al cargar la partitura.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setActionLoadingId(id);
    try {
      const copy = await duplicateScoreInLibrary(id, `${title} (Copia)`);
      if (copy) {
        toast.success('Partitura duplicada', `Se creó una copia de "${title}".`);
        await fetchScores();
      } else {
        toast.error('Error al duplicar', 'No se pudo generar la copia.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al duplicar', 'Ocurrió un error duplicando el proyecto.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setActionLoadingId(id);
    try {
      await deleteScoreFromLibrary(id);
      toast.success('Partitura eliminada', `Se eliminó "${title}" de la biblioteca.`);
      setDeleteConfirmId(null);
      await fetchScores();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar', 'No se pudo eliminar la partitura.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExportJson = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const fullScore = await loadScoreFromLibrary(id);
      if (!fullScore) {
        toast.error('Error al exportar', 'No se pudo leer el archivo.');
        return;
      }
      const json = JSON.stringify(fullScore, null, 2);
      const filename = `${safeFileName(fullScore.title, 'partitura')}.json`;
      const res = await saveFile(filename, json, 'application/json');
      if (res.ok) {
        toast.success('JSON exportado', `Archivo ${filename} guardado.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al exportar', 'No se pudo guardar el archivo JSON.');
    }
  };

  const filteredScores = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = scores.filter((s) => {
      if (!query) return true;
      return s.title.toLowerCase().includes(query) || s.composer.toLowerCase().includes(query);
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'updated-asc':
          return a.updatedAt - b.updatedAt;
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'composer-asc':
          return a.composer.localeCompare(b.composer);
        case 'updated-desc':
        default:
          return b.updatedAt - a.updatedAt;
      }
    });

    return list;
  }, [scores, searchQuery, sortBy]);

  const estimatedStorageUsed = useMemo(() => {
    const estimatedChars = scores.reduce((sum, s) => {
      return sum + (s.measuresCount * 350 * Math.max(1, s.stavesCount) + 1200);
    }, 0);
    const ratio = Math.min(1, estimatedChars / STORAGE_BUDGET_CHARS);
    const kb = Math.round(estimatedChars / 1024);
    return { kb, ratio, percent: Math.round(ratio * 100) };
  }, [scores]);

  if (!isOpen) return null;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Mis Partituras y Biblioteca de Proyectos"
      maxWidth={scores.length <= 2 ? 'max-w-2xl' : 'max-w-4xl'}
    >
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-studio-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-studio-accent/10 dark:bg-amber-500/20 text-studio-accent flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Mis Partituras
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Biblioteca persistente en almacenamiento local (IndexedDB)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onCreateNewScore();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-accent hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
              title="Crear un nuevo lienzo en blanco"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nueva Partitura</span>
            </button>

            <button
              onClick={fetchScores}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-studio-elevated transition-colors cursor-pointer"
              title="Refrescar biblioteca"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-studio-elevated transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters and Storage Bar */}
        <div className="px-5 py-3 border-b border-slate-200/80 dark:border-studio-border/80 bg-slate-50/70 dark:bg-studio-deep/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por título o compositor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-studio-elevated border border-slate-200 dark:border-studio-lineSoft rounded-xl outline-none focus:border-studio-accent text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-studio-elevated border border-slate-200 dark:border-studio-lineSoft rounded-xl text-slate-700 dark:text-slate-300 outline-none focus:border-studio-accent cursor-pointer"
              title="Ordenar partituras"
            >
              <option value="updated-desc">Más recientes</option>
              <option value="updated-asc">Más antiguos</option>
              <option value="title-asc">Título (A-Z)</option>
              <option value="composer-asc">Compositor (A-Z)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>
              {scores.length} {scores.length === 1 ? 'partitura' : 'partituras'}
            </span>
            <span className="text-slate-300 dark:text-studio-line">|</span>
            <div className="flex items-center gap-1.5" title="Uso del presupuesto local estimado">
              <span className="font-mono">{estimatedStorageUsed.kb} KB</span>
              <div className="w-16 h-1.5 bg-slate-200 dark:bg-studio-line rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    estimatedStorageUsed.percent > 80
                      ? 'bg-rose-500'
                      : estimatedStorageUsed.percent > 60
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(4, estimatedStorageUsed.percent)}%` }}
                />
              </div>
              <span className="font-mono text-[10px]">{estimatedStorageUsed.percent}%</span>
            </div>
          </div>
        </div>

        {/* Scores List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <Sparkles className="w-8 h-8 animate-spin mx-auto mb-2 text-studio-accent opacity-50" />
              <p className="text-xs">Cargando biblioteca de partituras...</p>
            </div>
          ) : filteredScores.length === 0 ? (
            <div className="py-16 text-center">
              <Music className="w-12 h-12 text-slate-300 dark:text-studio-line mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {searchQuery ? 'No se encontraron partituras' : 'Tu biblioteca está vacía'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? 'Intenta con otro término de búsqueda o limpia el filtro.'
                  : 'Guarda tu trabajo actual o crea un nuevo proyecto para comenzar tu colección.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => {
                    onCreateNewScore();
                    onClose();
                  }}
                  className="mt-4 px-4 py-2 bg-studio-accent hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Crear Primera Partitura
                </button>
              )}
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 gap-3 ${
                filteredScores.length > 2 ? 'md:grid-cols-2' : 'max-w-xl mx-auto w-full'
              }`}
            >
              {filteredScores.map((meta) => {
                const isActive = meta.id === currentScoreId;
                const dateStr = new Date(meta.updatedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const keyName = KEY_SIGNATURE_DATA[meta.keySignature]?.name || meta.keySignature;

                return (
                  <div
                    key={meta.id}
                    className={`group relative p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between text-left hover:-translate-y-0.5 hover:shadow-studio-sm ${
                      isActive
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-studio-accent ring-1 ring-studio-accent/40 shadow-xs'
                        : 'bg-white dark:bg-studio-elevated border-slate-200 dark:border-studio-lineSoft hover:border-slate-300 dark:hover:border-studio-border'
                    }`}
                  >
                    <div>
                      {/* Top status indicator */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Activa actualmente
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-sans">
                            <Clock className="w-3 h-3" />
                            {dateStr}
                          </span>
                        )}

                        {/* Actions group */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleDuplicate(e, meta.id, meta.title)}
                            disabled={actionLoadingId === meta.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-studio-raised transition-colors cursor-pointer"
                            title="Duplicar partitura"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleExportJson(e, meta.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-studio-raised transition-colors cursor-pointer"
                            title="Descargar respaldo JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {deleteConfirmId === meta.id ? (
                            <div className="flex items-center gap-1 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded-lg border border-rose-300 dark:border-rose-800">
                              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">
                                ¿Borrar?
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDelete(e, meta.id, meta.title)}
                                className="text-[10px] font-black text-rose-600 hover:text-rose-800 dark:text-rose-400 underline cursor-pointer"
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                                className="text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 ml-1 cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(meta.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Eliminar de la biblioteca"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Title & Composer button */}
                      <button
                        type="button"
                        onClick={() => handleOpenScore(meta.id)}
                        className="text-left w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-studio-accent rounded-lg p-0.5 -ml-0.5 block"
                        title={`Abrir ${meta.title || 'partitura'}`}
                      >
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-studio-accent transition-colors">
                          {meta.title || 'Sin título'}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-1 font-serif mt-0.5">
                          {meta.composer || 'Anónimo'}
                        </p>
                      </button>
                    </div>

                    {/* Metadata Badges & Action */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-studio-lineSoft/60 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-studio-raised text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                          {meta.measuresCount} compases
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-studio-raised text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                          {meta.stavesCount} {meta.stavesCount === 1 ? 'pentagrama' : 'pentagramas'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-studio-raised text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                          {meta.timeSignature
                            ? `${meta.timeSignature.beats}/${meta.timeSignature.beatType}`
                            : '4/4'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-studio-raised text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                          {keyName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-studio-raised text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                          {meta.tempo} BPM
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenScore(meta.id)}
                        disabled={isActive || actionLoadingId === meta.id}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 cursor-default'
                            : 'bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 shadow-2xs hover:scale-105 active:scale-95'
                        }`}
                      >
                        {isActive ? 'Abierta' : 'Abrir'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-studio-border bg-slate-50/50 dark:bg-studio-deep/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <AlertCircle className="w-3.5 h-3.5 text-studio-accent shrink-0" />
            <span>
              Tus partituras se guardan continuamente de forma automática en este navegador.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </ModalBase>
  );
};
