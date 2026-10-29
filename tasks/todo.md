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

- [x] F2.1. Inspeccionar calidad, rango de páginas y presupuesto de píxeles.
  - [x] Validar tipo real, exigir selección explícita en PDF de más de 20 páginas, permitir omitir páginas mediante lista/rangos y avisar de páginas omitidas.
  - [x] Verificar píxeles por página y presupuesto total antes de rasterizar; quitar ampliación arbitraria de imágenes pequeñas.
  - [x] Señalar páginas vacías, tenues, sin pautas y con separación de líneas menor de 6 px.
  - [x] Elegir resolución PDF según espaciado y detalle mínimo; detectar eje de 90°/270°, señalar ambigüedad de 180° y permitir confirmar el giro.
- [x] F2.2. Ajustar contraste/orientación con transformaciones trazables.
  - [x] Comparar gris/local/adaptativa sobre el corpus; mejora de contraste tenue de 83.33 % a 100 % exacto, conservando la imagen limpia.
  - [x] Conservar matrices afines invertibles y exigir mejora de calidad; binarización degradante descartada en selección automática.
- [x] F2.3. Separar regiones conservando música e indicaciones originales.
  - [x] Conservar recorte completo, copia anterior al contraste y fuente; máscaras propuestas con motivo, sin borrados en producción.
  - [x] Localizar tinta exterior y candidatos periféricos como pendientes; comparar máscaras sin aceptarlas por confianza.
- [x] F2.4. Detectar pautas/sistemas y mantener identidad de parte.
  - [x] Comparar todos los umbrales, puntuar continuidad/espaciado y conservar sistemas cortos o líneas rotas.
  - [x] Separar pautas, sistemas y partes; usar nombres PDF/clave/orden y exponer agrupaciones e identidades ambiguas.
  - [x] Verificar El Rey (7 sistemas, 1 parte), QDRT (10 sistemas), instrumentos de igual clave y plantillas que cambian entre páginas.
- [x] F2.5. Reemplazar truncamiento por ventanas/unión y coordenadas correctas.
  - [x] Cubrir todo el ancho con solapamiento y contexto visual, sin duplicar la cabecera; conservar hipótesis y uniones ambiguas.
  - [x] Verificar línea sintética de 9000 px, concatenación real >3600 normalizados y caso denso QDRT en 30 ventanas.
  - [x] Proyectar cajas a la fuente original tras escala, giro y desplazamiento; marcar ventanas vacías o registros que cruzan el contexto.
- [x] Puerta F2: todos los eventos conservados o pendientes; ninguna marca borrada de todas las rutas.

## F3. Motor de reconocimiento

- [x] F3.1. Documentar y verificar contrato/versionado de modelo y vocabulario.
- [x] F3.2. Comparar preprocesamientos por ablación y categoría musical.
  - [x] Ejecutar 112 condiciones/decodificadores sobre ocho muestras de tres obras, con referencias de eventos de Sol y Fa y aceptación separada de El Rey.
  - [x] Conservar resultados negativos y métricas antes del parser/unión, después de ambos y tras Score, desglosadas por figura, puntillo y silencio.
  - [x] Mantener los parámetros F2: el raster al 75 % es candidato limitado a dos obras etiquetadas, sin evidencia suficiente para adoptarlo globalmente.
- [x] F3.3. Apoyar barras, figuras y puntillos con geometría.
  - [x] Localizar 6/6 barras de la referencia visual frente a 3/6 centros CTC dentro de 8 px; mantener desacuerdos y coordenadas de origen.
  - [x] Conservar alternativas de cabeza, plica, unión y puntillo en el IR; no aceptar reparaciones automáticas con 6/9 cabezas correctas ni añadir música para llenar compases.
  - [x] Mostrar avisos geométricos localizados y verificar el acceso a su región en Edge, incluyendo ventanas unidas.
- [x] F3.4. Evaluar búsqueda CTC acotada; implementar solo si mejora.
  - [x] Probar suma de caminos, blank/repeticiones, enumeración exhaustiva y gramática suave; comparar ancho 8 y top-K 4 con voraz.
  - [x] Conservar el voraz en producción: mismo error de eventos con mayor latencia en beam/gramática; prototipo solo experimental.
- [x] F3.5. Comparar motor actual con alternativa existente y registrar decisión.
  - [x] Ejecutar Audiveris 5.11.0 local con OCR preparado sobre Sol, QDRT, El Rey y Usted; conservar también el rechazo por baja resolución.
  - [x] Medir salida nativa y después del importador: QDRT pasa de 89.36 % exacto nativo a 47.87 % importado por alteraciones materializadas.
  - [x] Registrar recursos, licencias, latencia y ediciones estimadas; tiempo humano real pendiente de F9, sin presentarlo como medido.
  - [x] Elegir FP32/voraz asistido como predeterminado y Audiveris mediante intercambio externo MusicXML; no empaquetar otro motor.
- [x] F3.6. Resolver la condición de ajuste/reentrenamiento: **no se activa** según F3.5; no se ejecutaron F3.6a–e.
- [x] Puerta F3: motor elegido con exactitud medida y límites documentados en [omr-recognition.md](omr-recognition.md); meta automática del 98 % no alcanzada, se mantiene revisión asistida.

Rama condicional F3.6, **no activada** por la decisión F3.5. Las casillas siguientes no representan trabajo ejecutado ni bloquean el cierre de la decisión F3; solo aplican si se reabre el entrenamiento:

- [ ] F3.6a. Taxonomía, datos, particiones y auditoría de anotación.
- [ ] F3.6b. Reproducción de arquitectura/configuración y evaluación anterior.
- [ ] F3.6c. Ajuste controlado y selección por validación.
- [ ] F3.6d. Exportación ONNX, cuantización y paridad WASM.
- [ ] F3.6e. Evaluación reservada, integración y recuperación de versión anterior.

## F4. Texto e indicaciones

- [x] F4.1. Incorporar OCR por regiones con recursos locales.
  - [x] Separar cabecera, espacios entre sistemas y pie por columnas; reutilizar texto PDF localizado y leer regiones sin texto con palabras, cajas y confianza.
  - [x] Empaquetar worker, núcleo LSTM y datos inglés/español en `public/omr/ocr`; Edge leyó título, compositor y «D.S. al Coda» con red externa bloqueada.
  - [x] Comprobar texto inclinado y no musical, y conservar aviso con región si falla una lectura.
- [x] F4.2. Asignar título, compositor, arreglista y parte a roles correctos; propuestas editables y texto no clasificado conservado. Un crédito «Trans.» no se atribuye al compositor.
- [x] F4.3. Reconocer marcas de tempo con figura, puntillos y anclaje; blanca = 60 y negra = 90 sobreviven como marcas locales distintas.
- [x] F4.4. Reconocer métricas locales, C y equivalencias de figuras; 3/4 → C/4/4 → 3/4 y corchea anterior = negra posterior (90 → 180 BPM) quedan localizados en el IR.
- [x] F4.5. Reconocer ensayo, segno, coda, saltos y destinos; B conserva la letra pero deja pendiente su compás, y los destinos ausentes o ambiguos emiten aviso.
- [x] F4.6. Reconocer calderón sobre silencio y otras indicaciones prioritarias; arcos sin punto se conservan como símbolos pendientes.
- [x] Puerta F4: 14 indicaciones reconocidas y 1 pendiente con región de origen en El Rey; detalle y límites en [omr-indications.md](omr-indications.md).

## F5. Dominio y revisión

- [x] F5.1. Esquema 2: arreglista separado, figura/puntillos de tempo, equivalencia, C, numeración, destinos de navegación y marcador de relleno OMR; proyectos antiguos conservan contenido.
- [x] F5.2. Indicaciones del IR al Score por anclaje exacto o propuesta explícita; las no representables siguen pendientes y las ediciones manuales conservan su procedencia en la sesión.
- [x] F5.3. Fuente y notación del compás seleccionado en paralelo, selección de eventos, localización de avisos, zoom de la fuente y estado pendiente/revisado legible.
- [x] F5.4. Corrección local de nota/silencio, altura, figura, puntillo, barra, parte y destino; decisiones reversibles y relectura regional propuesta sin reemplazar otros compases.
- [x] F5.5. Borrador local en IndexedDB con fuente, IR y decisiones, presupuesto de 24 millones de caracteres, recuperación y confirmación en una sola operación reversible del editor; fallo de guardado no reemplaza la partitura abierta.
- [x] Puerta F5: flujo de corregir, verificar, guardar y continuar probado en Edge; límites y evidencia en [omr-domain-review.md](omr-domain-review.md).

## F6. Grabado, intercambio y audio

- [x] F6.1. Grabar indicaciones y aplicar disposición original/redistribuida coherente.
- [x] F6.2. Conservar atributos/direcciones/navegación y metadatos en MusicXML.
- [x] F6.3. Conservar notas, duraciones exactas y relaciones en MusicXML.
- [x] F6.4. Definir recorrido musical común y verificable.
- [x] F6.5. Aplicar recorrido y tiempos locales al reproductor.
- [x] F6.6. Exportar MIDI con la ruta y cambios temporales declarados.
- [x] F6.7. Exportar WAV coherente con reproductor y tempos locales.
- [ ] Puerta F6: guardado, impresión, intercambio y audio conservan la misma semántica; falta comprobación manual en editor externo y escucha.

## F7. Ejecución, memoria y offline

- [x] F7.1. Separar cálculo pesado y cancelar/reintentar con seguridad.
- [x] F7.2. Procesar/liberar por página y medir memoria máxima.
- [x] F7.3. Preparar recursos offline y versionarlos por contenido.
- [x] F7.4. Seleccionar runtime con mediciones y gestionar fallos/respaldo.
- [x] Puerta F7: cancelación, presupuesto y primera importación offline preparada verificados.

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
- [x] Resolver la decisión de motor antes de invertir en entrenamiento propio.
- [x] No declarar soporte o precisión que no tenga una prueba representativa.

Evidencia: diagnóstico original en [omr-baseline.json](omr-baseline.json), benchmark en [omr-benchmark.md](omr-benchmark.md), matriz reproducible en [omr-benchmark-cases.json](omr-benchmark-cases.json), referencia local en [omr-reference.md](omr-reference.md), corpus/métricas/contrato de modelo en [omr-corpus.md](omr-corpus.md) ([omr-corpus.json](omr-corpus.json)) capacidades/pruebas de navegador en [omr-fidelity.md](omr-fidelity.md) y fase F2 en [omr-geometry.md](omr-geometry.md) ([resultados](omr-geometry-results.json)).

Avance: F0.1–F0.5 (Puerta F0), F1.1–F1.5 (Puerta F1), F2.1–F2.5 (Puerta F2), F3.1–F3.5 y decisión condicional F3.6 (Puerta F3) implementadas y verificadas. La referencia de _El Rey_ (`tasks/local/el-rey-ground-truth.json`) y las referencias de validación en Sol (`src/omr/__tests__/fixtures/line-reference.json`) y Fa (`tasks/local/qdrt-ground-truth.json`) están aprobadas (`reviewed`, 2 pasadas visuales + audición). El corpus (`tasks/omr-corpus.json`, 17 muestras, 11 obras, 58 páginas) separa estrictamente por `workId` y edición (`pnpm omr:corpus`). El evaluador (`pnpm omr:evaluate`) mide coincidencia exacta, altura, duración, alteraciones, barras, estructura y esfuerzo humano manteniendo separada la confianza CTC (`confidenceIsAccuracy: false`). El runner real de navegador (`scripts/omr-ui-check.mjs`) captura todas las etapas (`stages.json`), IR (`ir.json`), conversión y Score sobre Edge + PDF.js + Canvas + WASM ONNX. El contrato de modelo y vocabulario (`public/omr/model-manifest.json`, `src/omr/omrModelContract.ts`) valida hashes, dimensiones y tokens en tiempo de ejecución (`R19`). Los recursos privados permanecen en `tasks/local/`, fuera de Git.

Verificación actual: 505 pruebas en 68 archivos, build de producción correcto y lint de los archivos F7 sin errores. La última cobertura global medida antes de F6 fue 51.44 % de líneas/sentencias, 71.38 % de ramas y 67.49 % de funciones; no se recalculó en esta fase. Los scripts nuevos de fases anteriores pasan también una configuración TypeScript de ESLint explícita, pues el lint general no incluye scripts.

La verificación de navegador de F1 y F0.5 comprobó PDF e imagen externos (`El Rey - Guitarron.pdf`, `Guitarron QDRT.pdf`, `line.png`), restauración nativa y revisión tras importar en Edge; modal inspeccionado a 320 px. El recorrido móvil general y Electron instalado siguen sin validarse.

Formato: los archivos de esta continuación pasan Prettier, incluidos los scripts mediante control explícito. El control global conserva fallos previos en archivos ajenos a este avance; no se reformatearon como parte de F0.

F2 completa: resolución PDF medida por espaciado, giro explícito y ambigüedad 0°/180° visible, contraste seleccionado por calidad y conservación de símbolos, regiones completas y pendientes localizados sin máscaras destructivas, detección multiumbral, identidad de partes y ventanas solapadas con hipótesis conservadas. Las cajas del IR apuntan a la fuente original. Edge verificó el build con El Rey (7 pautas, 7 sistemas, 1 parte), PDF mixto de 21 páginas, selección/omisiones, imagen de 25 millones de píxeles rechazada y giro explícito de 180°. La muestra tenue mejora de 83.33 % a 100 % exacto sin degradar la muestra limpia; esto no implica aceptación musical de El Rey, que sigue requiriendo las fases F3–F9. Alcance y evidencia completos en [omr-geometry.md](omr-geometry.md).

F3 completa como fase de evaluación y decisión: [informe](omr-recognition.md) y [resultados](omr-recognition-results.json). Se conserva FP32/voraz y la normalización F2, se añaden evidencias geométricas con avisos y se descartan cambios sin mejora suficiente. Audiveris 5.11.0 se compara nativo y tras importar; la rama condicional de entrenamiento permanece sin activar. Edge 156 verifica PNG, PDF, acceso al aviso geométrico y revisión posterior, sin errores; la restauración nativa no carga pesos. El Score de El Rey es musicalmente idéntico al capturado en F2 al excluir IDs y fechas: 25 compases, 91 notas y solo 11.21 % de eventos exactos en PDF.js. No se declara aceptación automática. Las dos expiraciones del timeout del CLI bajo carga no se reprodujeron en la ejecución aislada ni en la suite final con dos workers.

F4 completa como fase de reconocimiento con revisión explícita: [informe](omr-indications.md). Edge sobre el build de producción, con solicitudes externas bloqueadas, cargó todos los recursos OCR locales y produjo 14 indicaciones críticas reconocidas y una pendiente localizada (ensayo B sin compás fiable). El IR conserva blanca = 60, negra = 90, 3/4 → C → 3/4, equivalencia 90 → 180, calderón sobre silencio y referencias segno → D.S. → salida/destino coda. F5 debe mapear los cambios locales al Score editable; F6 aplicará la ruta en reproducción e intercambio. La suite aislada con dos workers pasa 466 pruebas en 60 archivos, el build y lint de los archivos F4 pasan. La corrida paralela de tests/lint agotó el timeout del CLI en dos pruebas del benchmark; la repetición aislada pasó.

F5 completa como flujo de revisión asistida: [informe](omr-domain-review.md). El esquema 2 conserva figura de tempo, equivalencia, estilo C, arreglista, número impreso y destinos; las indicaciones con anclaje dudoso quedan propuestas. El importador compara fuente y notación, corrige eventos localmente, permite relectura regional propuesta y registra decisiones con deshacer/rehacer. Un borrador local recuperable se guarda antes de confirmar; la confirmación se deshace desde el editor. La corrida final pasó 476 pruebas en 62 archivos, build, lint de archivos F5 y Prettier. Edge 156 verificó PNG, El Rey y reflujo a 320 px sin errores. El Rey aún requiere corrección humana; F6 conserva pendientes de grabado, intercambio y audio.

F6.1–F6.7 implementadas: [informe](omr-exchange-audio.md). La referencia revisada de El Rey produce 55 compases escritos, 103 visitas y 183 ataques; el MIDI descargado coincide con todos los ataques dentro de 2 ms y el WAV dura 140,533 s. MusicXML valida con XSD 4.0 y vuelve al Score con equivalencia semántica; el PDF Carta/A4 tiene dos páginas y siete sistemas sin recortes observados. Edge exportó JSON, MusicXML, MIDI y WAV sin errores. La puerta F6 sigue abierta por apertura manual en un editor externo y escucha del salto/audio.

F7.1–F7.4 implementadas y Puerta F7 cerrada: [informe](omr-execution-offline.md). Cálculo pesado desacoplado en Web Worker dedicado con cancelación interactiva inmediata y segura (AbortSignal) probada en Edge ante PDF denso. Memoria acotada página por página mediante procesamiento secuencial, vaciado de tensores Float32 y canvases reducidos a cero. 11 recursos OMR sellados con hash SHA-256 en Service Worker independiente (pautello-omr-v*) e importación neuronal completada al 100 % con red desconectada. Runtime WASM con 1 hilo y respaldo automático a INT8 ante fallos en carga o ejecución sin retención de promesas envenenadas.
