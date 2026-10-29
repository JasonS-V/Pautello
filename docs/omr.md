# Reconocimiento Óptico Musical (OMR) en Pautello — Guía de Uso, Alcance y Mantenimiento

Pautello incluye un motor de Reconocimiento Óptico Musical (OMR) 100 % local ejecutado en un Web Worker mediante ONNX Runtime Web (WebAssembly) y lectura de indicaciones de página.

---

## 1. Niveles de resultado al importar

Pautello distingue de forma explícita cuatro niveles de resultado para evitar confundir una lectura automática con una transcripción verificada:

1. **Restauración nativa (`lossless-metadata`):**
   - Cuando se importa un PDF o PNG exportado previamente desde Pautello, la aplicación recupera el bloque de metadatos embebido sin pérdida musical alguna.
2. **Lectura automática (`neural-onnx` / `reviewStatus: 'automatic'`):**
   - Cuando se importa un PDF o imagen externa, el motor CRNN-CTC detecta sistemas, pautas, barras de compás, notas, silencios y signos locales.
   - El porcentaje mostrado junto a la insignia OMR indica la **confianza media del decodificador CTC** sobre los tokens emitidos; **nunca equivale a exactitud musical**.
3. **Propuestas por revisar:**
   - **Propuestas de división:** compases cuya suma de duraciones supera la métrica pero admite una división exacta en compases completos.
   - **Indicaciones por asignar o revisar:** marcas de texto, tempo, ensayo o navegación cuyo anclaje al compás requiere confirmación visual.
   - **Texto editorial propuesto:** título, compositor, arreglista, parte y copyright con su porcentaje de confianza OCR.
4. **Resultado confirmado (`revisado por persona` vs `importado con pendientes`):**
   - Si el usuario verifica todos los compases, avisos e indicaciones sin dejar eventos pendientes, la sesión queda marcada como `revisado por persona` (`reviewStatus: 'reviewed'`).
   - Si el usuario carga la partitura en el editor antes de completar todas las verificaciones, queda marcada como `importado con pendientes` (`reviewStatus: 'confirmed-with-pending'`).
   - En ambos casos se conserva el borrador automático original (`recognizedScore`) separado del `Score` confirmado (`score`), junto con el número de intervenciones (`interventionCount`) y el tiempo de revisión (`reviewDurationSeconds`).

---

## 2. Flujo de revisión asistida

1. Abre **Archivo → Importar...** y selecciona un archivo `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp` o `.svg` (máximo 16 MB; hasta 20 páginas por importación en PDF, pudiendo indicar un rango como `1,3-5` y la orientación `Automática`, `0°`, `90°`, `180°` o `270°`).
2. En el panel izquierdo (**Revisión de lectura OMR**):
   - Revisa la lista de avisos localizados por página, sistema y pauta.
   - Pulsa **Ver región** para centrar el recorte original de la página sobre el compás o símbolo señalado, o **Ver regiones conservadas** para superponer las cajas detectadas.
3. En el panel derecho (**Notación editable**):
   - Selecciona la parte y el compás que deseas inspeccionar.
   - Corrige cualquier evento (tipo nota/silencio, altura `C`–`B`, octava `1`–`7`, alteración `#`/`b`/`n`, figura `w`–`32`, puntillo, ligadura de salida, calderón, barra de compás) o añade/elimina eventos.
   - Abre **Propiedades e indicaciones del compás** para ajustar número impreso, anacrusa, salto de sistema, cambio de métrica local (`3/4`, `4/4`, compasillo `C`, `2/4`, `6/8`), marca de ensayo, texto de estilo/tempo o marca de navegación (`Segno`, `To Coda`, `D.S. al Coda`, `Coda`) y su compás de destino.
   - Si un compás requiere una segunda lectura localizada, pulsa **Volver a reconocer este compás**.
4. Utiliza **Deshacer corrección**, **Rehacer corrección**, **Guardar borrador** o **Marcar todo como verificado** antes de pulsar **Cargar en el Editor**.

---

## 3. Recursos locales, modo sin conexión y borradores

- **Artefactos del modelo (`public/omr/`):**
  - `omr_model.onnx` (FP32 primario, `3,74 MB`).
  - `omr_model.int8.onnx` (INT8 cuantizado de respaldo automático ante falta de memoria o fallo de sesión FP32, `0,99 MB`).
  - `vocab.json` (`141` tokens + blank CTC = `142` clases) y `model-manifest.json` (`contractVersion: 1.0.0`).
- **Uso sin conexión (Offline PWA):**
  - En producción, el botón **Preparar OMR sin conexión** del modal de importación almacena y verifica los pesos ONNX, el vocabulario y el runtime WebAssembly en la caché local (`pautello-omr-v1`).
- **Recuperación de borradores:**
  - Los borradores en curso se guardan automáticamente en IndexedDB (`pautello_omr_drafts`) y pueden retomarse desde el botón **Continuar borrador OMR guardado** sin sobrescribir la partitura abierta en el editor.

---

## 4. Capacidades y límites medidos

- **Impresión limpia en clave de Sol (`G2`):** exactitud automática del 100 % en la muestra de referencia `pdmx-line-g2` (`6/6` compases, `12/12` eventos).
- **Impresión en clave de Fa (`F4`, partes de Guitarrón / Bajo):** el segmentador y la geometría localizan las pautas, barras y duraciones con alta fidelidad (p. ej. `100/100` compases y `89,36 %` en altura + duración en `Guitarron QDRT.pdf`), pero las alturas en clave de Fa y las indicaciones complejas de página requieren revisión asistida para alcanzar el 100 % de exactitud confirmada.
- **Fotografías de cámara o mensajería (JPEG comprimido):** el preprocesador corrige inclinaciones moderadas y sombras suaves y conserva todas las regiones dudosas con avisos explícitos (`0` pérdidas estructurales silenciosas), requiriendo mayor edición asistida cuando hay cifrados densos pegados a la pauta o compresión fuerte.

---

## 5. Actualización, rollback y migraciones

- Cualquier actualización de `omr_model.onnx`, `omr_model.int8.onnx` o `vocab.json` debe actualizar `public/omr/model-manifest.json`, superar `pnpm omr:evaluate` y las pruebas de contrato (`src/omr/__tests__/omrModelContract.test.ts` y `src/omr/__tests__/omrCiGate.test.ts`).
- `verifyModelReleaseCoherence` impide mezclar versiones distintas de vocabulario y pesos en caché, y `verifyModelRollbackTransition` verifica el regreso limpio a la versión anterior sin modificar el esquema `Score` (`schemaVersion: 2`).
- `normalizeScore` y `migrateOmrDraftRecord` garantizan la apertura de proyectos y borradores guardados con versiones anteriores del esquema.
