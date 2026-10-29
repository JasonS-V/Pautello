# F2: entrada y geometría verificables

28 de octubre de 2026. Implementación de F2.1–F2.5 y Puerta F2. La fase conserva la evidencia visual y hace explícitos los segmentos pendientes; no constituye la aceptación musical final de F9.

## Comportamiento

- **Entrada:** se valida la firma real y se exige selección explícita cuando un PDF tiene más de 20 páginas. La selección admite listas y rangos, permite omitir páginas y cuenta las excluidas. Se comprueban 8 millones de píxeles por página y 60 millones por selección antes de reservar los lienzos finales. Las imágenes y el benchmark conservan su resolución original.
- **Resolución PDF:** una vista previa a escala 1 mide el menor espaciado detectado, también en páginas verticales. La escala busca 10 píxeles por espacio (detalle nominal de 2 píxeles por quinto de espacio), limitada por el presupuesto. Sin pautas medibles se usa 2.4 como respaldo; no se anuncia como detalle recuperado. La legibilidad se inspecciona y se avisa si el espaciado final es menor de 6 píxeles.
- **Orientación:** se distingue el eje de las pautas y se permite confirmar 0°, 90°, 180° o 270° antes de importar. La geometría de cinco líneas no distingue por sí sola 0° de 180°: la lectura automática conserva esa ambigüedad mediante `orientation-180-ambiguous`. El enderezado leve requiere mejorar la proyección y la calidad de pautas. Los giros expanden el lienzo, sin recortar esquinas. La perspectiva fotográfica queda fuera de este soporte de impresos.
- **Contraste:** se comparan gris original, normalización local y binarización adaptativa. La selección automática exige una mejora geométrica superior al 10 %, conserva el número de pautas y limita tinta perdida/añadida. El original y el recorte anterior al contraste siempre se conservan. Las opciones explícitas de contraste son experimentales para ablación; no se exponen en el importador.
- **Regiones:** se eliminó el borrado de las bandas de clave, techo y pie. Los recortes completos se envían al modelo. Las máscaras periféricas tienen caja y motivo, pero ninguna se aplica en producción porque la comparación musical no demostró una mejora. Toda tinta exterior al tensor queda en una región `review`; también se conservan candidatos periféricos a texto, segno, coda, calderón o notas adicionales. Son pendientes localizados, disponibles para revisión y la futura detección de F4.
- **Pautas y partes:** se comparan todos los umbrales aunque la primera pasada encuentre pautas. Se puntúan continuidad, extensión común y regularidad de las cinco líneas, tolerando interrupciones cortas. La agrupación combina proximidad con barras/contorno inicial; una columna interior aislada no basta. Los casos próximos sin unión suficiente generan `system-grouping-ambiguous`. La identidad usa nombres de instrumento localizados de la capa PDF, claves y orden vertical, conserva nombres distintos entre páginas y avisa cuando solo hay una asignación provisional. No se infiere piano por las claves. OCR de nombres en escaneos corresponde a F4.
- **Líneas largas:** se reemplazó el truncamiento por ventanas solapadas de hasta 3600 píxeles normalizados. Las ventanas posteriores incluyen contexto visual del comienzo de la pauta; sus registros repetidos se excluyen de los eventos nuevos. Un registro que cruza ese contexto queda ilegible y localizado. La unión exige contenido y posición compatibles; conserva las hipótesis originales y genera `window-join-ambiguous` ante discrepancias. Una ventana sin eventos genera `window-empty-reading`, incluso si los solapamientos están vacíos.
- **Trazabilidad:** las matrices afines almacenan giro, escala, desplazamiento de recorte y ventana. El IR 1.5 mantiene intervalos normalizados y cajas proyectadas sobre la imagen original. La revisión usa esa imagen sin girarla otra vez, distingue regiones musicales/pendientes y cuenta por separado pautas físicas, sistemas, partes y ventanas. En los diagnósticos, `boxes` usa coordenadas procesadas y `regions`/`masks` las originales; `originalToProcessed` permite relacionarlas.

## Evaluación reproducible

`pnpm omr:geometry --out tmp/omr-geometria-nueva.json` ejecuta el modelo FP32 real sobre las seis representaciones públicas/de validación de una misma obra del corpus. Fallará si faltan pesos, fixtures o la referencia aprobada. Compara original/local/adaptativa/automática, máscaras propuestas y ventanas de 700 píxeles. Añade una línea larga concatenando cuatro copias de la imagen real y controles de 90°/180°/270°; esa concatenación no es una obra independiente.

Resultados derivados sin imágenes privadas en [omr-geometry-results.json](omr-geometry-results.json):

| Condición         | Original | Contraste local | Binarización |            Automático |
| ----------------- | -------: | --------------: | -----------: | --------------------: |
| Limpia            |    100 % |           100 % |        100 % |       100 %, original |
| Bajo contraste    |  83.33 % |           100 % |        100 % |          100 %, local |
| Giro leve de 1.2° |     75 % |            75 % |      33.33 % | 75 %, gris enderezado |
| Compresión JPEG   |    100 % |           100 % |        100 % |       100 %, original |
| Resolución 0.65x  |    100 % |           100 % |      83.33 % |       100 %, original |

Los porcentajes son coincidencia exacta de eventos frente a la referencia independiente; no son confianza CTC. El sistema corto conserva sus 5 notas y dos compases; no tiene referencia completa independiente para calcular ese porcentaje. El automático conserva 9 notas en las cinco representaciones completas. El contraste automático mejora la muestra tenue sin degradar las otras muestras medidas; no se extrapola a obras no evaluadas.

Las máscaras propuestas no mejoran las coincidencias y permanecen desactivadas. Las ventanas de 700 píxeles conservan las 9 notas en las representaciones completas y dejan avisos de unión. La línea concatenada supera 3600 píxeles normalizados y se procesa completa en dos ventanas: produce 38 notas frente a las 36 esperadas por repetición y conserva una unión ambigua, sin declararla correcta.

El caso privado denso QDRT se ejecutó también con `pnpm omr:benchmark --input <QDRT.pdf> --out <carpeta-nueva> --max-width 700`: mantiene 10 pautas y 10 sistemas, procesa 30 ventanas y conserva 19 avisos de unión. El benchmark usa Poppler a 172.8 DPI para comparación histórica; la escala adaptativa PDF.js se verifica en navegador.

## Navegador y límites

El runner `scripts/omr-ui-check.mjs` acepta `--pages`, `--rotation`, `--expected-pages`, `--expected-staves` y `--expect-error`. Además de PDF.js/Canvas/ONNX reales, comprueba la visualización de regiones, revisión posterior en el editor y restauración nativa sin cargar ONNX.

| Caso en Edge 156.0.4314.42                     | Resultado                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| El Rey, desarrollo y build servido             | 1 página, 7 pautas, 7 sistemas, 1 parte; 25 compases y 91 notas; sin errores de página   |
| PDF mixto de 21 páginas, sin rango             | Rechazo explícito antes de cargar pesos                                                  |
| Mismo PDF con `--pages 1-2`, modal a 320 px    | 2 páginas procesadas, 19 omitidas avisadas, página sin pautas avisada, 1 pauta y 9 notas |
| PNG comprimida de 5000 × 5000                  | Rechazo por presupuesto antes de inferir                                                 |
| Línea real girada 180°, confirmación explícita | 1 pauta, 6 compases, 9 notas; fuente original y regiones conservadas                     |
| SVG nativa de control                          | Restauración sin inferencia, incluida en todos los recorridos                            |

El Rey se rasteriza a 1226 × 1584 en esta ejecución; la escala menor respecto de F1 responde al espaciado medido. Su confianza CTC de 72 % y sus 91 notas **no** significan fidelidad musical: la medición contra la referencia da 11.21 % de coincidencia exacta de eventos y 16.82 % de altura/duración. QDRT con ventanas predeterminadas conserva 10 sistemas; obtiene 30.32 % exacto y 62.77 % de altura/duración. Son límites del reconocimiento actual que F3 y fases posteriores deben resolver. No se modificaron pesos ni referencias para mejorar estas cifras.

Evidencia privada/local, excluida de Git: `tmp/omr-f2-ui-production/`, `tmp/omr-f2-ui-dev/`, `tmp/omr-f2-ui-mixed/`, `tmp/omr-f2-ui-21-rejected/`, `tmp/omr-f2-ui-huge-rejected/`, `tmp/omr-f2-ui-180/`, `tmp/omr-f2-qdrt-benchmark/`, `tmp/omr-f2-qdrt-windows/`. La evaluación no acredita Electron instalado, perspectiva, OCR ni aceptación musical completa.

Controles finales: 441 pruebas en 56 archivos; cobertura de líneas/sentencias 50.84 %, ramas 70.72 % y funciones 66.96 %; build correcto, lint dirigido sin errores y formato dirigido correcto. No se crearon dependencias ni se publicaron recursos privados.
