# Entrega F1: fidelidad y revisión del reconocimiento

27 de octubre de 2026. El diagnóstico inicial y sus resultados permanecen en `plan.md` y `omr-baseline.json`; no se han reemplazado los pesos ni el vocabulario.

## Cambios implementados

- El IR 1.4 conserva las líneas originales, registros desconocidos, atributos con procedencia, página/sistema y barras izquierda/derecha. No se descartan pautas por exceder la moda; los cambios de plantilla generan un aviso de identidad pendiente.
- El conversor conserva las barras y duraciones observadas. No añade puntillos ni divide por defecto. Las sobrecargas e incompletos se diagnostican usando la métrica local. Solo se ofrecen divisiones con grupos exactos, sin cortar notas ni modificar duraciones; cada propuesta requiere una casilla de aceptación.
- Las propuestas conservan marcas iniciales en el primer grupo y límites, saltos y repeticiones finales en el último. Segno/coda quedan al comienzo. Desmarcar o cambiar de métrica recupera el borrador base; los IDs de las notas permiten reconstruir sus enlaces de origen.
- Se conservan cambios locales de métrica/armadura, incluido el regreso al atributo inicial. Las ligaduras `start`/`continue` se validan contra el evento siguiente, sin saltar silencios ni eventos pendientes. Las relaciones ambiguas de acordes y las claves locales no representables quedan en el IR con aviso.
- El registro, el título y el análisis tonal dejan de sustituir atributos explícitos. Se conservan los nombres reconocidos; dos pautas no se convierten en piano automáticamente. Letras/cifrados sin anclaje permanecen como pistas editoriales.
- El modal muestra confianza, incidencias y la imagen de origen. «Ver región» enfoca la fuente y permite alternar con la página completa. El editor permite reabrir esta revisión después de importar, manteniendo IR, borrador reconocido, resultado importado, propuestas aceptadas y enlaces.

La fuente y la sesión se mantienen en memoria mientras la aplicación permanece abierta. Guardar/reabrir una sesión OMR con su fuente sigue siendo F5.5. Las cajas son aproximaciones de registros CTC; la correspondencia exacta de símbolos, ventanas y transformaciones pertenece a F2.5. La vista orienta la imagen con el ángulo del preprocesamiento y conserva el raster completo.

## Matriz de conversiones y capacidades

«Vocabulario» significa que existe una clase; no demuestra reconocimiento correcto de imágenes. Las pruebas sintéticas del parser y conversor no prueban una capacidad del modelo.

| Elemento                                         | Parser / vocabulario actual               | Conversión a Score                                  | Límite visible                                                        |
| ------------------------------------------------ | ----------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| Notas/silencios, redonda a fusa, puntillo simple | Sí / sí                                   | Conservados                                         | Exactitud pendiente del corpus                                        |
| Tresillos, incluido puntillo                     | Sí / duraciones 3, 6, 12, 24              | Conservados como tuplet                             | Sin reconocimiento general de otras relaciones                        |
| Breve y doble puntillo                           | Sí / sí                                   | Pendientes, sin aproximarlos a otra figura          | `unsupported-event`, original en IR                                   |
| Octavas fuera de 1–7, nota sin altura            | Sí/parcial                                | Pendientes, sin fabricar Do4 ni recortar octava     | `unsupported-event` y enlace sin destino                              |
| Sol/Fa estándar                                  | Sí / sí                                   | Se conserva la primera clave explícita              | El registro solo sugiere                                              |
| Clave octavada, línea distinta o cambio local    | Sí / cobertura parcial                    | Evidencia conservada; dominio insuficiente          | `unsupported-clef-change`                                             |
| Métrica y armadura locales                       | Sí / sí, con rangos más amplios que Score | Conservadas en los rangos del editor                | `unsupported-time` / `unsupported-key` fuera de rango                 |
| Ligadura monódica de varias notas                | Sí / sí                                   | Continuidad conservada y validada                   | `invalid-tie` ante destino incompatible o ausente                     |
| Relación por altura de acorde                    | Parser no distingue todos los anclajes    | Pendiente; no liga todas las alturas por inferencia | `invalid-tie`; ampliación F8.2a                                       |
| Barras normales, dobles y finales                | Sí / sí                                   | Conservadas                                         | Estilos adicionales generan aviso                                     |
| Repeticiones                                     | Sí / sin las clases correspondientes      | Conservadas en pruebas sintéticas de ensamblado     | No se afirma lectura neuronal de imágenes                             |
| Calderón de nota o silencio                      | Sí / sin `;`                              | Conservado si llega al IR                           | Detector real pendiente F4.6; dibujo/audio/XML requieren sus gates F6 |
| Slur                                             | Sí / sin `(` y `)`                        | Conversión básica existente                         | Sin capacidad neuronal demostrada                                     |
| Texto, ensayo, tempo con figura, segno/coda      | Fuera del vocabulario de línea            | Ruta de detección pendiente F4                      | No se anuncian como reconocidos                                       |
| Letras y cifrado sin posiciones                  | Pistas de texto                           | Se conservan sin asignarlos por orden               | `unanchored-text`                                                     |
| Compás sin eventos representables                | Evidencia retenida                        | Marcador de silencio necesario para el editor       | `empty-measure-placeholder`: no se cuenta como evento reconocido      |

## Verificación reproducible

Pruebas de regresión: `src/omr/__tests__/omrFidelity.test.ts`, `omrPipeline.test.ts` y `src/components/Modals/__tests__/ImportModal.test.tsx`. Cubren H01–H03/H09, atributos, reversibilidad, enlaces, eventos pendientes, revisión de imágenes y recursos obligatorios de inferencia.

Para comprobar la interfaz con PDF.js/Canvas/modelo reales, iniciar `pnpm dev` o servir el build con `pnpm preview --host 127.0.0.1 --port 4173` y ejecutar:

```powershell
node scripts/omr-ui-check.mjs --input 'C:\Users\jason\OneDrive\Documents\MARIACHI\El Rey - Guitarron.pdf' --out tmp/omr-ui-nueva --url http://127.0.0.1:4173/ --playwright 'C:\Users\jason\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright' --channel msedge
```

Si Playwright está instalado en el entorno del proyecto, se puede omitir `--playwright`. El runner no añade dependencias al proyecto. Comprueba carga del modelo y PDF.js, revisión de regiones, conservación de la sesión y una restauración SVG nativa sintética que no debe cargar pesos. Guarda un JSON y una captura en una carpeta nueva. `--width 320` prueba el modal a ese ancho y vuelve a escritorio para verificar el editor.

Resultados observados en Edge 156.0.4314.42:

| Entrada / entorno                                       | Pautas | Compases | Notas | Confianza interna | Resultado                                                        |
| ------------------------------------------------------- | -----: | -------: | ----: | ----------------: | ---------------------------------------------------------------- |
| El Rey, desarrollo y build servido, PDF.js 1471 × 1901  |      7 |       27 |    93 |              70 % | Modelo real, fuente y revisión posterior; cero errores de página |
| PNG externa `line.png`, desarrollo                      |      1 |        6 |     9 |              97 % | Modelo real, revisión posterior; cero errores de página          |
| SVG nativa de control, desarrollo/build                 |      1 |        1 |     1 |      Restauración | Sin carga de ONNX                                                |
| El Rey, núcleo Poppler 1472 × 1901, misma conversión F1 |      7 |       24 |    97 |              71 % | Benchmark conservado en `tmp/omr-fidelity-benchmark/`            |

PDF.js y Poppler difieren en rasterización y salida; ninguno constituye una transcripción validada. El menor número de compases respecto de la línea base no demuestra peor o mejor reconocimiento: ahora se conservan las barras observadas, mientras la versión anterior subdividía compases mediante heurísticas. En el navegador hubo 96 eventos representados, uno pendiente, 13 registros ilegibles adicionales y 92 avisos; la importación sigue necesitando revisión musical.

Evidencia local: `tmp/omr-ui-final/`, `tmp/omr-ui-image-dev/`, `tmp/omr-ui-mobile-reviewed/`. Estos artefactos contienen imágenes de la fuente y quedan excluidos de Git. El menú Archivo y el inspector del editor tienen problemas previos a 320 px que impiden afirmar un recorrido móvil completo; el modal sí se inspeccionó a ese ancho.

Controles de esta entrega: tests con cobertura, build y lint global. El lint tiene 65 advertencias fuera de los archivos cambiados y cero errores. El control global de formato falla en 17 archivos sin modificar; todos los archivos cambiados pasan el control dirigido. Los resultados finales se anotan en `todo.md`. No se ha probado una aplicación Electron instalada, OCR, exportación F6, primera importación offline ni exactitud contra una referencia independiente. F0.2–F0.4 y las fases siguientes permanecen pendientes.
