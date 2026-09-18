# Historial de Cambios (Changelog)

Todos los cambios notables en este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
