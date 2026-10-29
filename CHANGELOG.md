# Historial de Cambios (Changelog)

Todos los cambios notables en este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.5.0] - 2026-10-29

### 🌟 Mayor Actualización de Rendimiento, Notación y Polifonía

#### Añadido y Mejorado

- **Rendimiento y Arquitectura React:**
  - Desacoplamiento total del cursor de reproducción y del motor temporal mediante `useSyncExternalStore` con estados inmutables congelados, erradicando re-renders masivos al reproducir.
  - Modularización integral de `ScoreView`, `ScoreInspector` y hooks de mutación en submódulos especializados (`useMeasureMutations`, `useNoteMutations`, `usePlaybackState`).
  - Reducción del bundle principal de producción en más del 50% con división de código (_code-splitting_) dinámico en modales e importaciones bajo demanda.

- **Grabado Musical, Notación y Polifonía:**
  - Soporte completo para acordes simultáneos polifónicos con edición granular por altura, octava y alteración accidental.
  - Dos voces métricas independientes por pentagrama con plicas opuestas, cálculo de streams independientes desde el pulso 0 y alineación temporal exacta.
  - Detección y preservación de Gran Pentagrama (_Grand Staff_) para piano y agrupaciones con continuidad de instrumentos ante compases tacet.
  - Soporte extendido para repeticiones, marcas de navegación (`Segno`, `To Coda`, `D.S. al Coda`, `Coda`), marcas de ensayo (`[A]`, `[B]`) y calderones tanto en notas como en silencios.
  - Jerarquía tipográfica refinada con EB Garamond para títulos líricos y JetBrains Mono para tempo y cifras de compás.

- **Interoperabilidad y Audio (MusicXML 4.0, MIDI y WAV):**
  - Exportación e importación conforme al estándar estricto de MusicXML 4.0 con soporte para marcas metronómicas, directivas de dinámica y retroceso métrico `<backup>` en voces secundarias.
  - Motor de audio y sintetizador que recorren fielmente los saltos de navegación y tiempos locales, asegurando paridad sonora absoluta entre el reproductor en vivo, la exportación WAV y los archivos MIDI multitrack.

- **Reconocimiento Óptico de Partituras (OMR) Asistido:**
  - Flujo integrado para digitalizar partituras desde PDF o imágenes mediante inferencia neuronal local (ONNX Web WASM) y OCR sin conexión, con panel de revisión interactivo que permite corregir compases y notas de forma no destructiva con persistencia local antes de confirmar.

- **Experiencia de Usuario e Interfaz Dark Studio DAW:**
  - Interfaz profesional en modo oscuro refinada con paleta Slate/Indigo (`#0F172A`, `#111319`, `#6366F1`), iconografía Hugeicons de trazo limpio y atajos de teclado globales accesibles.
  - Modales adaptables con prevención de desbordamientos y soporte responsive optimizado.

- **Pruebas y Calidad de Código:**
  - Suite de 71 archivos y 529 pruebas automatizadas con Vitest cubriendo dominio musical, audio, grabado, esquemas e integración.

---

## [1.0.0] - 2026-09-18

### 🚀 Lanzamiento Inicial (First Release)

#### Añadido

- **Editor y Grabado Musical:**
  - Sistema de notación musical en lienzo SVG optimizado y modular.
  - Soporte completo para figuras rítmicas: redondas, blancas, negras, corcheas, semicorcheas y fusas.
  - Silencios, puntillos, alteraciones (sostenido, bemol, becuadro) y ligaduras.
  - Selección y edición de armaduras, claves (Sol, Fa, Do) y compases (4/4, 3/4, 2/4, 6/8, 2/2).
  - Soporte para Sistema de Piano / Doble Pentagrama (**Grand Staff**) y Tablatura de guitarra interactiva.
  - Etiquetas pedagógicas de solfeo (`Do`, `Re`, `Mi`...) y cifrado internacional (`C`, `D`, `E`...).
- **Motor de Audio y Síntesis Sonora:**
  - Sintetizador polifónico en tiempo real utilizando la Web Audio API nativa.
  - Instrumentos integrados: Piano Acústico, Marimba, Cuerdas, Flauta y soporte para Soundfonts Soundfont-MIDI.
  - Metrónomo interactivo con tempo dinámico (BPM de 30 a 300) y acentuación en el primer pulso.
  - Cursor de barrido visual de reproducción sincronizado nota a nota.
- **Modo Práctica y Afinador:**
  - Detector de tono y frecuencia por micrófono en vivo para práctica instrumental interactiva.
  - Evaluación y feedback de entonación y precisión rítmica con resumen de resultados.
  - Pista de acompañamiento de audio (_Play-Along_).
- **Importación y Exportación:**
  - Exportación e impresión directa en PDF vectorial de alta resolución en formato A4 / Carta.
  - Exportación e importación de archivos **MusicXML** (.musicxml / .xml) compatibles con MuseScore, Sibelius, Finale y Dorico.
  - Exportación a archivo de audio **WAV** polifónico sin pérdida.
  - Exportación a archivo binario **MIDI** SMF Formato 0 multicanal / multi-staff.
  - Exportación de imágenes SVG / PNG de compases y fragmentos.
  - Respaldo completo en formato JSON y compresión/descompresión para compartir partituras por enlace URL.
- **Plataformas y Distribución:**
  - Modo sin conexión (PWA) con Service Worker y precache de recursos y modales bajo demanda.
  - Aplicación de escritorio nativa para Windows con instalador NSIS empaquetado mediante Electron.
  - Atajos de teclado intuitivos y tour guiado de bienvenida (_onboarding_).
