# F0.3 y F0.4: corpus, particiones por obra y métricas musicales

Fecha: 27 de octubre de 2026.

## 1. Corpus y separación por obra/edición (F0.3)

El manifiesto del corpus está en [omr-corpus.json](omr-corpus.json) y se valida mediante:

```powershell
pnpm omr:corpus --generate-variants
pnpm omr:corpus --input tasks/omr-corpus.json
```

Reglas verificadas automáticamente por `scripts/omr-corpus-check.ts` y `src/omr/__tests__/omrCorpus.test.ts`:

- **Unidad de partición (`work-and-edition`):** distintas páginas, recortes o variantes de una misma obra (`workId`) o edición (`workId::editionId`) no pueden quedar en particiones distintas (`training`, `validation`, `acceptance`, `control`).
- **Reserva de _El Rey_ (`acceptance`):** tanto la parte individual (`El Rey - Guitarron.pdf`, 1 página) como el conjunto de partes (`El Rey.pdf`, 6 páginas) comparten `workId: "el-rey"` y quedan aislados en `acceptance` (7 páginas).
- **Validación independiente en Sol y Fa (`validation`):**
  - Clave de Sol (`G2`): pieza PDMX `0021737310` de dominio público (`src/omr/__tests__/fixtures/line.png`) con referencia aprobada en `src/omr/__tests__/fixtures/line-reference.json` más 5 variantes deterministas controladas (`low-contrast`, `rotated`, `compressed`, `low-resolution`, `short-system`).
  - Clave de Fa (`F4`): _Que De Raro Tiene_ (`Guitarron QDRT.pdf`, `pdf-text`, 10 sistemas, 100 compases, 4 sostenidos) con referencia aprobada en `tasks/local/qdrt-ground-truth.json`, más _Usted es la culpable_ (imagen JPEG, 7 sistemas, 62 compases, sistema final corto, cifrado de acordes).
  - Multipágina y páginas sin música: 5 partituras PDF multipágina (41 páginas combinadas de `pdf-image` y `pdf-text`) más 1 página sintética vacía sin pentagramas (`synthetic-non-music-empty`).
- **Control nativo separado (`control`):** SVG con marcador `PAUTELLO_V1` (`synthetic-lossless-control`) evaluado fuera de la ruta neuronal.
- **Permisos y redistribución:** todas las entradas privadas (`private-no-redistribution`) permanecen fuera de `src/` y `public/`.

Resumen verificado del manifiesto: **17 muestras**, **11 obras distintas**, **58 páginas totales** (`validation`: 50 páginas, `acceptance`: 7 páginas, `control`: 1 página).

## 2. Definición de métricas y objetivos revisables (F0.4)

El evaluador está en `scripts/omr-metrics.ts` y su CLI en `scripts/omr-evaluate.ts`:

```powershell
pnpm omr:evaluate --run tmp/omr-ui-f05-el-rey --reference tasks/local/el-rey-ground-truth.json --out tmp/omr-ui-f05-el-rey/evaluation.json
```

Cada indicador declara `definition`, `denominator` y `sourceOfTruth`:

| Indicador                                                     | Definición                                                                                                                                                                               | Denominador                            |
| :------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| `events.exact`                                                | Alineación Levenshtein de eventos exigiendo coincidencia simultánea de altura/silencio, alteración impresa, figura, puntillos y ligadura saliente (con desempate por máximo de aciertos) | Eventos de la referencia               |
| `events.pitchAndDuration`                                     | Alineación Levenshtein exigiendo coincidencia de altura escrita (o silencio), figura y puntillos                                                                                         | Eventos de la referencia               |
| `components.pitch` / `notePitchOnly`                          | Fracción de eventos (o solo notas) alineados con paso y octava correctos                                                                                                                 | Eventos / Notas de la referencia       |
| `components.exactDuration`                                    | Fracción de eventos alineados con igual denominador y puntillos                                                                                                                          | Eventos de la referencia               |
| `components.accidental` / `printedAccidentalRecall`           | Estado de alteración coincidente y recall específico de alteraciones impresas (`#`, `b`, `n`)                                                                                            | Notas / Notas con alteración impresa   |
| `components.barlineAndMeasure`                                | Compases cuya secuencia de eventos y barras coinciden exactamente                                                                                                                        | Compases de la referencia              |
| `components.clef` / `meter` / `tempoFigure` / `relationships` | Clave principal, métricas inicial y locales, marcas metronómicas con figura/equivalencia y ligaduras válidas                                                                             | Total respectivo en la referencia      |
| `structure`                                                   | Sistemas detectados, identidad de parte, compases omitidos/extra, saltos de navegación y pérdidas estructurales silenciosas                                                              | Totales de estructura de la referencia |
| `humanEffort`                                                 | Suma de ediciones de eventos (`I + D + S`), barras/compases y atributos/direcciones por página                                                                                           | Páginas procesadas                     |

### Separación entre confianza CTC y exactitud (`confidenceIsAccuracy: false`)

El informe incluye `confidenceVsAccuracy` con `ctcConfidencePercent`, `exactEventMatchRatePercent` y `overconfidenceGapPercent`. Nunca se reporta la confianza media CTC como porcentaje de precisión.

## 3. Contraste de etapas del navegador y Poppler contra referencias validadas (F0.5)

El runner `scripts/omr-ui-check.mjs` captura todas las etapas (`stages.json`), diagnósticos de geometría por página, representación intermedia (`ir.json`), conversión (`conversion.json`) y `score.json` desde la ejecución real en Edge con PDF.js, Canvas y WASM ONNX.

| Muestra / ruta                                             | Clave / condición            | Confianza CTC | Exactitud exacta de eventos | Coincidencia altura+duración | Altura (notas) | Duración exacta | Compases (detectados / ref.) | Ediciones humanas est. / pág. |
| :--------------------------------------------------------- | :--------------------------- | ------------: | --------------------------: | ---------------------------: | -------------: | --------------: | ---------------------------: | ----------------------------: |
| `line.png` (Browser Canvas)                                | `G2` / `clean`               |          97 % |                 **100.0 %** |                      100.0 % |        100.0 % |         100.0 % |                        6 / 6 |                             0 |
| `line.png` (Node `@napi-rs/canvas`)                        | `G2` / `clean`               |          97 % |                 **100.0 %** |                      100.0 % |        100.0 % |         100.0 % |                        6 / 6 |                             0 |
| `pdmx-low-contrast`                                        | `G2` / `low-contrast`        |          96 % |                 **100.0 %** |                      100.0 % |        100.0 % |         100.0 % |                        6 / 6 |                             0 |
| `pdmx-compressed` (JPEG q50)                               | `G2` / `compressed`          |          97 % |                 **100.0 %** |                      100.0 % |        100.0 % |         100.0 % |                        6 / 6 |                             0 |
| `pdmx-low-resolution` (0.65×)                              | `G2` / `low-resolution`      |          97 % |                 **100.0 %** |                      100.0 % |        100.0 % |         100.0 % |                        6 / 6 |                             0 |
| `pdmx-rotated` (+1.2°)                                     | `G2` / `rotated`             |          81 % |                  **75.0 %** |                       75.0 % |         91.7 % |          75.0 % |                        6 / 6 |                             3 |
| _Que De Raro Tiene_ (`Guitarron QDRT.pdf`, Browser PDF.js) | `F4` / `clean` (`pdf-text`)  |          92 % |                 **49.47 %** |                  **89.89 %** |         89.6 % |         95.74 % |                **100 / 100** |                           105 |
| _El Rey_ (Browser PDF.js 1471×1901)                        | `F4` / `clean` (`pdf-image`) |          70 % |                 **15.89 %** |                      23.36 % |         59.0 % |         23.36 % |                      27 / 55 |                           136 |
| _El Rey_ (Poppler 1472×1901)                               | `F4` / `clean` (`pdf-image`) |          71 % |                 **19.63 %** |                      28.04 % |         72.0 % |         28.04 % |                      24 / 55 |                           134 |

Conclusiones diagnósticas de F0:

1. **Brecha de sobreconfianza en _El Rey_ (`F4`, `pdf-image`):** en _El Rey_ (navegador real), la red reporta `70 %` de confianza CTC pero la coincidencia exacta de eventos frente a la referencia validada F0.2 es `15.89 %` (`23.36 %` en altura+duración; brecha de `+54.11` puntos porcentuales). La altura de las notas acierta en el `59.0 %` (PDF.js) y `72.0 %` (Poppler), pero la duración exacta cae a `23.36 %`–`28.04 %` porque en el raster de _El Rey_ el modelo omite el puntillo de las blancas con puntillo (`2.`) y aproximadamente la mitad de las barras de compás (`27/55` en PDF.js, `24/55` en Poppler).
2. **Contraste crucial con la validación independiente en clave de Fa (_Que De Raro Tiene_):** en `Guitarron QDRT.pdf` (`F4`, 10 sistemas, 100 compases en 3/4 con blancas con puntillo), el mismo motor en navegador detecta **10/10 sistemas**, **100/100 compases**, **95.74 % de duraciones exactas** y **89.89 % de coincidencia de altura+duración** (la diferencia entre `89.89 %` y `49.47 %` exacto proviene de que `**kern` codifica como `#` explícito las notas pertenecientes a la armadura de 4 sostenidos). Esto demuestra que la red sí reconoce clave de Fa, blancas con puntillo y barras cuando la geometría/contraste del recorte coincide con su dominio, acotando el problema de _El Rey_ a F2 y F3.2–F3.3.
3. **Cero pérdidas estructurales silenciosas tras F1:** todas las pautas se detectan (`7/7` en _El Rey_, `10/10` en _QDRT_, `1/1` en _PDMX_) y toda discrepancia queda expuesta con avisos rastreables (`silentStructuralLosses: 0`).

## 4. Contrato y versionado de modelo y vocabulario (F3.1)

El manifiesto explícito del motor neuronal está en [`public/omr/model-manifest.json`](../public/omr/model-manifest.json) y su verificación en tiempo de ejecución en [`src/omr/omrModelContract.ts`](../src/omr/omrModelContract.ts):

- **Procedencia y dominio:** modelo CRNN-CTC exportado desde `pytorch 2.13.0` (`omr-crnn-ctc-pdmx-kern-v1`) entrenado sobre sistemas monofónicos renderizados con Verovio/PDMX en notación `**kern`. No existe checkpoint `.pt` entrenable ni scripts de entrenamiento en el repositorio (`onnx-inference-only-no-local-training-checkpoint`).
- **Hashes y tamaños verificados:**
  - `omr-line.fp32.onnx` (primario): `15,436,058` bytes, SHA-256 `fc4c1e3af94076c1bab621cca0e88f0b8357ac88a36d2831025864e518a54850`.
  - `omr-line.int8.onnx` (respaldo cuantizado): `3,922,068` bytes, SHA-256 `61787b3c7f533df7e7295edcc505a90ea37d8ca787e470ecdb9945f94af84486`.
  - `vocab.json`: `1,546` bytes, SHA-256 `7e0139c90b0572aaf7f679c7fd1d127ae9b02f9bd33bb9b7ac971ac0482061ca` (`141` tokens + índice `0` blank CTC = `142` clases).
- **Contrato de tensores y normalización:** entrada `input` `float32 [1, 1, 128, W]` en polaridad invertida (`0 = blanco`, `1 = tinta negra`), `TARGET_HEIGHT = 128`, `TARGET_SPACING = 10` px, `MAX_WIDTH = 3600` px; salida `log_probs` `float32 [1, W/4, 142]`.
- **Tokens soportados por el parser pero ausentes de `vocab.json`:** `*clefC1`, `*clefC2`, `*clefC4`, `*clefG1`, `*clefF3`, `32..`, `64..`, `128`, `128.`, `128..`, `--`, `__`, `[`, `_`, `]`.
- **Verificación en motor y CLI (`R19`):** tanto `src/omr/omrEngine.ts` como `scripts/omr-benchmark.ts` validan `verifyVocabularyAgainstManifest` al cargar y `verifyModelOutputCompatibility` antes de decodificar cada línea, abortando con mensaje explícito si las dimensiones o el vocabulario no coinciden (`src/omr/__tests__/omrModelContract.test.ts`).
- **Paridad FP32 vs INT8 en WASM:**
  - En `line.png` (`G2`), `omr-line.fp32.onnx` y `omr-line.int8.onnx` producen exactamente los mismos tensores de dimensión `[1, 443, 142]` y la misma secuencia de tokens (`100 %` de coincidencia con `line-reference.json`).
  - En _El Rey_ (Poppler `F4`), `fp32` obtiene `19.63 %` de coincidencia exacta (`28.04 %` altura+duración, `72.0 %` altura de notas, `24/55` compases) e `int8` obtiene `26.17 %` de coincidencia exacta (`30.84 %` altura+duración, `68.0 %` altura de notas, `24/55` compases), confirmando que `fp32` conserva mejor la altura de las notas (`72 %` vs `68 %`) y debe mantenerse como modelo primario mientras `int8` actúa como respaldo verificado.
