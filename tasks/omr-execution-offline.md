# F7 — Ejecución, memoria y offline

Estado al 29 de octubre de 2026: implementación F7.1–F7.4 terminada y verificada. La **Puerta F7** queda aprobada y cerrada mediante 505 pruebas automáticas en 68 archivos, compilación de tipos (`tsc -b`), empaquetado de producción (`pnpm build`) y validación E2E en navegador real (Microsoft Edge 156) con Service Worker activo, cancelación en archivo denso e importación neuronal 100 % desconectada de red (`context.setOffline(true)`).

---

## F7.1. Separar cálculo pesado y permitir cancelar

- **Worker ES module dedicado:** Se implementó `src/omr/omrCompute.worker.ts` y la capa de abstracción `src/omr/omrCompute.ts`. Las etapas de mayor coste computacional (detección adaptativa de pautas, preprocesamiento y binarización de página, e inferencia CRNN-CTC con ONNX Runtime Web) se ejecutan fuera del hilo principal de la interfaz de usuario.
- **Transferencia eficiente de memoria:** Los buffers `Float32Array` se transfieren mediante `postMessage(message, [buffer])` evitando duplicación y copias innecesarias en el heap principal.
- **Compatibilidad y fallback transparente:** Si `typeof Worker === 'undefined'` (entornos Node.js, Vitest, o contextos restringidos), `createOmrCompute` conmuta de forma transparente al cálculo en hilo principal sin alterar el contrato público.
- **Cancelación inmediata y segura con `AbortSignal`:**
  - El modal de importación (`ImportModal.tsx`) expone el botón interactivo **«Cancelar importación»** activo durante todas las etapas pesadas.
  - Al abortar la señal, `createOmrCompute` interrumpe de inmediato cualquier petición pendiente con `abortOmr()` (`DOMException('Importación cancelada.', 'AbortError')`), invoca `worker.terminate()` para frenar de inmediato la ejecución WASM/C++ de ONNX, y cancela las tareas activas de PDF.js (`loadingTask.destroy()`).
  - La interfaz limpia los estados intermedios y devuelve el modal a su pantalla inicial de selección («Arrastra tu partitura aquí»), sin alterar la partitura actualmente abierta ni dejar promesas huérfanas en el runtime.
  - Comprobado en Edge cancelando la lectura del PDF denso _El Rey - Guitarron.pdf_ (~3 segundos de procesamiento): el botón responde de inmediato y el modal se reinicia sin bloqueos.

---

## F7.2. Acotar memoria por página

- **Procesamiento secuencial estricto:** `omrEngine.ts` desacopla la extracción, geometría, OCR, inferencia neuronal e IR página por página:
  ```
  Página N: Carga lazy -> Detección/Geometría -> OCR regional -> Inferencia ventanas -> Integración IR -> Liberación
  ```
- **Liberación inmediata de tensores y buffers:**
  - Tras procesar las ventanas de una página, se vacía de inmediato el buffer en escala de grises: `p.gray = new Float32Array(0)`.
  - Los lienzos de inspección y rasterización de Canvas se reducen a tamaño cero (`canvas.width = 0; canvas.height = 0`) para devolver memoria gráfica al navegador.
  - La lista de ventanas preparadas para inferencia se vacía de inmediato: `pageObj.result.inputs = []`.
- **Huella de memoria acotada:**
  - Una página estándar tamaño Carta a 1440 × 1900 en Float32 ocupa ~10,44 MiB.
  - Gracias al pipeline secuencial y la liberación explícita, el pico de memoria no escala con el número acumulado de páginas (<25 MiB para la página activa frente a >210 MiB acumulados que requeriría retener 20 páginas simultáneas).
- **Presupuesto de píxeles y selección estricta:**
  - `checkPixelBudget` valida las dimensiones de entrada antes de instanciar lienzos o tensores, asegurando que un documento de 1 página (2,73 Mpx), 10 páginas (27,36 Mpx) o 20 páginas (54,72 Mpx) se mantenga dentro del límite de 60 Mpx, rechazando de antemano desbordamientos antes de asignar memoria.
  - `selectPdfPages` exige rangos válidos ante documentos superiores a 20 páginas.

---

## F7.3. Recursos offline y versionado por contenido

- **Service Worker con caché OMR independiente:** `src/pwa/sw-template.js` administra un almacén específico `pautello-omr-${VERSION}`, aislado del almacenamiento de sesiones de usuario y de la caché de la aplicación general.
- **Inyección y validación por hashes SHA-256 (`__SW_OMR__`):** En `vite.config.ts`, se compilan y sellan los 11 recursos indispensables para ejecutar el reconocimiento óptico y OCR de forma 100 % autónoma:
  1. `ort-wasm-simd-threaded.jsep.wasm`
  2. `ort-wasm-simd-threaded.wasm`
  3. `omr-line.fp32.onnx`
  4. `omr-line.int8.onnx`
  5. `vocab_char.json`
  6. `model-manifest.json`
  7. `pdf.worker.min.mjs`
  8. `ocr/worker.min.js`
  9. `ocr/tesseract-core-lstm.wasm.js`
  10. `ocr/eng.traineddata.gz` (con validación de hash del contenido descomprimido)
  11. `ocr/spa.traineddata.gz`
- **Gestión de estado y preparación explícita:**
  - `src/pwa/omrOffline.ts` consulta el estado mediante canales de mensajería con el Service Worker (`OMR_STATUS` y `OMR_PREPARE`).
  - `ImportModal.tsx` muestra un indicador visible con el estado de disponibilidad sin conexión: botón de descarga progresiva cuando no están listos y mensaje de confirmación «OMR preparado para usar sin conexión» una vez verificados todos los hashes.
- **Verificación sin conexión en navegador real:**
  - En Microsoft Edge sobre el build de producción, se prepararon los recursos en el Service Worker y posteriormente se forzó la desconexión total de red (`context.setOffline(true)`).
  - La importación neuronal de `line.png` completó con éxito el 100 % del pipeline utilizando ONNX Runtime Web WASM y el vocabulario precacheado, registrando `sourceType: "neural-onnx"` y produciendo la partitura editable sin una sola petición de red saliente.

---

## F7.4. Seleccionar runtime y gestionar fallos

- **Configuración óptima de runtime:**
  - ONNX Runtime Web configurado con 1 hilo (`numThreads: 1`), garantizando compatibilidad total en entornos locales `file:` (Electron) y despliegues web estándar sin requerir cabeceras estrictas de aislamiento de hilos (`Cross-Origin-Opener-Policy` y `Cross-Origin-Embedder-Policy`).
  - Comprobación criptográfica de integridad de los pesos y del vocabulario contra `model-manifest.json` antes de instanciar sesiones.
- **Estrategia de respaldo y recuperación:**
  - Modelo FP32 como variante preferida por fidelidad numérica, con fallback automático y seguro a INT8 si falla la inicialización o verificación de FP32.
  - En caso de fallo inesperado de ejecución en mitad de una página (por ejemplo, desbordamiento WASM tras procesar ventanas previas), el worker emite `OMR_MODEL_RESTART_INT8:`, reiniciando limpiamente la sesión con el modelo INT8 sin dejar promesas envenenadas ni acumulaciones de estado corrupto.
  - Las promesas fallidas se limpian de la caché interna de runtime (`cachedRuntimePromise = null`), permitiendo reintentos inmediatos sin necesidad de recargar la aplicación.

---

## Puerta F7: Criterios de Aceptación y Resultados

| Criterio de Puerta F7 | Estado | Evidencia |
| :--- | :---: | :--- |
| **Separación de cálculo en Worker** | **Aprobado** | Worker ES module `src/omr/omrCompute.worker.ts` empaquetado en chunk independiente (`omrCompute.worker-CE207--i.js`). |
| **Cancelación interactiva y limpia** | **Aprobado** | Botón en `ImportModal.tsx` con respuesta inmediata, `AbortSignal`, terminación de worker y reset a estado inicial verificado en Edge con PDF denso. |
| **Presupuesto y liberación de memoria** | **Aprobado** | `checkPixelBudget` verificado hasta 60 Mpx; liberación secuencial `p.gray = new Float32Array(0)` y Canvas a 0 px probados en `omrMemoryBudget.test.ts`. |
| **Recursos offline sellados por hash** | **Aprobado** | 11 recursos OMR verificados por SHA-256 en Service Worker `pautello-omr-v*`; importación neural ejecutada con red 100 % desconectada en Edge. |
| **Gestión de runtime y respaldo INT8** | **Aprobado** | Contrato de integridad SHA-256, fallback automático a INT8 y reinicio limpio sin promesas retenidas verificado en `omrRuntime.test.ts` y `omrComputeWorker.test.ts`. |
| **Pruebas automáticas y compilación** | **Aprobado** | 505 pruebas aprobadas en 68 suites (`pnpm test -- --maxWorkers=2`); `tsc -b` limpio; ESLint y Prettier aprobados. |

Con estas comprobaciones, la **Fase F7 queda formalmente concluida y la Puerta F7 cerrada**.
