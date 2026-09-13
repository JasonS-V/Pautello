import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      category: 'Entrada de Notas y Nombres',
      items: [
        { key: 'A, B, C, D, E, F, G', desc: 'Insertar nota con altura correspondiente (La, Si, Do, Re, Mi, Fa, Sol)' },
        { key: 'R', desc: 'Alternar modo Silencio' },
        { key: '1, 2, 3, 4, 5', desc: 'Seleccionar duración (1=Redonda, 2=Blanca, 3=Negra, 4=Corchea, 5=Semicorchea)' },
        { key: '.', desc: 'Puntillo (aumenta 50% el valor)' },
        { key: '#, + o S', desc: 'Sostenido (♯)' },
        { key: '- o _', desc: 'Bemol (♭)' },
        { key: 'N', desc: 'Becuadro natural (♮)' },
      ],
    },
    {
      category: 'Edición y Transposición',
      items: [
        { key: '↑ (Flecha Arriba)', desc: 'Subir semitono' },
        { key: '↓ (Flecha Abajo)', desc: 'Bajar semitono' },
        { key: 'Shift + ↑ / ↓', desc: 'Subir / bajar una octava entera (+/- 12 semitonos)' },
        { key: 'Supr / Backspace', desc: 'Eliminar nota seleccionada' },
        { key: 'Escape', desc: 'Deseleccionar nota' },
        { key: 'Ctrl + Z', desc: 'Deshacer último cambio' },
        { key: 'Ctrl + Y / Ctrl+Shift+Z', desc: 'Rehacer' },
      ],
    },
    {
      category: 'Reproducción y Navegación',
      items: [
        { key: 'Espacio', desc: 'Reproducir / Pausar' },
        { key: '?', desc: 'Abrir esta ayuda de atajos' },
      ],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-fadeIn no-print"
    >
      <div className="bg-white dark:bg-[#181b25] text-slate-900 dark:text-slate-100 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2 font-bold text-base">
            <Keyboard className="w-5 h-5 text-blue-600" />
            <span>Atajos de Teclado</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {shortcutGroups.map((group, gIdx) => (
            <div key={`group-${gIdx}`}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {group.category}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((item, iIdx) => (
                  <div
                    key={`item-${iIdx}`}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded bg-slate-50 dark:bg-[#1f2432] text-xs border border-slate-200/50 dark:border-slate-800/60"
                  >
                    <span className="text-slate-600 dark:text-slate-300 font-normal">
                      {item.desc}
                    </span>
                    <kbd className="font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded shadow-xs text-blue-600 dark:text-blue-400">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
