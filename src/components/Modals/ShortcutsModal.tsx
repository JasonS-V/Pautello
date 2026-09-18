import React, { useState, useMemo } from 'react';
import { Keyboard, Search, Piano } from '../ui/icons';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader, ModalFooter } from '../ui/ModalChrome';
import { modalButton } from '../ui/modalButton';
import { KeyboardInputMode } from '../../types/music';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keyboardMode?: KeyboardInputMode;
  onToggleKeyboardMode?: () => void;
}

interface ShortcutItem {
  key: string;
  desc: string;
}

interface ShortcutGroup {
  category: string;
  items: ShortcutItem[];
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
  keyboardMode = 'piano',
  onToggleKeyboardMode,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');

  const shortcutGroups: ShortcutGroup[] = useMemo(
    () => [
      {
        category: `🎹 Modo Piano QWERTY ${keyboardMode === 'piano' ? '(ACTIVO)' : ''}`,
        items: [
          {
            key: 'A, S, D, F, G, H, J, K, L',
            desc: 'Teclas blancas de piano (Do, Re, Mi, Fa, Sol, La, Si, Do+1, Re+1)',
          },
          {
            key: 'W, E, T, Y, U, O, P',
            desc: 'Teclas negras de piano (Do#, Re#, Fa#, Sol#, La#, Do#+1, Re#+1)',
          },
          { key: 'Z / X', desc: 'Bajar / Subir una octava completa (-1 / +1)' },
          { key: 'Shift + Nota', desc: 'Apilar nota al acorde seleccionado (polifonía armónica)' },
          { key: 'R', desc: 'Alternar modo Silencio (Rest - en el hueco entre Mi y Fa)' },
          { key: 'Alt + L', desc: 'Ligadura de prolongación (Tie)' },
          { key: 'Alt + Shift + L', desc: 'Ligadura de expresión (Slur)' },
        ],
      },
      {
        category: `🎼 Modo Notación Clásica ${keyboardMode === 'notation' ? '(ACTIVO)' : ''}`,
        items: [
          {
            key: 'A, B, C, D, E, F, G',
            desc: 'Insertar nota con altura correspondiente (La, Si, Do, Re, Mi, Fa, Sol)',
          },
          { key: 'Shift + A..G', desc: 'Apilar nota al acorde seleccionado' },
          { key: '#, + o S', desc: 'Sostenido (♯)' },
          { key: 'L', desc: 'Ligadura de prolongación (Tie)' },
          { key: 'Shift + L', desc: 'Ligadura de expresión (Slur)' },
          { key: 'T', desc: 'Tresillo (3:2)' },
        ],
      },
      {
        category: 'Figuras Rítmicas y Alteraciones Comunes',
        items: [
          {
            key: '1, 2, 3, 4, 5, 6',
            desc: 'Seleccionar duración (1=Redonda, 2=Blanca, 3=Negra, 4=Corchea, 5=Semicorchea, 6=Fusa)',
          },
          { key: '.', desc: 'Puntillo (aumenta 50% el valor rítmico)' },
          { key: 'Ctrl + 3', desc: 'Tresillo (3:2) - 3 notas en tiempo de 2' },
          { key: '# o +', desc: 'Sostenido (♯)' },
          { key: '- o _', desc: 'Bemol (♭)' },
          { key: 'N', desc: 'Becuadro natural (♮)' },
          {
            key: 'V / Alt + 1, 2',
            desc: 'Alternar voz activa: Voz 1 (plicas ↑) / Voz 2 (plicas ↓)',
          },
        ],
      },
      {
        category: 'Edición y Transposición',
        items: [
          { key: '↑ (Flecha Arriba)', desc: 'Subir semitono' },
          { key: '↓ (Flecha Abajo)', desc: 'Bajar semitono' },
          { key: 'Shift + ↑ / ↓', desc: 'Subir o bajar una octava completa (+/- 12 semitonos)' },
          { key: 'Supr / Backspace', desc: 'Eliminar nota o compás seleccionado' },
          {
            key: 'Insert / Ctrl + Enter',
            desc: 'Añadir un compás después del compás seleccionado',
          },
          { key: 'Escape', desc: 'Deseleccionar elemento activo' },
          { key: 'Ctrl + C', desc: 'Copiar compás o rango de compases seleccionados' },
          { key: 'Ctrl + V', desc: 'Pegar compases en la posición actual' },
          { key: 'Shift + Clic', desc: 'Seleccionar rango continuo de compases' },
          {
            key: 'Shift + ← / →',
            desc: 'Extender o encoger el rango de compases (sin ratón)',
          },
          { key: 'Ctrl + Z', desc: 'Deshacer último cambio' },
          { key: 'Ctrl + Y / Ctrl+Shift+Z', desc: 'Rehacer' },
        ],
      },
      {
        category: 'Reproducción y Navegación',
        items: [
          { key: '← / → (Flechas)', desc: 'Navegar a la nota o silencio anterior / siguiente' },
          { key: 'Espacio', desc: 'Iniciar o pausar reproducción' },
          { key: '?', desc: 'Abrir este panel de atajos de teclado' },
        ],
      },
    ],
    [keyboardMode]
  );

  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return shortcutGroups;

    return shortcutGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (it) => it.key.toLowerCase().includes(term) || it.desc.toLowerCase().includes(term)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [searchTerm, shortcutGroups]);

  if (!isOpen) return null;

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} ariaLabel="Atajos de teclado" maxWidth="max-w-2xl">
      <ModalHeader
        icon={<Keyboard className="w-4 h-4" />}
        title="Atajos de Teclado"
        onClose={onClose}
        closeLabel="Cerrar panel de atajos"
        actions={
          onToggleKeyboardMode ? (
            <button
              type="button"
              onClick={onToggleKeyboardMode}
              aria-label="Cambiar modo de entrada de teclado"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-150 active:scale-95 cursor-pointer border ${
                keyboardMode === 'piano'
                  ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                  : 'bg-slate-200 dark:bg-studio-line border-slate-300 dark:border-studio-border text-slate-700 dark:text-slate-300'
              }`}
              title="Cambiar modo de entrada (Piano QWERTY / Notación)"
            >
              {keyboardMode === 'piano' ? (
                <>
                  <Piano className="w-3 h-3" />
                  <span>Piano QWERTY Activo</span>
                </>
              ) : (
                <>
                  <Keyboard className="w-3 h-3" />
                  <span>Notación Clásica Activa</span>
                </>
              )}
            </button>
          ) : undefined
        }
      />

      {/* Quick Search Filter */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar atajo por acción o tecla (ej. silencio, espacio, flecha, copiar)..."
          aria-label="Buscar atajo de teclado"
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-studio-surface border border-slate-200 dark:border-studio-line text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-studio-accent/60"
        />
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {filteredGroups.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No se encontraron atajos que coincidan con &quot;{searchTerm}&quot;.
          </div>
        ) : (
          filteredGroups.map((group, gIdx) => (
            <div key={`group-${gIdx}`}>
              <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {group.category}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((item, iIdx) => (
                  <div
                    key={`item-${iIdx}`}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-studio-elevated text-xs border border-slate-200/60 dark:border-studio-lineSoft"
                  >
                    <span className="text-slate-700 dark:text-slate-300 font-normal">
                      {item.desc}
                    </span>
                    <kbd className="font-mono text-[10px] font-semibold bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line px-2 py-0.5 rounded shadow-xs text-studio-accent shrink-0 ml-2">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <ModalFooter>
        <button type="button" onClick={onClose} className={modalButton.secondary}>
          Cerrar
        </button>
      </ModalFooter>
    </ModalBase>
  );
};
