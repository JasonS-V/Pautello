# F8: robustez, plataformas y controles continuos

Fecha: 29 de octubre de 2026. Configuración de producción: FP32, decodificación voraz, preprocesamiento F2. La confianza del modelo no se usa como exactitud musical.

## Robustez de imagen

`pnpm omr:corpus --generate-variants` genera defectos deterministas desde la muestra pública PDMX de una pauta. Los 13 archivos resultantes quedaron congelados en `src/omr/__tests__/fixtures/variants/` para que Windows y CI usen los mismos bytes. El manifiesto conserva SHA-256, condición y una referencia musical revisada. `pnpm omr:recognition --public-robustness --variants baseline --greedy-only --robustness-gate --out <carpeta-nueva>` ejecuta inferencia ONNX real y compara contra mínimos fijos. Se inspeccionaron las imágenes limpia, de contraste desigual, borde cortado y perspectiva; la última es una deformación sintética, no una foto real.

| Condición               | Eventos exactos | Barras/compases | Compases construidos | Resultado                                                                                 |
| ----------------------- | --------------: | --------------: | -------------------: | ----------------------------------------------------------------------------------------- |
| Limpia                  |           100 % |           100 % |                    6 | Caso de control                                                                           |
| Contraste bajo uniforme |           100 % |           100 % |                    6 | Conservado                                                                                |
| Rotación de 1,2°        |            75 % |            33 % |                    7 | Añade un compás; requiere revisión                                                        |
| Compresión JPEG q50     |           100 % |           100 % |                    6 | Conservado                                                                                |
| Resolución 0,65×        |           100 % |           100 % |                    6 | Conservado en esta muestra                                                                |
| Contraste desigual      |         33,33 % |            33 % |                    4 | Pérdida importante; requiere revisión                                                     |
| Líneas interrumpidas    |           100 % |           100 % |                    6 | Conservado en esta muestra                                                                |
| Manchas locales         |           100 % |           100 % |                    6 | Conservado en esta muestra                                                                |
| Borde izquierdo cortado |            25 % |            33 % |                    6 | Falta la clave y se altera la lectura                                                     |
| Cabecera grande         |           100 % |           100 % |                    6 | Conservado en esta muestra                                                                |
| Perspectiva sintética   |             0 % |             0 % |                    0 | No detecta pautas; el navegador rechaza la entrada antes de inferir con mensaje explícito |

Peor caso: 0 %; percentil 10 por rango: 25 %; mediana: 100 %. Cada condición tiene **una** variante del mismo fragmento, de modo que estos percentiles describen el conjunto de pruebas, no una población de escaneos. El rechazo explícito de perspectiva se comprobó en Chromium. Fotografías reales con perspectiva siguen fuera del soporte declarado.

Como control de generalización entre obras, el evaluador volvió a medir QDRT en 30,32 % exacto y 100 compases, y El Rey en 20,56 % exacto y 24 compases en la ruta Poppler/Node. Coinciden con el informe F3 y **no** cumplen la aceptación musical de F9. Los resultados PDF.js del navegador no se mezclan con estas cifras.

## Matriz de plataformas

La misma prueba de producción cargó `line.png`, el modelo ONNX real, OCR local, avisos, foco en la región de origen, corrección y deshacer, confirmación, revisión posterior y restauración nativa sin inferencia. Se bloquearon solicitudes ajenas al origen durante el flujo web. En todos los navegadores siguientes se observaron 1 pauta, 6 compases, 9 notas y 0 errores de página/consola:

| Plataforma                     | Versión         | Estado                                                                                                                                      |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium (Chrome for Testing)  | 151.0.7922.34   | Probado; incluye vista de 320 px                                                                                                            |
| Edge                           | 156.0.4314.50   | Probado                                                                                                                                     |
| Firefox (Playwright)           | 153.0           | Probado                                                                                                                                     |
| WebKit (Playwright en Windows) | 26.5            | Probado; no equivale a Safari en macOS                                                                                                      |
| Windows Electron, NSIS aislado | Electron 44.3.0 | Instalado en carpeta temporal con identidad de prueba; flujo OMR sobre `file:` correcto, 0 errores de renderer/CSP y 0 solicitudes externas |
| Safari/macOS                   | —               | No probado: no hay entorno macOS en esta ejecución                                                                                          |
| Lector de pantalla real        | —               | No probado; se verificó foco en la fuente y controles accesibles por Playwright                                                             |

El instalador aislado usó el mismo bundle de producción con un `appId` y nombre temporal para no sustituir la instalación existente. Se desinstaló después de la prueba; la instalación original permaneció presente. El script `scripts/omr-electron-check.mjs` permite repetir el flujo con un ejecutable empaquetado o instalado. Los controles previos de F7 cubren cancelación y preparación offline en Edge; este recorrido F8 bloqueó red externa y comprobó los recursos locales de Electron.

## Puertas de CI

El workflow ejecuta la suite con cobertura, inferencia FP32 obligatoria sobre la muestra pública, variantes por condición con mínimos fijos, validación de MusicXML 4.0 con XSD local, build y un recorrido Chromium del importador real. El informe de robustez se adjunta como artefacto por ejecución con hash de modelo y vocabulario. Las pruebas del gate fuerzan fallos de pauta, compás, eventos, barras y categoría degradada; no se actualizan los mínimos automáticamente.

El corpus privado y la aceptación de El Rey permanecen locales por sus permisos de redistribución. El gate público detecta regresiones, pero no certifica precisión en todas las obras. F8.2a–e son ampliaciones posteriores independientes; ninguna se declara soportada por esta matriz. F6 conserva la apertura manual en un editor externo y la escucha como puerta pendiente, y F9 conserva la aceptación completa.
