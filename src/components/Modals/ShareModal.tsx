import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, Globe, MessageCircle, Send, Sparkles, Lightbulb } from '../ui/icons';
import { Score } from '../../types/music';
import { compressScoreToHash } from '../../utils/shareUrl';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader, ModalFooter } from '../ui/ModalChrome';
import { modalButton } from '../ui/modalButton';
import { useToast } from '../ui/toastContext';

interface ShareModalProps {
  score: Score;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ score, isOpen, onClose }) => {
  const toast = useToast();
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTooLong, setIsTooLong] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setIsCopied(false);
    setIsTooLong(false);

    compressScoreToHash(score)
      .then((hash) => {
        const url = `${window.location.origin}${window.location.pathname}#share=${hash}`;
        if (url.length > 8000) {
          setIsTooLong(true);
          toast.warning(
            'Partitura muy extensa',
            'La partitura contiene demasiados datos para un enlace URL (>8000 caracteres). Utiliza "Exportar JSON" o "MusicXML".'
          );
          setShareUrl('');
        } else {
          setShareUrl(url);
        }
      })
      .catch((err) => {
        console.error('Error al generar enlace de partitura:', err);
        toast.error('Error al generar enlace', 'No se pudo codificar la partitura.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [score, isOpen, toast]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      toast.success('Enlace copiado', 'El enlace se ha copiado al portapapeles.');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.getElementById('share-url-input') as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand('copy');
        setIsCopied(true);
        toast.success('Enlace copiado', 'El enlace se ha copiado al portapapeles.');
        setTimeout(() => setIsCopied(false), 2500);
      } else {
        toast.error('Error al copiar', 'No se pudo copiar el enlace automáticamente.');
      }
    }
  };

  const shareText = `¡Escucha y toca "${score.title}" en Pautello Studio Libre!`;
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
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Compartir partitura"
      maxWidth="max-w-lg"
    >
      <ModalHeader
        icon={<Share2 className="w-4 h-4" />}
        title="Compartir Partitura"
        subtitle="Enlace universal directo sin registro ni cuenta"
        onClose={onClose}
        className="mb-5"
      />

      <div className="space-y-4">
        {/* Piece info banner */}
        <div className="bg-slate-50 dark:bg-studio-elevated p-3.5 rounded-2xl border border-slate-200 dark:border-studio-lineSoft flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
              {score.title || 'Partitura Sin Título'}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {score.composer} • {score.staves[0]?.measures.length || 0} compases
            </p>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold bg-pastel-lime text-lime-950 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3 h-3" />
            <span>100% Libre</span>
          </div>
        </div>

        {/* Copy URL Box */}
        <div>
          <label
            htmlFor="share-url-input"
            className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5"
          >
            Enlace Web Directo:
          </label>
          {isTooLong ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200">
              Esta partitura es demasiado extensa para compartir mediante enlace URL (&gt;8000
              caracteres). Por favor utiliza la opción <strong>Exportar</strong> (.json o
              .musicxml).
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                id="share-url-input"
                type="text"
                readOnly
                value={isLoading ? 'Generando enlace comprimido...' : shareUrl}
                className="flex-1 bg-slate-50 dark:bg-studio-surface border border-slate-200 dark:border-studio-line rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 font-mono outline-none select-all"
              />
              <button
                onClick={handleCopyLink}
                disabled={isLoading}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:scale-105 active:scale-95 shrink-0 cursor-pointer ${
                  isCopied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-pastel-amber hover:bg-amber-300 text-amber-950'
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
          )}
        </div>

        {/* Direct Social Share Buttons */}
        <div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2 uppercase tracking-wider">
            Enviar directamente a:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:-translate-y-0.5 active:scale-95 transition-all border border-emerald-200 dark:border-emerald-800/50 shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-xs font-bold hover:-translate-y-0.5 active:scale-95 transition-all border border-sky-200 dark:border-sky-800/50 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram</span>
            </a>

            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-studio-elevated dark:hover:bg-studio-hover text-slate-800 dark:text-slate-200 text-xs font-bold hover:-translate-y-0.5 active:scale-95 transition-all border border-slate-200 dark:border-studio-lineSoft shadow-xs"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>X / Twitter</span>
            </a>
          </div>
        </div>

        {/* Explanatory note */}
        <div className="flex items-start gap-2.5 pt-3 border-t border-slate-200 dark:border-studio-border">
          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Quien reciba este enlace abrirá la partitura completa en Pautello con todas sus notas,
            letras y acordes sin necesidad de descargar nada ni crear cuentas.
          </p>
        </div>
      </div>

      <ModalFooter>
        <button type="button" onClick={onClose} className={modalButton.secondary}>
          Cerrar
        </button>
      </ModalFooter>
    </ModalBase>
  );
};
