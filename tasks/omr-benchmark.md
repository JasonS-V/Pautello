# F0.1: benchmark reproducible del núcleo OMR

Ejecución inicial con el PDF de referencia:

```powershell
pnpm omr:benchmark --input 'C:\Users\jason\OneDrive\Documents\MARIACHI\El Rey - Guitarron.pdf' --out tmp\omr-el-rey-run-1
```

Para PDF externo requiere `pdftoppm` de Poppler en `PATH`; `--poppler ruta` permite señalar otro ejecutable. La carpeta de salida debe ser nueva para evitar sobrescribir resultados. `--variant int8` selecciona el segundo modelo. También acepta PNG, JPG/JPEG, WEBP y SVG; estas imágenes usan `@napi-rs/canvas`, la dependencia opcional instalada por PDF.js, sin añadir otro paquete. Si esa dependencia no está disponible, el error de carga interrumpe la ejecución.

El manifiesto registra commit, hashes de los archivos de código y del lockfile, versiones instaladas, hashes de entrada/pesos/vocabulario, formato, clase de entrada, hardware, proveedor WASM, un hilo y parámetros de imagen. `decoded-lines.json` conserva los tokens previos al parser; `ir.json` conserva la representación anterior a la conversión; `score.json` guarda el resultado editable. `stats.json` incluye tiempos y conteos por página/línea y hashes del raster gris. `semantic.json` omite IDs y fechas para comparar música entre ejecuciones.

Las entradas se distinguen como `lossless-metadata`, `pdf-text`, `pdf-image` o `image`, con el formato en un campo independiente. Una restauración SVG/PNG/PDF guarda Score, semántica y estadísticas con `inferenceExecuted: false`, pesos/vocabulario nulos y cero páginas rasterizadas; no requiere Poppler ni lee pesos. Los errores de formato/decodificación se propagan.

Las imágenes pequeñas se escalan por dos si su ancho es menor de 1400 px y se componen sobre blanco, como en el importador. Es una ruta diagnóstica Node con un decodificador distinto de Canvas de navegador: compartir escala no garantiza igualdad de píxeles. En PDF se conserva Poppler a 172.8 DPI. F0.5 sigue cubriendo PDF.js/Canvas reales.

Los tiempos separan inspección, primera creación de sesión, segunda creación en el mismo proceso, rasterización, geometría, inferencia, decodificación, ensamblado y conversión. «Carga caliente» significa volver a crear una sesión después de inicializar WASM; no mide la caché de red ni la reutilización de la sesión del importador.

Dos ejecuciones FP32 de esta versión sobre El Rey dieron el mismo SHA-256 semántico: `a0e85b99ae34d21b01d91f106a74e20f2c7ad9824e6a45da9082eccebb1b24d5` (antes de añadir la medición de carga caliente, que no altera el Score). El raster de Poppler a 172.8 DPI midió 1472 × 1901; la prueba diagnóstica anterior usó 1471 × 1901. Por eso el nuevo resultado tuvo 97 notas frente a las 91 anteriores, aun cuando ambos detectaron 7 sistemas y 44 compases. Ningún conteo equivale todavía a exactitud: falta la referencia validada F0.2.

La variante INT8 sobre el raster nuevo produjo 37 compases y 100 notas. Los resultados locales de la última ejecución están en `tmp/omr-benchmark-el-rey-final/` y `tmp/omr-benchmark-el-rey-int8/`; esos archivos de diagnóstico no se incluyen en el repositorio.

Estas ejecuciones iniciales se conservan como historial. F0.1 está completada con la ampliación descrita abajo; la validación de la referencia musical F0.2 y el corpus de F0.3 continúan pendientes.

La entrega F1 añade `conversion.json` con avisos, propuestas, conteos antes/después, enlaces de origen y pistas editoriales. La corrida posterior `tmp/omr-fidelity-benchmark/` produjo 24 compases y 97 notas; conserva barras/duraciones observadas, por lo que sus compases no son directamente comparables con los 44 compases reparados por la versión inicial. Comparación con PDF.js/Canvas y límites en [omr-fidelity.md](omr-fidelity.md).

## Cierre F0.1: imágenes y matriz de entradas

```powershell
pnpm omr:benchmark --input src/omr/__tests__/fixtures/line.png --out tmp/omr-imagen-nueva
pnpm exec vitest run src/omr/__tests__/omrBenchmarkInput.test.ts
```

La matriz y los hashes comparados están en [omr-benchmark-cases.json](omr-benchmark-cases.json). Dos corridas FP32 por entrada, con los mismos hashes de código/modelo/entrada y raster gris, dieron:

| Entrada                | Pautas / compases / notas | SHA-256 semántico compartido                                       |
| ---------------------- | ------------------------- | ------------------------------------------------------------------ |
| PNG externa `line.png` | 1 / 6 / 9                 | `7136127356c217956525251d441ecb54be09c82f41270727340d6e04c5829b2c` |
| PDF de imagen El Rey   | 7 / 24 / 97               | `b408ff3cae6ade650aefd5b1a0725f2582e9c9d3ee608d6123de9925ed56eca0` |

Evidencia local: `tmp/omr-f0-verified-image-1/`, `tmp/omr-f0-verified-image-2/`, `tmp/omr-f0-verified-pdf-1/` y `tmp/omr-f0-verified-pdf-2/`. Los tests sintéticos cubren clasificación de PDF con/sin texto, decodificación PNG/JPEG/WEBP/SVG, escala/transparencia, formato desconocido, imagen corrupta y las tres restauraciones nativas. Estas últimas atraviesan el CLI con una ruta Poppler inexistente y verifican que no haya inferencia ni IR. Los casos sintéticos son controles de formato; no demuestran reconocimiento neuronal de esos formatos musicales ni constituyen el corpus F0.3.

La confianza del modelo permanece separada de la exactitud. La [referencia independiente](omr-reference.md) ya está validada (`reviewed`), y el corpus, las métricas musicales, la evaluación de todas las etapas en navegador real y el contrato de modelo/vocabulario (F0.3–F0.5 y F3.1) están documentados en [omr-corpus.md](omr-corpus.md).
