# F3. Reconocimiento: experimentos, geometría y decisión de motor

Fecha: 28 de octubre de 2026. Continúa F3.1 y la puerta F2. Los resultados agregados, hashes y parámetros están en [omr-recognition-results.json](omr-recognition-results.json). Las imágenes, transcripciones privadas, MusicXML y ejecuciones completas permanecen en `tasks/local/` y `tmp/`.

## Decisión y alcance

Se conserva el modelo FP32 local con normalización de F2 y CTC voraz como motor predeterminado de **reconocimiento asistido**. Se añaden evidencias geométricas y avisos localizados, sin insertar barras ni alterar duraciones. La búsqueda CTC ampliada queda exclusivamente como experimento reproducible: no mejora los eventos en esta validación y añade latencia.

Audiveris es una alternativa externa útil para PDF de Fa. Se puede ejecutar por separado e importar su MusicXML con el flujo existente. No se incorpora su ejecutable a Pautello ni se construye una capa de múltiples motores: primero deben resolverse las pérdidas del importador, la revisión y las indicaciones de F4–F6. La rama de entrenamiento F3.6 **no se activa**. Esta es la decisión solicitada por F3.5, no una afirmación de que se haya entrenado otro modelo.

La puerta F3 se cierra con motor/configuración elegidos, exactitud medida y límites publicados conforme al último párrafo de F3 del plan. **No se alcanza el objetivo de importación musical automática del 98 % ni la aceptación de El Rey.** F4 y las fases posteriores siguen abiertas.

## F3.2. Ablaciones

Se evalúan ocho muestras de validación de tres obras: seis condiciones PDMX en Sol, QDRT en Fa y Usted en Fa. Cinco variantes PDMX y QDRT tienen referencia de eventos aprobada; el sistema corto y Usted solo permiten control estructural. No se usa entrenamiento ni El Rey para elegir parámetros. Las variantes PDMX pertenecen a una sola obra; su media no cuenta como cinco obras independientes.

Las doce condiciones cambian un solo factor: baseline F2, raster al 75 %, espaciado 8/12, desplazamiento vertical ±4 px, polaridad, margen exterior de 10 px, máscara periférica y contraste original/local/adaptativo. Los controles conservan los originales. Se registran los registros musicales antes del parser/unión, después de ambos y la conversión estricta a Score. Las cabeceras, el beaming y las ligaduras se excluyen únicamente de esa comparación de registros; la métrica exacta de Score sí incluye la ligadura. La comparación de registros previa a la unión incluye los solapamientos y no debe interpretarse como pérdida causada exclusivamente por el parser.

| Condición                    | Sol, media de cinco condiciones | Fa, QDRT | Ediciones de eventos, seis muestras |
| ---------------------------- | ------------------------------: | -------: | ----------------------------------: |
| Baseline F2                  |                         95.00 % |  30.32 % |                                 136 |
| Raster 75 %                  |                         98.33 % |  38.83 % |                                 122 |
| Espaciado 8                  |                         65.00 % |  26.60 % |                                 164 |
| Espaciado 12                 |                         95.00 % |  20.21 % |                                 154 |
| Centrado −4 px               |                         33.33 % |   5.85 % |                                 226 |
| Centrado +4 px               |                         73.33 % |  19.15 % |                                 171 |
| Polaridad invertida          |                          8.33 % |   0.00 % |                                 243 |
| Margen 10 px                 |                         95.00 % |  30.32 % |                                 136 |
| Máscara periférica           |                         95.00 % |  30.32 % |                                 136 |
| Contraste original           |                         91.67 % |  30.32 % |                                 138 |
| Contraste local forzado      |                         95.00 % |  29.79 % |                                 137 |
| Contraste adaptativo forzado |                         83.33 % |  30.32 % |                                 149 |

Se conservan los resultados negativos. El raster al 75 % es un candidato posterior, no un cambio global: solo hay dos obras con verdad de eventos, y en Usted cambia de 63 a 61 compases frente a los 62 anotados, sin referencia de notas para medir qué pierde. No se elige por confianza ni se añaden reglas por título. Márgenes y máscaras no mejoran la exactitud y no justifican borrar evidencia. El espaciado 10 y el centrado F2 siguen siendo la configuración conservadora.

Cada fila incluye errores por cabeza hueca/llena, con/sin puntillo y silencios, además de duración, barras/compases y registros no interpretables. Son categorías de la referencia musical; la clasificación óptica independiente se informa por separado. El reparto antes/después de cada etapa y por categoría permite investigar si el error nace en la red, el parser/unión o Score.

**Rasterizadores:** estos experimentos emplean Poppler a 172.8 DPI y Canvas de Node para imágenes. No sustituyen la prueba PDF.js/Canvas de Edge. QDRT es especialmente sensible al rasterizador: su resultado de navegador F0 es 49.47 % exacto y 89.89 % altura+duración, distinto del 30.32 % / 62.77 % de esta ejecución Poppler. No se mezclan ambas rutas en una misma mejora atribuida al decodificador.

## F3.3. Evidencia geométrica

`src/omr/omrNotationGeometry.ts` analiza el tensor completo de cada ventana:

- Barras: alcance vertical sobre las cinco líneas, grosor y tinta lateral para descartar plicas cortas y regiones con cabeza adyacente.
- Figuras: contraste de contorno/interior de la cabeza en la altura candidata, plica y posible barra de unión. Las figuras compatibles se conservan como alternativas, con coste de cambio y estado no resuelto cuando falta evidencia.
- Puntillos: componente compacto separado, en relación espacial con una cabeza reconocida y fuera de una línea de la pauta. Un píxel aislado o la capacidad de un compás no justifican añadirlo. Los silencios sin forma óptica resuelta permanecen pendientes.

La referencia visual pública [line-visual-reference.json](../src/omr/__tests__/fixtures/line-visual-reference.json) se anotó mediante inspección de la imagen, independientemente de CTC. Con tolerancia de 8 px, la geometría localiza **6/6 barras, sin falsos positivos**; los centros aproximados de CTC localizan **3/6**. Ambos producen seis límites: esta mejora es de localización visual, no una reducción demostrada de errores de compás. La clasificación geométrica acierta 6/9 cabezas; por eso **no se acepta ninguna reparación automática de figuras o puntillos**. La duración de Score permanece idéntica y se añaden cero notas.

El importador y el benchmark conservan `notationEvidence` en las líneas del IR, con ventana y matriz a la fuente. Las uniones mantienen todas las evidencias. Las discrepancias de barras originan `notation-geometry-disagreement`, que usa la revisión de regiones existente. El contexto duplicado de la cabecera no genera incidencias como si perteneciera al cuerpo de la ventana.

Las pruebas cubren cabeza llena/hueca, plica, puntillo separado, ruido, barra completa frente a plica corta, conservación de la lectura y proyección de un aviso de una segunda ventana. La exactitud musical no se presume a partir de estas evidencias.

## F3.4. Búsqueda CTC acotada

El experimento `src/omr/omrBeam.ts` suma probabilidades de caminos CTC equivalentes, separa terminación blank/no blank y conserva una alineación visual. Usa ancho 8, cuatro clases candidatas por frame más la continuación de cada prefijo y blank; el ancho máximo aceptado es 32. La gramática opcional aplica un coste suave de 2 al cerrar registros no interpretables. No obliga a completar compases ni inventa figuras por suma temporal. Se verifica contra enumeración exhaustiva de un tensor pequeño y casos con repeticiones separadas por blank y dos lecturas de gramática conocida.

| Caso                            |   Voraz |    Beam | Beam + gramática |
| ------------------------------- | ------: | ------: | ---------------: |
| Sol limpio, eventos exactos     |   100 % |   100 % |            100 % |
| Sol rotado, eventos exactos     |    75 % |    75 % |             75 % |
| QDRT, eventos exactos           | 30.32 % | 30.32 % |          30.32 % |
| QDRT, decodificación aproximada |    5 ms |  364 ms |           375 ms |

La inferencia de QDRT es compartida entre los tres decodificadores, unos 2.13 s en esta corrida; las latencias no incluyen carga, rasterización ni interfaz. La búsqueda mantiene como máximo ocho prefijos después de cada poda y una expansión limitada por ancho y clases candidatas; no es una búsqueda sin límite de memoria. No se aplica una restricción temporal o visual adicional en producción, dado que esta búsqueda ya carece de ganancia de eventos y la geometría de figuras no tiene precisión suficiente para imponerla. Se mantiene el voraz; el prototipo queda fuera de la ruta del importador.

## F3.5. Comparación con Audiveris

Se ejecutó **Audiveris 5.11.0** localmente, con Java incluido, heap limitado a 2 GiB y OCR inglés preparado. No se envió ninguna partitura a un servicio. La inferencia usó recursos locales y proxy HTTP/HTTPS a `127.0.0.1:9` para impedir descargas; esto no sustituye la certificación offline de Pautello de F7.

| Obra               | Actual, Poppler: exacto / compases | Audiveris nativo: exacto / compases | Audiveris → Pautello: exacto / compases | Tiempo externo completo |
| ------------------ | ---------------------------------- | ----------------------------------- | --------------------------------------- | ----------------------: |
| PDMX limpio, Sol   | 100 % / 6                          | 91.67 % / 6                         | 100 % / 6                               |                  5.35 s |
| QDRT, Fa           | 30.32 % / 100                      | 89.36 % / 100                       | 47.87 % / 100                           |                 13.62 s |
| El Rey, aceptación | 20.56 % / 24                       | 67.29 % / 52                        | 67.29 % / 52                            |                 23.24 s |
| Usted, imagen      | Sin verdad de notas / 63           | Rechaza separación de 10 px         | Sin salida                              |                  2.16 s |

Los tiempos externos incluyen arranque de Java, reconocimiento y exportación; no se presentan como equivalentes a la sola inferencia ONNX. Se conservan configuración, log, hash de entrada/salida, XML nativo, Score importado y evaluaciones completas por obra. Usted no se elimina del informe por fallar. El Rey no se usa para ajustar parámetros y sigue sin superar la aceptación (55 compases de referencia).

La medición nativa es independiente del importador: conserva figura, número de puntillos, ligadura y alteración explícita de MusicXML. Declara voces, acordes y ritmos no cubiertos por esa comparación. En El Rey quedan dos notas de otras voces y tres ritmos/acordes fuera del recorrido monofónico de la medición nativa; el denominador sigue incluyendo todos los eventos de la referencia. El resultado de Sol difiere en una alteración: la referencia F0 repite el sostenido en la segunda nota del compás y el MusicXML nativo lo hereda; el importador lo materializa. Se publica esa diferencia de convención en vez de llamar pérdida musical a todo desacuerdo de codificación.

En QDRT, el importador materializa alteraciones de armadura como si estuvieran impresas: altura+duración se conserva al 89.36 %, pero la exactitud completa cae de 89.36 % a 47.87 %. Las ediciones estimadas de eventos suben de **28** en el nativo a **104** después de importar. En El Rey, Audiveris conserva un calderón pero no entrega en esta corrida la navegación ni todos los sistemas/compases de la referencia. Ninguno de estos motores resuelve por sí solo F4–F6.

**Coste de revisión:** el informe calcula ediciones contra la referencia y mantiene `actualCorrectionSeconds: null`. No se ha cronometrado a una persona ni se inventa un tiempo de corrección a partir de las ediciones. La medición humana completa queda en F9.

**Recursos y distribución:** los pesos FP32 actuales ocupan 12,828,981 bytes. El MSI de Audiveris ocupa 85,062,430 bytes y su extracción 163,684,630 bytes; `eng.traineddata` añade 23,466,654 bytes. El MSI evaluado tiene SHA-256 `5f1b4e96a12c53c7da426814b76e599363c4181e291855996e0a6878dda95f71`. Audiveris usa AGPL-3.0; el experimento no cambia su licencia ni redistribuye binarios. Empaquetarlo, modificarlo, enlazar código o servirlo son decisiones distintas de intercambiar archivos MusicXML. Invocar un proceso externo no demuestra por sí solo compatibilidad de distribución. La licencia y las dependencias deben revisarse para la forma concreta de integración antes de incorporarlas al paquete.

Fuentes primarias: [release 5.11.0](https://github.com/Audiveris/audiveris/releases/tag/5.11.0), [CLI](https://audiveris.github.io/audiveris/_pages/guides/advanced/cli/), [idiomas locales](https://audiveris.github.io/audiveris/_pages/guides/main/languages/) y [licencia de esa versión](https://github.com/Audiveris/audiveris/blob/5.11.0/LICENSE).

## F3.6. Rama condicional

No se abre F3.6a–e. F3.5 demuestra una alternativa con mejores eventos en Fa, una pérdida separada en la conversión MusicXML y carencias de indicaciones/revisión compartidas por ambos caminos. Antes de invertir en datos/GPU hay trabajo de producto con resultado medible. Tampoco están recuperados los scripts originales de entrenamiento. Se conserva el modelo y el manifiesto anteriores; no se agregan clases sin pesos compatibles. Una eventual reapertura de entrenamiento requiere una nueva decisión documentada con corpus y coste, no marcar como ejecutadas las subtareas condicionales.

## Reproducción y verificación

```powershell
pnpm omr:corpus
pnpm omr:recognition --out tmp/omr-f3-nueva
pnpm exec vite-node scripts/omr-notation-check.ts --run tmp/omr-f3-nueva --out tmp/omr-f3-barras-nuevas.json
pnpm omr:recognition --acceptance true --out tmp/omr-f3-aceptacion-nueva
pnpm omr:compare-engines --audiveris-home tmp/omr-f3-tools/portable/Audiveris --tessdata tmp/omr-f3-tools/tessdata --out tmp/omr-f3-motores-nueva
pnpm test:coverage --maxWorkers=2
pnpm build
```

El runner de motores requiere una instalación o extracción local de Audiveris 5.11.0 y el archivo inglés de `tesseract-ocr/tessdata` 4.1.0. No instala software ni descarga idiomas implícitamente. Las carpetas de salida deben ser nuevas; faltas de referencias, recursos o hashes fallan explícitamente. El experimento completo produce 112 filas de validación (12 ablaciones y dos decodificadores adicionales sobre ocho muestras) y una aceptación separada del motor elegido. Las seis referencias de eventos representan dos obras, no seis obras independientes.

Verificación final: **452 pruebas en 58 archivos**, build correcto, lint de los archivos afectados y formato correctos. Cobertura: 51.44 % de líneas/sentencias, 71.38 % de ramas y 67.49 % de funciones. El lint general excluye scripts; los scripts de esta fase se comprobaron también con una configuración TypeScript/Node explícita.

Edge 156 verifica el build con PNG de Sol, PDF de El Rey y QDRT, modelo real, evidencia en el IR, acceso a la región de un aviso geométrico y revisión posterior a importar, sin errores. Un control sintético de 8072 px comprueba además evidencia de ambas ventanas conservada tras unirlas; no se le atribuye exactitud musical por repetir una imagen. El recorte de una discrepancia de barra se limita a cinco espacios del pentagrama y excluye el relleno blanco del tensor. Los controles nativos no cargan pesos. Las capturas y JSON están en `tmp/omr-f3-ui-*-final/`.

La salida de El Rey en PDF.js es 11.21 % exacta y 25 compases. El Score es idéntico al capturado en F2 al excluir IDs y fechas: la incorporación de evidencia geométrica no reescribe la música. QDRT en PDF.js conserva 100 compases; el resultado automático exacto es 48.40 %. Estos resultados se publican separados de Poppler. Electron instalado, cronometraje humano y ampliación de dominios continúan en sus fases correspondientes.
