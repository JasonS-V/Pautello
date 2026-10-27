# Lista operativa: mejora del OMR

Fecha: 27 de octubre de 2026. Base revisada: `c0c8313`.

La descripción, pasos, criterios, verificaciones y archivos de cada tarjeta están en [plan.md](plan.md). Las casillas marcadas corresponden a entregas verificadas; las tareas abiertas conservan su alcance completo. El diagnóstico original se mantiene como línea base.

## Revisión ya realizada

- [x] Leer flujo OMR y recorridos relevantes del editor y salidas.
- [x] Inspeccionar el PDF completo y confirmar que contiene una imagen sin texto extraíble.
- [x] Ejecutar 14 tests OMR y 349 tests totales: todos pasan.
- [x] Ejecutar build de producción: correcto.
- [x] Probar FP32 e INT8 con rasterización diagnóstica equivalente del PDF.
- [x] Reproducir pérdida de metadatos al reconciliar, ligadura de tres notas y omisiones de MusicXML.
- [x] Guardar diagnóstico, plan y evidencia de línea base.

## F0. Referencia y evaluación

- [x] F0.1. Registrar línea base reproducible por etapa, recurso y versión.
  - [x] Benchmark PDF con manifiesto de versiones, hashes, parámetros, tiempos, IR y Score en [omr-benchmark.md](omr-benchmark.md).
  - [x] Verificar que dos corridas FP32 tienen el mismo contenido musical sin IDs ni fechas.
  - [x] Cubrir imágenes externas y un conjunto de entradas identificadas por tipo.
- [x] F0.2. Transcribir y validar los 7 sistemas de El Rey.
  - [x] Confirmar visualmente 55 compases y separar índice, número de referencia y número impreso.
  - [x] Anotar eventos, posiciones aproximadas, atributos, ligaduras e indicaciones en una referencia local independiente del OMR.
  - [x] Contrastar la página y los siete sistemas ampliados; comprobar ritmo local, relaciones y hashes con `pnpm omr:reference`.
  - [x] Generar tabla de eventos y control auditivo independiente con tempos locales.
  - [x] Escuchar/validar la transcripción, resolver la función del compás inicial incompleto y aprobar la referencia.
- [x] F0.3. Construir corpus y separar obras/ediciones para evaluación.
- [x] F0.4. Definir métricas y objetivos de aceptación.
- [x] F0.5. Probar el importador completo con PDF.js y Canvas reales.
  - [x] Runner de interfaz reproducible con PDF externo, PNG externa, modelo real y restauración nativa sin inferencia, en desarrollo/build servido.
  - [x] Fallar si faltan pesos o fixtures obligatorios de la prueba neuronal.
  - [x] Registrar diferencias observadas PDF.js/Poppler y probar fuente/revisión posterior.
  - [x] Capturar todas las etapas/IR desde el runner y contrastarlas con la referencia independiente F0.2.
- [x] Puerta F0: referencia validada y evaluación reproducible; confianza separada de exactitud.

## F1. Fidelidad

- [x] F1.1. Conservar IR, trazabilidad, avisos estructurados y presentación honesta.
  - [x] Devolver IR y avisos con código, gravedad, procedencia y región; mostrar avisos y confianza en el modal.
  - [x] Mantener correspondencia estable entre evento de origen y elemento editable, aun con división de compás.
  - [x] Abrir la región de la imagen desde el aviso y conservar la sesión OMR durante la revisión posterior.
- [x] F1.2. Hacer reconciliación reversible y evitar alteración silenciosa de duraciones.
  - [x] El selector del modal conserva notas y armadura al cambiar de métrica y regresar; deja de reconciliar un JSON/MusicXML/restauración válida.
  - [x] Sustituir promociones y divisiones automáticas del conversor OMR por diagnósticos y propuestas justificadas.
- [x] F1.3. Preservar atributos locales y continuidad de ligaduras.
- [x] F1.4. Conservar barras, páginas y partes sin descartes por moda.
- [x] F1.5. Hacer explícitas conversiones con pérdida y estimaciones.
- [x] Puerta F1: regresiones H01–H03/H09 y controles del modal sin pérdida acumulativa.

## F2. Entrada y geometría

- [ ] F2.1. Inspeccionar calidad, rango de páginas y presupuesto de píxeles.
- [ ] F2.2. Ajustar contraste/orientación con transformaciones trazables.
- [ ] F2.3. Separar regiones conservando música e indicaciones originales.
- [ ] F2.4. Detectar pautas/sistemas y mantener identidad de parte.
- [ ] F2.5. Reemplazar truncamiento por ventanas/unión y coordenadas correctas.
- [ ] Puerta F2: todos los eventos conservados o pendientes; ninguna marca borrada de todas las rutas.

## F3. Motor de reconocimiento

- [x] F3.1. Documentar y verificar contrato/versionado de modelo y vocabulario.
- [ ] F3.2. Comparar preprocesamientos por ablación y categoría musical.
- [ ] F3.3. Apoyar barras, figuras y puntillos con geometría.
- [ ] F3.4. Evaluar búsqueda CTC acotada; implementar solo si mejora.
- [ ] F3.5. Comparar motor actual con alternativa existente y registrar decisión.
- [ ] F3.6. Ejecutar rama de ajuste/reentrenamiento únicamente si F3.5 la justifica.
- [ ] Puerta F3: motor elegido con exactitud medida y límites documentados.

Rama condicional F3.6:

- [ ] F3.6a. Taxonomía, datos, particiones y auditoría de anotación.
- [ ] F3.6b. Reproducción de arquitectura/configuración y evaluación anterior.
- [ ] F3.6c. Ajuste controlado y selección por validación.
- [ ] F3.6d. Exportación ONNX, cuantización y paridad WASM.
- [ ] F3.6e. Evaluación reservada, integración y recuperación de versión anterior.

## F4. Texto e indicaciones

- [ ] F4.1. Incorporar OCR por regiones con recursos locales.
- [ ] F4.2. Asignar título, compositor, arreglista y parte a roles correctos.
- [ ] F4.3. Reconocer marcas de tempo con figura, puntillos y anclaje.
- [ ] F4.4. Reconocer métricas locales, C y equivalencias de figuras.
- [ ] F4.5. Reconocer ensayo, segno, coda, saltos y destinos.
- [ ] F4.6. Reconocer calderón sobre silencio y otras indicaciones prioritarias.
- [ ] Puerta F4: cada indicación crítica reconocida o pendiente explícitamente y con región de origen.

## F5. Dominio y revisión

- [ ] F5.1. Extender/migrar dominio solo para información que actualmente se pierde.
- [ ] F5.2. Mapear IR a Score sin reinterpretación oculta.
- [ ] F5.3. Comparar fuente/notación con navegación por incidencias.
- [ ] F5.4. Corregir localmente, deshacer/rehacer y reconocer regiones.
- [ ] F5.5. Guardar borradores y confirmar sin reemplazar trabajo accidentalmente.
- [ ] Puerta F5: una persona puede corregir, verificar, guardar y continuar la revisión.

## F6. Grabado, intercambio y audio

- [ ] F6.1. Grabar indicaciones y aplicar disposición original/redistribuida coherente.
- [ ] F6.2. Conservar atributos/direcciones/navegación y metadatos en MusicXML.
- [ ] F6.3. Conservar notas, duraciones exactas y relaciones en MusicXML.
- [ ] F6.4. Definir recorrido musical común y verificable.
- [ ] F6.5. Aplicar recorrido y tiempos locales al reproductor.
- [ ] F6.6. Exportar MIDI con la ruta y cambios temporales declarados.
- [ ] F6.7. Exportar WAV coherente con reproductor y tempos locales.
- [ ] Puerta F6: guardado, impresión, intercambio y audio conservan la misma semántica.

## F7. Ejecución, memoria y offline

- [ ] F7.1. Separar cálculo pesado y cancelar/reintentar con seguridad.
- [ ] F7.2. Procesar/liberar por página y medir memoria máxima.
- [ ] F7.3. Preparar recursos offline y versionarlos por contenido.
- [ ] F7.4. Seleccionar runtime con mediciones y gestionar fallos/respaldo.
- [ ] Puerta F7: cancelación, presupuesto y primera importación offline preparada verificados.

F7.1 puede adelantarse tras F1.1 y F0.5; no requiere terminar todo el reconocimiento de indicaciones.

## F8. Robustez y calidad continua

- [ ] F8.1. Evaluar condiciones de imagen con métricas por categoría.
- [ ] F8.2. Ampliar notación/polifonía por capacidades independientes posteriores.
- [ ] F8.3. Probar flujo completo en web y Electron realmente instalados.
- [ ] F8.4. Añadir gates de CI para inferencia, corpus, recursos y semántica.
- [ ] Puerta F8: cobertura y plataformas probadas explícitas; regresiones controladas.

Ampliación posterior F8.2:

- [ ] F8.2a. Acordes simultáneos y relaciones por altura.
- [ ] F8.2b. Dos voces independientes.
- [ ] F8.2c. Piano/ensambles y sistemas con pautas ocultas.
- [ ] F8.2d. Figuras, tuplets y claves adicionales según demanda.
- [ ] F8.2e. Decidir por separado letras, cifrado, tablatura, percusión o manuscritos.

## F9. Aceptación y uso

- [ ] F9.1. Superar aceptación completa de El Rey y registrar esfuerzo humano.
- [ ] F9.2. Repetir aceptación en al menos tres obras independientes.
- [ ] F9.3. Documentar capacidades, límites, recursos y flujo de revisión.
- [ ] F9.4. Preparar actualización, recuperación y evaluación de versión de prueba.
- [ ] Puerta F9: obra completa y generalización verificadas; versión recuperable lista para revisión.

## Condiciones de cierre

- [ ] Completar la lista de aceptación de la sección 10 de `plan.md`.
- [ ] Mantener separados resultado automático, reparaciones propuestas y resultado confirmado.
- [x] Conservar referencia y recursos anteriores para investigar regresiones.
- [x] Ejecutar controles apropiados al cambio y registrar resultados.
- [ ] Resolver la decisión de motor antes de invertir en entrenamiento propio.
- [x] No declarar soporte o precisión que no tenga una prueba representativa.

Evidencia: diagnóstico original en [omr-baseline.json](omr-baseline.json), benchmark en [omr-benchmark.md](omr-benchmark.md), matriz reproducible en [omr-benchmark-cases.json](omr-benchmark-cases.json), referencia local en [omr-reference.md](omr-reference.md), corpus/métricas/contrato de modelo en [omr-corpus.md](omr-corpus.md) ([omr-corpus.json](omr-corpus.json)) y capacidades/pruebas de navegador en [omr-fidelity.md](omr-fidelity.md).

Avance: F0.1–F0.5 (Puerta F0), F1.1–F1.5 (Puerta F1) y F3.1 implementadas y verificadas. La referencia de _El Rey_ (`tasks/local/el-rey-ground-truth.json`) y las referencias de validación en Sol (`src/omr/__tests__/fixtures/line-reference.json`) y Fa (`tasks/local/qdrt-ground-truth.json`) están aprobadas (`reviewed`, 2 pasadas visuales + audición). El corpus (`tasks/omr-corpus.json`, 17 muestras, 11 obras, 58 páginas) separa estrictamente por `workId` y edición (`pnpm omr:corpus`). El evaluador (`pnpm omr:evaluate`) mide coincidencia exacta, altura, duración, alteraciones, barras, estructura y esfuerzo humano manteniendo separada la confianza CTC (`confidenceIsAccuracy: false`). El runner real de navegador (`scripts/omr-ui-check.mjs`) captura todas las etapas (`stages.json`), IR (`ir.json`), conversión y Score sobre Edge + PDF.js + Canvas + WASM ONNX. El contrato de modelo y vocabulario (`public/omr/model-manifest.json`, `src/omr/omrModelContract.ts`) valida hashes, dimensiones y tokens en tiempo de ejecución (`R19`). Los recursos privados permanecen en `tasks/local/`, fuera de Git.

Verificación actual: 412 pruebas en 52 archivos, build de producción correcto y lint global sin errores (65 advertencias fuera del cambio). Cobertura: 49.34 % de líneas/sentencias, 68.74 % de ramas y 65.39 % de funciones; supera los umbrales.

La verificación de navegador de F1 y F0.5 comprobó PDF e imagen externos (`El Rey - Guitarron.pdf`, `Guitarron QDRT.pdf`, `line.png`), restauración nativa y revisión tras importar en Edge; modal inspeccionado a 320 px. El recorrido móvil general y Electron instalado siguen sin validarse.

Formato: los archivos de esta continuación pasan Prettier, incluidos los scripts mediante control explícito. El control global conserva fallos previos en archivos ajenos a este avance; no se reformatearon como parte de F0.
