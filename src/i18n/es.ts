/**
 * Textos compartidos de la aplicacion. La interfaz esta en espanol, pero la
 * copia vive aqui y no incrustada en el JSX: asi se puede revisar de una vez,
 * traducir a otro idioma y evitar que se cuelen emojis nuevos.
 */
export const es = {
  app: {
    name: 'Pautello',
    documentFallback: 'Partitura sin título',
    untitledFileName: 'pautello-partitura',
  },
  storage: {
    savedTitle: 'Partitura guardada',
    savedMessage: 'Se guardó automáticamente en este navegador.',
    failedTitle: 'No se pudo guardar la partitura',
    failedMessage:
      'El almacenamiento local está lleno o bloqueado. Descarga una copia de seguridad para no perder tu trabajo.',
    nearLimitTitle: 'El almacenamiento se está llenando',
    nearLimitMessage:
      'La partitura ocupa buena parte del espacio disponible. Exporta una copia .json como respaldo.',
    backupLabel: 'Descargar copia (.json)',
    backupDoneTitle: 'Copia de seguridad descargada',
    recoveredTitle: 'Se recuperó tu última partitura',
    recoveredMessage:
      'La sesión anterior se cerró sin guardar: se restauró el estado más reciente.',
  },
  dialogs: {
    newScoreTitle: '¿Empezar una partitura en blanco?',
    newScoreDescription:
      'Se vaciará el lienzo actual. Puedes descargar antes una copia de seguridad.',
    newScoreDetails: [
      'Se pierden el título, los compases y las notas actuales.',
      'El autoguardado se sobrescribirá con la partitura nueva.',
    ],
    newScoreConfirm: 'Sí, vaciar el lienzo',
    clearTitle: '¿Vaciar la partitura?',
    clearDescription:
      'Se eliminarán todas las notas y compases de todos los pentagramas de la obra.',
    clearDetails: [
      'Los ajustes de estructura (compás, tonalidad, tempo) se mantienen.',
      'Puedes deshacer con Ctrl+Z justo después.',
    ],
    clearConfirm: 'Sí, vaciar',
    loadTemplateTitle: '¿Cargar otra partitura?',
    loadTemplateDescription:
      'Cargar una plantilla, importar un archivo o abrir un enlace reemplaza la obra abierta.',
    loadTemplateDetails: [
      'La partitura actual se sustituye en el lienzo.',
      'Podrás volver atrás con Ctrl+Z mientras la sesión siga abierta.',
    ],
    loadTemplateConfirm: 'Sí, reemplazar',
    deleteMeasureTitle: '¿Eliminar este compás?',
    deleteMeasureDescription: 'El compás y sus notas desaparecen del pentagrama seleccionado.',
    deleteMeasureConfirm: 'Sí, eliminar compás',
    coverAudioTitle: '¿Reemplazar la pista de acompañamiento?',
    coverAudioDescription: 'Ya hay un audio cargado en Play-Along.',
    coverAudioConfirm: 'Sí, reemplazar audio',
  },
  shortcuts: {
    save: 'Guardar copia de seguridad (.json)',
    print: 'Imprimir o guardar en PDF',
    closeModal: 'Cerrar el diálogo abierto',
    help: 'Abrir la lista de atajos',
  },
  status: {
    saved: 'Guardado',
    saving: 'Guardando…',
    error: 'Sin guardar',
    errorTitle: 'No se pudo guardar en este navegador',
    sizeTitle: 'Espacio ocupado por la partitura',
  },
  share: {
    tooLongTitle: 'El enlace es demasiado largo',
    tooLongMessage:
      'La partitura es muy extensa para caber en una URL. Exporta el archivo .json o comparte el MusicXML.',
    copiedTitle: 'Enlace copiado',
    copiedMessage: 'Pégalo donde quieras compartir la partitura.',
    copiedErrorTitle: 'No se pudo copiar al portapapeles',
    copiedErrorMessage: 'Selecciona el texto y cópialo manualmente.',
  },
  import: {
    tooLargeTitle: 'El archivo es demasiado grande',
    tooLargeMessage: 'El límite es de 8 MB. Prueba a dividir la obra o exportarla por partes.',
    failedTitle: 'No se pudo leer el archivo',
    failedMessage: 'Revisa que sea MusicXML (.xml/.musicxml), MIDI (.mid) o una copia .json.',
    pdfTitle: 'Los PDF no se pueden interpretar como música',
    pdfMessage:
      'Un PDF es una imagen del papel: no contiene las notas. Ábrelo en MuseScore, Finale o Sibelius y exporta MusicXML para importarlo aquí.',
    successTitle: 'Partitura importada',
    successMessage: 'Se detectaron el compás y la tonalidad automáticamente.',
  },
  export: {
    doneTitle: 'Exportación lista',
    doneMessage: 'El archivo se descargó a tu carpeta de descargas.',
    failedTitle: 'La exportación falló',
    failedMessage: 'No se pudo generar el archivo. Inténtalo de nuevo o exporta en otro formato.',
  },
  practice: {
    micDeniedTitle: 'No hay acceso al micrófono',
    micDeniedMessage: 'Concede permiso al micrófono para usar el afinador y el modo práctica.',
    midiDeniedTitle: 'No hay acceso a los dispositivos MIDI',
    midiDeniedMessage: 'El navegador denegó el acceso MIDI. Revisa los permisos del sitio.',
  },
  player: {
    audioFailedTitle: 'No se pudo cargar el audio',
    audioFailedMessage: 'Comprueba que el archivo sea un audio válido (mp3, wav, ogg, m4a).',
  },
  aria: {
    scoreCanvas: 'Lienzo de la partitura',
    scoreDescription: (measures: number, staves: number, key: string, timeSignature: string) =>
      `Partitura de ${measures} compases y ${staves} pentagrama(s) en ${key}, compás de ${timeSignature}. Usa los atajos de teclado para escribir notas.`,
    statusRegion: 'Estado del editor',
    playhead: (measure: number, item: number) => `Reproduciendo compás ${measure}, figura ${item}`,
  },
} as const;

export type Copy = typeof es;
