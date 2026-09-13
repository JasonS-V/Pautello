import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Globe,
  MessageCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { Score } from '../../types/music';
import { compressScoreToHash } from '../../utils/shareUrl';

interface ShareModalProps {
  score: Score;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  score,
  isOpen,
  onClose,
}) => {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setIsCopied(false);

    compressScoreToHash(score)
      .then((hash) => {
        const url = `${window.location.origin}${window.location.pathname}#share=${hash}`;
        setShareUrl(url);
      })
      .catch((err) => {
        console.error('Error al generar enlace de partitura:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [score, isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.getElementById('share-url-input') as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand('copy');
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      }
    }
  };

  const shareText = `¡Escucha y toca "${score.title}" en Sonata Studio Libre!`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `${shareText}\n${shareUrl}`
  )}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
    shareUrl
  )}&text=${encodeURIComponent(shareText)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText
  )}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none animate-fadeIn no-print"
    >
      <div className="bg-white dark:bg-[#161922] text-slate-900 dark:text-slate-100 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-[#232836] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#232836] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-[#c4b5fd] flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base block leading-none">
                Compartir Partitura
              </h3>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Enlace universal directo sin registro ni cuenta
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Piece info banner */}
          <div className="bg-slate-50 dark:bg-[#1a1e2b] p-3.5 rounded-2xl border border-slate-200 dark:border-[#282d40] flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                {score.title || 'Partitura Sin Título'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {score.composer} • {score.staves[0]?.measures.length || 0} compases
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold bg-[#bef264] text-lime-950 px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3" />
              <span>100% Libre</span>
            </div>
          </div>

          {/* Copy URL Box */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Enlace Web Directo:
            </label>
            <div className="flex items-center gap-2">
              <input
                id="share-url-input"
                type="text"
                readOnly
                value={isLoading ? 'Generando enlace comprimido...' : shareUrl}
                className="flex-1 bg-slate-50 dark:bg-[#111319] border border-slate-200 dark:border-[#2a3044] rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 font-mono outline-none select-all"
              />
              <button
                onClick={handleCopyLink}
                disabled={isLoading}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 ${
                  isCopied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#fed7aa] hover:bg-[#fcd34d] text-amber-950'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Direct Social Share Buttons */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2 uppercase tracking-wider">
              Enviar directamente a:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-colors border border-emerald-200 dark:border-emerald-800/50"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>

              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-xs font-bold transition-colors border border-sky-200 dark:border-sky-800/50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </a>

              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1e2b] dark:hover:bg-[#202536] text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors border border-slate-200 dark:border-[#282d40]"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>X / Twitter</span>
              </a>
            </div>
          </div>

          {/* Explanatory note */}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-2 border-t border-slate-200 dark:border-[#232836]">
            💡 Quien reciba este enlace abrirá la partitura completa en Sonata con todas sus notas, letras y acordes sin necesidad de descargar nada ni crear cuentas.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-[#232836] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1f2330] dark:hover:bg-[#282d40] text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
