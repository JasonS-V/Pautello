import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from './icons';

export interface DropdownItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  active?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

interface DropdownProps {
  label: string;
  labelClassName?: string;
  icon?: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  widthClass?: string;
  triggerClassName?: string;
  sectionLabel?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  labelClassName,
  icon,
  items,
  align = 'right',
  widthClass = 'w-64',
  triggerClassName,
  sectionLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={label}
        title={label}
        className={
          triggerClassName ??
          `flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-2xl transition-all duration-150 shadow-xs border active:scale-95 focus-visible:ring-2 focus-visible:ring-studio-accent/40 outline-none ${
            isOpen
              ? 'bg-slate-100 dark:bg-studio-deep border-slate-300 dark:border-studio-line text-slate-900 dark:text-white shadow-sm ring-1 ring-studio-accent/20'
              : 'bg-white dark:bg-studio-card hover:bg-slate-50 dark:hover:bg-studio-hover border-slate-200 dark:border-studio-border text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-studio-line'
          }`
        }
      >
        {icon && (
          <span className="shrink-0 transition-transform duration-150 group-hover:scale-105">
            {icon}
          </span>
        )}
        <span className={labelClassName}>{label}</span>
        <ChevronDown
          className={`w-3 h-3 opacity-60 transition-transform duration-200 ease-out ${isOpen ? 'rotate-180 text-studio-accent' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 ${widthClass} backdrop-blur-md bg-white/95 dark:bg-studio-card/95 border border-slate-200/90 dark:border-studio-line rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/5 z-dropdown p-1.5 animate-dropdown origin-top`}
        >
          {sectionLabel && (
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/60 mb-1">
              {sectionLabel}
            </div>
          )}
          <div className="space-y-0.5">
            {items.map((item) => (
              <button
                key={item.id}
                role="menuitem"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  item.onSelect();
                }}
                className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2.5 transition-all duration-150 active:scale-[0.98] hover:translate-x-0.5 group ${
                  item.danger
                    ? 'hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400'
                    : item.active
                      ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-pastel-amber font-semibold'
                      : 'hover:bg-slate-100/90 dark:hover:bg-studio-deep text-slate-700 dark:text-slate-200'
                }`}
              >
                {item.icon && (
                  <span className="shrink-0 w-4 h-4 flex items-center justify-center opacity-85 transition-transform duration-150 group-hover:scale-110">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate group-hover:text-slate-900 dark:group-hover:text-white">
                      {item.label}
                    </span>
                    {item.active && (
                      <Check className="w-3.5 h-3.5 text-studio-accent shrink-0 animate-in fade-in" />
                    )}
                    {item.shortcut && !item.active && (
                      <kbd className="text-[9px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-studio-surface px-1.5 py-0.5 rounded border border-slate-200 dark:border-studio-line shadow-2xs group-hover:border-slate-300 dark:group-hover:border-slate-600 transition-colors">
                        {item.shortcut}
                      </kbd>
                    )}
                  </span>
                  {item.description && (
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-normal">
                      {item.description}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
