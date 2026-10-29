# F4. Texto e indicaciones

## Implementación

El OCR por regiones conserva palabras, cajas, confianza y texto PDF cuando existe. Worker, núcleo LSTM y datos `eng`/`spa` se sirven desde `public/omr/ocr`. La clasificación editorial propone título, compositor, arreglista, parte, estilo y créditos con su fuente; el importador permite corregir los campos principales antes de confirmar. El texto restante permanece en la sesión de revisión.

El IR guarda las indicaciones con estado `recognized` o `pending`, caja de origen, sistema y compás cuando el anclaje es fiable. Las marcas de tempo conservan figura, puntillos, valor impreso y BPM de negra derivado. Las equivalencias conservan ambas figuras y puntillos. Los detectores visuales usan pautas y barras para signos de compás, segno, coda y calderón; los arcos sin punto se inventarían como símbolos pendientes. Los saltos enlazan IDs de origen, salida y destino únicamente si son únicos.

## Prueba de referencia

Edge abrió el build de producción en `http://127.0.0.1:4176/`, importó `El Rey - Guitarron.pdf` con solicitudes externas bloqueadas y restauró un archivo nativo. PDF.js, worker OCR, núcleo, idiomas, vocabulario, pesos ONNX y WASM cargaron desde el origen local con HTTP 200. No hubo errores de navegador. Evidencia local ignorada por Git: `tmp/omr-f4-production/{external,conversion,ir,score,stages}.json`.

| Indicación                                         | Resultado en IR                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3/4 inicial y blanca = 60                          | Compás 1; 120 BPM de negra.                                                                                                                                         |
| Ranchera Valseada                                  | Compás 1, como estilo.                                                                                                                                              |
| Segno                                              | Compás 2.                                                                                                                                                           |
| C y calderón sobre silencio                        | Compás 14; C conserva el glifo común y el calderón apunta a un silencio.                                                                                            |
| Ensayo A, Ranchera Lenta y negra = 90              | Compás 15; roles separados.                                                                                                                                         |
| Retorno a 3/4 y corchea anterior = negra posterior | Compás 22; relación derivada de 90 a 180 BPM de negra.                                                                                                              |
| Ensayo B                                           | Letra y caja reconocidas; compás pendiente porque faltan barras fiables en ese sistema. Región: página 1, sistema 2, `[986,607,34,34]` en el raster de 1226 × 1584. |
| Salto a coda, D.S. al Coda y destino               | Compases 49, 51 y 52, con referencias explícitas al segno del 2 y entre ambas codas.                                                                                |

La ruta **esperada** por la anotación F0 es 1–51, 2–49, 52–55. F4 verifica las marcas y sus enlaces; F6 implementará y comprobará el recorrido usado por audio y exportación. En esta prueba hay 14 indicaciones reconocidas y una pendiente localizada. El Score preliminar recibe título, compositor, parte, copyright, 3/4 inicial y 120 BPM. Sus 25 compases siguen siendo musicalmente incompletos; F5 debe mapear y revisar las indicaciones locales en el Score editable.

El PDF independiente `Guitarron QDRT.pdf` se importó también en el build con la red externa bloqueada. El crédito `Trans. Plucking Mingus` queda sin atribuir a compositor; su D.S. y codas quedan pendientes porque no hay un segno único reconocido. Así se evita construir un salto sin destino verificable.

## Controles y límites

- `pnpm typecheck`, lint de los archivos F4 y `pnpm build`: correctos.
- `pnpm exec vitest run --maxWorkers=2`: 466 pruebas en 60 archivos, todas correctas. La corrida simultánea con lint agotó el timeout de dos procesos hijo del benchmark; la repetición aislada pasó.
- Los tests cubren roles editoriales, ausencia de compositor, figuras de tempo, puntillos, equivalencia directa e inversa, unidad desconocida, barras frente a plicas y calderón sobre silencio. La importación real comprueba los símbolos combinados en la página.
- La lectura visual de fracciones se limita por ahora al patrón 3/4 y al signo C de la referencia. La confianza del detector no equivale a exactitud general en otras fuentes. Las cifras y glifos dudosos requieren revisión; F8 ampliará la evaluación por dominio.
- El arreglo de Jeff Nevin queda como propuesta editorial de la sesión; el dominio Score todavía no dispone de ese campo. La migración corresponde a F5.1–F5.2.
