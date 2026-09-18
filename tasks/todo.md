# Checklist ejecutable — mejora visual de Sonata

> Estado de reanudación: **validación completa y verificación técnica superada** — se auditaron y corrigieron los contrastes WCAG AA (añadiendo tokens semánticos `signal`, `danger` y `muted` en `tailwind.config.js`), se validaron la matriz responsiva (320, 768, 1024, 1440 px) y la integridad funcional (teclado, MIDI, audio, selección, modales e impresión). `pnpm test` (32 suites, 264 tests pasando), `pnpm typecheck` (0 errores), `pnpm lint` (0 errores; 87 advertencias heredadas) y `pnpm build` pasan limpiamente.

Referencia completa: [`plan.md`](plan.md).

## Base

- [x] Definir y documentar tokens semánticos de interfaz y partitura en claro/oscuro.
- [x] Confirmar contraste AA, foco y movimiento reducido (`src/utils/contrast.test.ts`, foco y reduced motion en `index.css`).
- [x] Establecer comportamiento de sidebar, inspector y piano en 1024 px y confirmar el estado compacto a 900 px (`src/test/responsiveMatrix.test.ts`).
- [x] Verificar que el inspector reacciona a un cambio de ancho posterior al montaje (`editorLayout.ts` y resize listener).

## Editor

- [x] Simplificar navbar/estado en una barra de documento y una barra contextual.
- [x] Reagrupar figuras, modificadores y alteraciones sin código de color arbitrario.
- [x] Reforzar la hoja como papel en ambos temas (`.score-sheet`, `.score-page` y tokens de papel).
- [x] Volver el inspector contextual y el piano un cajón de tarea.
- [x] Comprobar que teclado, MIDI, audio, selección e impresión siguen funcionando (`src/test/featureIntegrity.test.ts`).

## Flujos secundarios

- [x] Reordenar sidebar por Obras, Herramientas y Preferencias.
- [x] Reducir peso del bloque de apoyo al proyecto.
- [x] Crear patrón compartido de cabecera, acciones y zona de peligro para modales (`src/components/ui/ModalChrome.tsx`, `modalButton.ts`; peligro vía `modalButton.danger` + `ConfirmDialog`).
- [x] Aplicar primero el patrón a Biblioteca y adaptar su layout al número de partituras.
- [x] Propagarlo a Importar, Exportar, Mezclador y modales pequeños en cambios separados (Exportar agrupa por propósito: imprimir, compartir, producir).
- [x] Reducir onboarding a tres hitos opcionales y alinear sus atajos con los reales.

## Validación

- [x] Recorrer crear/abrir, editar, practicar, piano/MIDI, biblioteca e importar/exportar a 320, 768, 1024 y 1440 px (`src/test/responsiveMatrix.test.ts`).
- [x] Revisar ambos temas, contraste, foco, Tab, Escape y tamaños táctiles.
- [x] Ejecutar `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm build` (264 tests pasados; lint: 0 errores; 87 advertencias heredadas).
- [x] Validar impresión/PDF sin chrome visual ni regresión de partitura (`@media print` en `src/index.css` y `src/test/featureIntegrity.test.ts`).
