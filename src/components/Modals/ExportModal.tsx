import React, { useRef, useState } from 'react';
import {
  Printer,
  FileCode2,
  Music2,
  Download,
  Upload,
  AudioWaveform,
  FileJson2,
  FileStack,
  Image,
} from '../ui/icons';
import { Score } from '../../types/music';
import { exportScoreToMusicXml, importMusicXmlToScore } from '../../utils/musicxml';
import { exportScoreToMidi } from '../../audio/midiExport';
import { renderScoreToWav } from '../../audio/wavExport';
import { InstrumentType } from '../../audio/synth';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader } from '../ui/ModalChrome';
import { useToast } from '../ui/toastContext';
import { normalizeScore } from '../../utils/scoreSchema';
import { saveFile, safeFileName } from '../../utils/download';
import { extractPartScore } from '../../utils/transposition';
import { createZipBlob, ZipEntry } from '../../utils/zip';
import { exportScoreToSvg, exportScoreToPng } from '../../utils/imageExport';

interface ExportModalProps {
  score: Score;
  isOpen: boolean;
  onClose: () => void;
  onImportScore: (score: Score) => void;
  onOpenImport?: () => void;
  instrument?: InstrumentType;
}

/**
 * Valida una partitura importada (archivo de origen desconocido) y lanza un error
 * legible si no queda nada recuperable, para que el `catch` de la importación lo muestre.
 */
function parseImportedScore(raw: unknown): Score {
  const parsed = normalizeScore(raw);
  if (!parsed) throw new Error('El archivo no contiene ninguna partitura que se pueda leer.');
  return parsed;
}

/** Grupo de formatos por propósito (imprimir, intercambiar, producir). */
const ExportGroup: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section>
    <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
      {title}
    </h3>
    <div className="space-y-2">{children}</div>
  </section>
);

interface ExportOptionProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: string;
  tag: string;
  tagDetail: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}

/**
 * Opción de exportación: superficie plana neutra para todas las extensiones;
 * el acento ámbar aparece sólo al pasar el cursor. El formato se comunica con
 * la etiqueta monoespaciada, no con un color propio por extensión.
 */
const ExportOption: React.FC<ExportOptionProps> = ({
  icon,
  title,
  description,
  tag,
  tagDetail,
  onClick,
  disabled = false,
  ariaLabel,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-studio-lineSoft bg-slate-50 dark:bg-studio-elevated hover:border-studio-accent/60 dark:hover:border-studio-accent/60 transition-colors group text-left cursor-pointer disabled:opacity-50"
  >
    <div className="flex items-center gap-3 min-w-0">
      <span
        aria-hidden="true"
        className="w-10 h-10 rounded-lg bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-lineSoft text-slate-500 dark:text-slate-400 group-hover:text-studio-accent group-hover:border-studio-accent/50 flex items-center justify-center shrink-0 transition-colors"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-studio-accent transition-colors">
          {title}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{description}</div>
      </div>
    </div>
    <div className="flex flex-col items-end gap-1 shrink-0">
      <span className="font-mono text-[9px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-studio-surface border border-slate-200 dark:border-studio-line px-2 py-0.5 rounded">
        {tag}
      </span>
      <span className="text-[10px] text-slate-400">{tagDetail}</span>
    </div>
  </button>
);

export const ExportModal: React.FC<ExportModalProps> = ({
  score,
  isOpen,
  onClose,
  onImportScore,
  onOpenImport,
  instrument = 'piano',
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingWav, setIsExportingWav] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);

  if (!isOpen) return null;

  const baseFileName = safeFileName(score.title, 'pautello-partitura');

  const handleExportMusicXml = async () => {
    try {
      const xml = exportScoreToMusicXml(score);
      const res = await saveFile(
        `${baseFileName}.musicxml`,
        xml,
        'application/vnd.recordare.musicxml+xml'
      );
      if (res.ok) {
        toast.success('MusicXML exportado', 'El archivo MusicXML está listo para tu editor.');
      } else if (!res.cancelled) {
        toast.error('Error al exportar', 'No se pudo guardar el archivo MusicXML.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al exportar', 'Ocurrió un error generando MusicXML.');
    }
  };

  const handleExportParticellas = async () => {
    try {
      if (!score.staves || score.staves.length === 0) return;

      if (score.staves.length === 1) {
        const partScore = extractPartScore(score, 0);
        const xml = exportScoreToMusicXml(partScore);
        const res = await saveFile(
          `${baseFileName}-${safeFileName(score.staves[0].name || 'parte')}.musicxml`,
          xml,
          'application/vnd.recordare.musicxml+xml'
        );
        if (res.ok) {
          toast.success('Particella exportada', 'Particella individual lista en MusicXML.');
        } else if (!res.cancelled) {
          toast.error('Error al exportar', 'No se pudo guardar la particella.');
        }
        return;
      }

      const zipEntries: ZipEntry[] = [];
      score.staves.forEach((staff, idx) => {
        const partScore = extractPartScore(score, idx);
        const xml = exportScoreToMusicXml(partScore);
        const partName = `${String(idx + 1).padStart(2, '0')}_${safeFileName(staff.name || `Parte_${idx + 1}`)}`;
        zipEntries.push({
          name: `${partName}.musicxml`,
          data: xml,
        });
      });

      zipEntries.push({
        name: `00_Score_Completo.musicxml`,
        data: exportScoreToMusicXml(score),
      });

      const zipBlob = createZipBlob(zipEntries);
      const res = await saveFile(`${baseFileName}-particellas.zip`, zipBlob, 'application/zip');
      if (res.ok) {
        toast.success(
          'Particellas exportadas (ZIP)',
          `Se empaquetaron ${score.staves.length} particellas transportadas + partitura general.`
        );
      } else if (!res.cancelled) {
        toast.error('Error al exportar', 'No se pudo guardar el paquete ZIP de particellas.');
      }
    } catch (err) {
      console.error('Error al exportar particellas:', err);
      toast.error('Error al exportar particellas', 'Ocurrió un error generando el paquete.');
    }
  };

  const handleExportMidi = async () => {
    try {
      const blob = exportScoreToMidi(score);
      const res = await saveFile(`${baseFileName}.mid`, blob, 'audio/midi');
      if (res.ok) {
        toast.success('MIDI exportado', 'Archivo MIDI listo para tu DAW o reproductor.');
      } else if (!res.cancelled) {
        toast.error('Error al exportar', 'No se pudo guardar el archivo MIDI.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al exportar', 'Ocurrió un error generando el archivo MIDI.');
    }
  };

  const handleExportWav = async () => {
    try {
      setIsExportingWav(true);
      const blob = await renderScoreToWav(score, instrument);
      const res = await saveFile(`${baseFileName}.wav`, blob, 'audio/wav');
      if (res.ok) {
        toast.success('Audio WAV exportado', 'Audio estéreo de alta definición generado.');
      } else if (!res.cancelled) {
        toast.error('Error al exportar', 'No se pudo guardar el audio WAV.');
      }
    } catch (err) {
      console.error('Error al exportar audio WAV:', err);
      toast.error('Error de renderizado', 'Hubo un problema al sintetizar el audio WAV.');
    } finally {
      setIsExportingWav(false);
    }
  };

  const handleExportSvg = async () => {
    try {
      const blob = exportScoreToSvg();
      const res = await saveFile(`${baseFileName}.svg`, blob, 'image/svg+xml');
      if (res.ok) {
        toast.success('SVG exportado', 'Gráfico vectorial listo para imprenta o ilustrador.');
      } else if (!res.cancelled) {
        toast.error('Error al exportar', 'No se pudo guardar el archivo SVG.');
      }
    } catch (err) {
      console.error('Error al exportar SVG:', err);
      toast.error('Error al exportar', 'Ocurrió un error generando el archivo SVG.');
    }
  };

  const handleExportPng = async () => {
    try {
      setIsExportingPng(true);
      const blob = await exportScoreToPng(2);
      const res = await saveFile(`${baseFileName}.png`, blob, 'image/png');
      if (res.ok) {
        toast.success('Imagen PNG exportada', 'Imagen en alta definición (2x Retina) generada.');
      } else if (!res.cancelled) {
        toast.error('Error al exportar', 'No se pudo guardar la imagen PNG.');
      }
    } catch (err) {
      console.error('Error al exportar PNG:', err);
      toast.error('Error al exportar', 'Ocurrió un error generando la imagen PNG.');
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleExportJson = async () => {
    try {
      const json = JSON.stringify(score, null, 2);
      const res = await saveFile(`${baseFileName}.json`, json, 'application/json');
      if (res.ok) {
        toast.success('Copia guardada', 'Copia de seguridad en formato JSON descargada.');
      } else if (!res.cancelled) {
        toast.error('Error al guardar', 'No se pudo guardar la copia JSON.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar', 'No se pudo generar el archivo JSON.');
    }
  };

  const handlePrint = () => {
    onClose();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (file.name.endsWith('.json')) {
          onImportScore(parseImportedScore(JSON.parse(content)));
          toast.success('Partitura importada', 'Se ha cargado la partitura desde JSON.');
          onClose();
        } else if (file.name.endsWith('.xml') || file.name.endsWith('.musicxml')) {
          onImportScore(parseImportedScore(importMusicXmlToScore(content)));
          toast.success('Partitura importada', 'Se ha cargado la partitura desde MusicXML.');
          onClose();
        } else {
          toast.warning('Formato no admitido', 'Selecciona un archivo .json o .musicxml válido.');
        }
      } catch (err) {
        toast.error('Error de importación', 'El archivo no tiene un formato reconocido.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Exportar e importar partitura"
      maxWidth="max-w-lg"
    >
      <ModalHeader
        icon={<Download className="w-4 h-4" />}
        title="Exportar Partitura"
        subtitle="Organizado por propósito: imprimir, compartir y producir"
        onClose={onClose}
        closeLabel="Cerrar ventana de exportación"
      />

      <div className="space-y-5">
        <ExportGroup title="Imprimir y presentar">
          <ExportOption
            icon={<Printer className="w-5 h-5" />}
            title="Imprimir / Guardar en PDF"
            description="Copia en alta definición optimizada para atril y papel A4/Carta"
            tag="PDF"
            tagDetail="Atril / Papel"
            onClick={handlePrint}
            ariaLabel="Imprimir o exportar en PDF"
          />
          <ExportOption
            icon={<Image className={`w-5 h-5 ${isExportingPng ? 'animate-pulse' : ''}`} />}
            title={
              isExportingPng ? 'Generando imagen 2x Retina...' : 'Imagen en Alta Resolución (.png)'
            }
            description="Captura limpia a 2x Retina para compartir en redes, WhatsApp o imprimir"
            tag={isExportingPng ? '...' : '.png'}
            tagDetail="2x Retina PNG"
            onClick={handleExportPng}
            disabled={isExportingPng}
            ariaLabel="Exportar imagen en alta resolución en formato PNG"
          />
          <ExportOption
            icon={<FileCode2 className="w-5 h-5" />}
            title="Gráfico Vectorial SVG (.svg)"
            description="Vector puro editable y escalable para Illustrator, Inkscape, Word o web"
            tag=".svg"
            tagDetail="Vector SVG"
            onClick={handleExportSvg}
            ariaLabel="Exportar gráfico vectorial en formato SVG"
          />
        </ExportGroup>

        <ExportGroup title="Compartir con otros programas">
          <ExportOption
            icon={<FileCode2 className="w-5 h-5" />}
            title="MusicXML (.musicxml)"
            description="Compatible universal con MuseScore, Sibelius, Finale, Dorico y Flat.io"
            tag=".musicxml"
            tagDetail="MuseScore / Sibelius"
            onClick={handleExportMusicXml}
            ariaLabel="Exportar en formato MusicXML"
          />
          <ExportOption
            icon={<FileStack className="w-5 h-5" />}
            title={`Particellas de Instrumentos ${score.staves.length > 1 ? '(Lote .zip)' : '(.musicxml)'}`}
            description="Partes individuales con transporte tonal automático para cada atril"
            tag={score.staves.length > 1 ? '.zip' : '.musicxml'}
            tagDetail={`${score.staves.length} ${score.staves.length === 1 ? 'parte' : 'partes'}`}
            onClick={handleExportParticellas}
            ariaLabel="Exportar particellas de instrumentos independientes"
          />
          <ExportOption
            icon={<FileJson2 className="w-5 h-5" />}
            title="Copia de Seguridad (.json)"
            description="Guarda toda la estructura exacta de la obra para editarla más tarde"
            tag=".json"
            tagDetail="Pautello Backup"
            onClick={handleExportJson}
            ariaLabel="Guardar copia de seguridad en formato JSON"
          />
        </ExportGroup>

        <ExportGroup title="Audio y producción">
          <ExportOption
            icon={<Music2 className="w-5 h-5" />}
            title="Archivo MIDI Estándar (.mid)"
            description="Ideal para sintetizadores, DAWs (FL Studio, Ableton, Logic Pro, Reaper)"
            tag=".mid"
            tagDetail="DAW / Sintetizador"
            onClick={handleExportMidi}
            ariaLabel="Exportar archivo MIDI estándar"
          />
          <ExportOption
            icon={<AudioWaveform className={`w-5 h-5 ${isExportingWav ? 'animate-pulse' : ''}`} />}
            title={isExportingWav ? 'Renderizando audio a 44.1 kHz...' : 'Audio WAV Estéreo (.wav)'}
            description="Sonido PCM sintetizado de alta calidad para reproducir en cualquier equipo"
            tag={isExportingWav ? '...' : '.wav'}
            tagDetail="44.1 kHz PCM"
            onClick={handleExportWav}
            disabled={isExportingWav}
            ariaLabel="Exportar audio estéreo en formato WAV"
          />
        </ExportGroup>
      </div>

      {/* Import section */}
      <div className="mt-5 pt-4 border-t border-slate-200 dark:border-studio-border">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".musicxml,.xml,.json"
          className="hidden"
          aria-label="Seleccionar archivo de partitura para importar"
        />
        <button
          type="button"
          onClick={() => {
            if (onOpenImport) {
              onClose();
              onOpenImport();
            } else {
              fileInputRef.current?.click();
            }
          }}
          aria-label="Abrir asistente para importar partituras"
          className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 dark:border-studio-line hover:border-studio-accent dark:hover:border-studio-accent text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-studio-accent hover:bg-amber-50/40 dark:hover:bg-amber-950/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Abrir e Importar Partitura (.musicxml, .mid, .json)</span>
        </button>
      </div>
    </ModalBase>
  );
};
