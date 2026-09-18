import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from './icons';

export interface CustomSelectOption<T extends string | number = string> {
  value: T;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
  description?: string;
}

interface CustomSelectProps<T extends string | number = string> {
  value: T;
  onChange: (value: T) => void;
  options: CustomSelectOption<T>[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
  disabled?: boolean;
}

export function CustomSelect<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  icon,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  align = 'right',
  disabled = false,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={
          buttonClassName ||
          `w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all duration-150 cursor-pointer select-none active:scale-[0.98] outline-none ${
            isOpen
              ? 'bg-amber-50/60 dark:bg-studio-elevated border-studio-accent ring-2 ring-studio-accent/20 text-slate-900 dark:text-white shadow-sm'
              : 'bg-white hover:bg-slate-50 dark:bg-studio-surface dark:hover:bg-studio-card border-slate-200 dark:border-studio-line hover:border-amber-400 dark:hover:border-amber-500/60 text-slate-800 dark:text-slate-200 shadow-2xs'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
        }
      >
        <span className="flex items-center gap-1.5 truncate min-w-0">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ease-out ${
            isOpen ? 'rotate-180 text-studio-accent' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } top-full mt-1.5 min-w-full w-max max-w-[280px] ${
            options.length > 5 ? 'max-h-60 overflow-y-auto' : 'overflow-hidden'
          } backdrop-blur-md bg-white/95 dark:bg-studio-card/95 border border-slate-200/90 dark:border-studio-line rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/5 z-dropdown p-1.5 animate-dropdown origin-top ${menuClassName}`}
        >
          <div className="space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2.5 transition-all duration-150 cursor-pointer select-none group ${
                    isSelected
                      ? 'bg-amber-100/70 dark:bg-amber-950/40 text-amber-950 dark:text-pastel-amber font-bold shadow-2xs'
                      : 'hover:bg-slate-100/90 dark:hover:bg-studio-deep text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    {option.icon && <span className="shrink-0 text-sm">{option.icon}</span>}
                    <div className="truncate">
                      <div className="text-xs truncate">{option.label}</div>
                      {option.description && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {option.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono font-semibold ${
                          isSelected
                            ? 'bg-amber-200/80 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200'
                            : 'bg-slate-100 dark:bg-studio-surface text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-studio-raised'
                        }`}
                      >
                        {option.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-studio-accent shrink-0 stroke-[2.5]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
