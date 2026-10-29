# F5. Dominio y revisión del borrador OMR

Fecha: 28 de octubre de 2026.

## Resultado

- `Score` usa esquema 2. Conserva arreglista sin atribuir el antiguo `lyricist`, marca metronómica con figura y puntillos, equivalencia métrica, estilo C, número impreso y destinos de navegación. Los silencios creados solo para presentar un compás vacío llevan `omrPlaceholder`.
- Las indicaciones F4 con compás y región coherentes se aplican al Score; una discrepancia de numeración produce una propuesta. El IR y la región original permanecen en la sesión. La persona puede asignar o descartar propuestas; ninguna propuesta dudosa cambia el Score automáticamente.
- El importador muestra la fuente y el compás editable en paralelo. La selección de nota o aviso centra la región. Los controles permiten corregir eventos y compases, cambiar de parte, revisar incidencias y deshacer/rehacer decisiones. La relectura de una región entrega una propuesta separada y solo reemplaza el compás elegido tras aceptación.
- Un borrador activo se autoguarda y puede guardarse manualmente en IndexedDB. Incluye imagen local, IR, Score, decisiones y estados de revisión. Se recupera al reabrir el importador; un resultado confirmado vuelve a mostrar su fuente después de recargar. Antes de confirmar se exige un guardado correcto. La confirmación es una operación del historial del editor que puede deshacerse.

## Verificación

- `pnpm exec vitest run --maxWorkers=2`: 476 pruebas en 62 archivos, todas correctas tras el ajuste final de navegación.
- `pnpm build`, TypeScript, lint de archivos F5 y Prettier correctos.
- Edge 156, build de producción: línea PNG externa, edición de duración, deshacer/rehacer, propuesta de relectura regional, guardado y recuperación tras cerrar, confirmación y reapertura de fuente tras recargar. Captura local ignorada por Git: `tmp/omr-f5-review.png`, estado en `tmp/omr-f5-ui.json`.
- Edge 156 con `El Rey - Guitarron.pdf`, solicitudes externas bloqueadas: 1 página, 7 pautas, sin errores de navegador. Evidencia final en `tmp/omr-f5-el-rey-final/`. El Score automático sigue teniendo 25 compases; solo las indicaciones con anclaje exacto pasan directamente al Score. Las demás necesitan asignación humana. No se declara que la obra ya esté transcrita correctamente.
- Edge 156 a 320 px: sin desbordamiento horizontal del modal; imagen, avisos y notación siguen accesibles. Evidencia en `tmp/omr-f5-mobile/`.

## Límites visibles

- Se guarda un borrador activo por instalación, hasta 24 millones de caracteres serializados. Si falla la cuota o IndexedDB, el modal conserva el trabajo en memoria y muestra el error; no confirma ni cierra como si estuviera guardado.
- La relectura regional puede fallar si el recorte no contiene suficiente contexto musical. No sustituye automáticamente correcciones externas al compás.
- El panel muestra un compás notado a la vez para comparar con la fuente. La disposición final, impresión, MusicXML y audio de las nuevas indicaciones se completarán en F6.
- Los marcadores de posición siguen siendo visibles en el editor, identificados en el Score. La política de intercambio de estos marcadores corresponde a F6.
