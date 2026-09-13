import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export type StatCardVariant = 'amber' | 'purple' | 'lime';

interface StatCardProps {
  variant: StatCardVariant;
  title: string;
  countLabel?: string;
  subtitle: string;
  value: string;
  detail?: string;
  actionTitle?: string;
  onAction?: () => void;
  onCardClick?: () => void;
}

const variantStyles: Record<StatCardVariant, {
  bg: string;
  textTitle: string;
  textSubtitle: string;
  textValue: string;
  textDetail: string;
  buttonBg: string;
  buttonHover: string;
  buttonIcon: string;
}> = {
  amber: {
    bg: 'bg-[#fed7aa] dark:bg-[#f59e0b]',
    textTitle: 'text-amber-950 dark:text-amber-950 font-bold',
    textSubtitle: 'text-amber-800/80 dark:text-amber-900 font-medium',
    textValue: 'text-amber-950 dark:text-slate-950 font-black',
    textDetail: 'text-amber-900/90 dark:text-amber-950 font-medium',
    buttonBg: 'bg-black/90 dark:bg-black',
    buttonHover: 'hover:bg-black hover:scale-105',
    buttonIcon: 'text-white',
  },
  purple: {
    bg: 'bg-[#c4b5fd] dark:bg-[#a78bfa]',
    textTitle: 'text-purple-950 dark:text-purple-950 font-bold',
    textSubtitle: 'text-purple-800/80 dark:text-purple-900 font-medium',
    textValue: 'text-purple-950 dark:text-slate-950 font-black',
    textDetail: 'text-purple-900/90 dark:text-purple-950 font-medium',
    buttonBg: 'bg-black/90 dark:bg-black',
    buttonHover: 'hover:bg-black hover:scale-105',
    buttonIcon: 'text-white',
  },
  lime: {
    bg: 'bg-[#bef264] dark:bg-[#a3e635]',
    textTitle: 'text-lime-950 dark:text-lime-950 font-bold',
    textSubtitle: 'text-lime-800/80 dark:text-lime-900 font-medium',
    textValue: 'text-lime-950 dark:text-slate-950 font-black',
    textDetail: 'text-lime-900/90 dark:text-lime-950 font-medium',
    buttonBg: 'bg-black/90 dark:bg-black',
    buttonHover: 'hover:bg-black hover:scale-105',
    buttonIcon: 'text-white',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  variant,
  title,
  countLabel,
  subtitle,
  value,
  detail,
  actionTitle = 'Ver más',
  onAction,
  onCardClick,
}) => {
  const styles = variantStyles[variant];

  return (
    <div
      onClick={() => (onCardClick ? onCardClick() : onAction?.())}
      className={`${styles.bg} rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer select-none group min-h-[125px]`}
    >
      {/* Subtle organic wavy background pattern watermark */}
      <svg
        className="absolute inset-0 w-full h-full opacity-10 pointer-events-none mix-blend-multiply"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <path
          d="M-20 40 C 40 10, 100 80, 200 30 C 300 -20, 360 70, 420 40"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M-20 80 C 60 40, 120 110, 220 60 C 320 10, 380 90, 440 60"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>

      {/* Header with Title and counter */}
      <div className="flex items-center justify-between relative z-10">
        <h4 className={`text-xs sm:text-sm tracking-tight ${styles.textTitle}`}>
          {title} {countLabel && <span className="opacity-70 font-normal">({countLabel})</span>}
        </h4>
      </div>

      {/* Main body: Subtitle + Value + Action Button */}
      <div className="mt-2.5 flex items-end justify-between relative z-10">
        <div className="flex flex-col">
          <span className={`text-[10px] sm:text-[11px] uppercase tracking-wider ${styles.textSubtitle}`}>
            {subtitle}
          </span>
          <span className={`text-xl sm:text-2xl tracking-tight leading-tight mt-0.5 ${styles.textValue}`}>
            {value}
          </span>
          {detail && (
            <span className={`text-[10px] mt-0.5 ${styles.textDetail}`}>
              {detail}
            </span>
          )}
        </div>

        {/* Diagonal Arrow circular button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction?.();
          }}
          className={`w-9 h-9 rounded-full ${styles.buttonBg} ${styles.buttonHover} flex items-center justify-center transition-all duration-150 shadow-md group-hover:scale-105 shrink-0 ml-2`}
          title={actionTitle}
        >
          <ArrowUpRight className={`w-4 h-4 ${styles.buttonIcon} stroke-[2.5]`} />
        </button>
      </div>
    </div>
  );
};
