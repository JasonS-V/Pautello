# Plan de mejora visual — Sonata

## Resumen ejecutivo

**Dirección propuesta: _atril contemporáneo_.** Sonata debe sentirse primero como un lugar calmado y preciso para escribir, leer y ensayar una partitura. El audio, el piano, la práctica y las herramientas técnicas deben apoyar esa tarea, no competir por atención como si fueran una consola de producción musical.

La aplicación ya tiene una base muy buena: un grabador de notación propio, una partitura vectorial real, tipografías adecuadas, temas claro/oscuro, un sistema de colores de estudio, controles de teclado y una capa modal accesible. La mejora no requiere cambiar el motor musical ni añadir una dependencia de UI. Requiere ordenar la jerarquía de la interfaz, simplificar el vocabulario visual y hacer que cada modo de trabajo revele solo sus controles pertinentes.

Este documento es un plan de producto y de implementación; no modifica el comportamiento musical existente. Se preparó revisando el código actual y la app local en ejecución, incluida la vista de edición, ambos temas y la biblioteca de partituras.

## Alcance y límites

### Incluido

- Jerarquía visual, sistema de color, tipografía, espaciado, densidad y estados.
- Editor de partituras, barra superior, herramientas de notación, panel inspector, piano virtual, barra de estado, biblioteca, modales y bienvenida.
- Diseño responsivo y de accesibilidad para los flujos existentes.
- Plan de verificación visual y técnica.

### No incluido

- Cambios al modelo de datos musical, al grabador SVG, a importación/exportación ni al motor de audio.
- Nuevas funciones musicales o un rediseño de marca fuera de la app.
- Dependencias externas, un framework de componentes nuevo o una reescritura de React.
- Cambiar los cambios no relacionados que ya existen en el árbol de trabajo.

## Evidencia revisada

| Área           | Evidencia actual                                                                                                                  | Lectura de diseño                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Concepto       | `README.md` presenta a Sonata para estudiantes, docentes, coros y compositores; edición, práctica y exportación son sus pilares.  | La metáfora correcta es un atril/editor musical, no un DAW compacto.                                     |
| Lienzo         | `ScoreView` dibuja la partitura vectorial y ya es el mayor elemento visual.                                                       | Es el activo diferencial de la app y debe recibir el mayor espacio y contraste.                          |
| Shell          | `App.tsx` reúne sidebar, navbar de dos filas, toolbar, piano, estado e inspector.                                                 | Hay muchos estratos permanentes antes de llegar a la partitura.                                          |
| Sistema visual | `tailwind.config.js` define superficies `studio` y tres tipografías; `index.css` tiene foco, rango, scroll y movimiento reducido. | Hay una buena fundación, pero varios componentes se saltan la semántica con colores de estado dispersos. |
| Controles      | `Navbar`, `Toolbar`, `Sidebar`, `VirtualPiano` y `ScoreInspector` concentran acciones muy distintas.                              | La funcionalidad está presente; falta agruparla por intención y contexto.                                |
| Modales        | `ModalBase` resuelve portal, Escape, foco y scroll; Library, Import, Export, Mixer y otros aportan sus propios contenidos.        | La conducta es consistente, pero la composición y el tamaño aún no obedecen una misma jerarquía.         |
| Accesibilidad  | Hay nombres accesibles, foco global, soporte de teclado y reducción de movimiento.                                                | Debe preservarse como requisito no negociable durante el rediseño.                                       |

## Diagnóstico

### Fortalezas que se deben conservar

1. **La partitura es auténtica y legible.** El grabador propio, la hoja, las plicas y el contenido musical aportan una identidad que ninguna biblioteca genérica puede sustituir.
2. **La aplicación no es una maqueta.** Reproducción, MIDI, teclado solfeo, práctica, persistencia local e importación/exportación tienen presencia funcional real.
3. **La arquitectura visual ya tiene intención.** Las capas `studio`, las tipografías Inter / EB Garamond / JetBrains Mono, las sombras sobrias y el modo oscuro son una base aprovechable.
4. **Existen buenas garantías de interacción.** `ModalBase` contiene el foco y cierra con Escape; la selección tiene anillo visible y el piano puede utilizarse desde el teclado.
5. **La interfaz ya comunica estado.** Autoguardado, métrica, tonalidad, voz, BPM y modo de práctica están representados; el problema es dónde y con qué peso aparecen, no su ausencia.

### Problemas prioritarios

| Prioridad | Hallazgo                                                                                                                                                                                     | Consecuencia para la persona usuaria                                                                            | Decisión de diseño                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | La navbar de dos filas, la toolbar, el piano y la barra de estado son permanentes; el área editorial pierde altura.                                                                          | En portátil o pantalla baja, escribir se vuelve más parecido a administrar paneles que a leer música.           | Dar altura prioritaria a la partitura; el piano debe iniciar minimizado fuera de práctica y los controles secundarios deben ser contextuales. |
| P0        | Se usan ámbar, lima, púrpura, azul, cielo y esmeralda para selecciones, estados y acciones. El código actual contiene muchas utilidades cromáticas no semánticas.                            | El color deja de explicar una intención; el interfaz se percibe como una colección de widgets.                  | Reducir a un acento editorial primario, un estado sonoro/conectado y una escala semántica reservada para éxito, aviso y peligro.              |
| P0        | Casi todos los grupos son tarjetas redondeadas y elevadas.                                                                                                                                   | La jerarquía se fragmenta: transporte, voz, volumen, herramientas y partitura compiten como cajas equivalentes. | Reservar tarjetas y elevación para objetos que flotan; usar divisores, superficies planas y grupos de herramientas más discretos.             |
| P0        | El inspector puede estar colapsado aun cuando editar estructura o una nota es una tarea principal. Además, su valor inicial se decide al montar la app y no se actualiza si cambia el ancho. | Se ocultan controles de edición fina o el cambio de tamaño deja una distribución poco adecuada.                 | Convertirlo en panel contextual estable en escritorio y cajón superpuesto/bottom sheet en anchos menores, actualizado por breakpoint real.    |
| P1        | La pantalla mezcla tres identidades: documento editorial, estación de audio y aplicación de apoyo/marketing. El bloque morado de donación domina tanto como las herramientas de trabajo.     | Se diluye el propósito principal y se reduce el espacio de navegación útil.                                     | Priorizar «Obras», «Biblioteca» y «Herramientas»; trasladar apoyo a un enlace discreto en ayuda/acerca de.                                    |
| P1        | Atajos, nombres de teclas, iconos y chips se muestran en casi todos los controles.                                                                                                           | Es valioso para aprender, pero crea ruido persistente para quien ya conoce la app.                              | Diseñar una capa de aprendizaje progresivo: los atajos aparecen al pasar el cursor, al mantener `?`, en el tutorial y en modo aprendizaje.    |
| P1        | En oscuro, la hoja y el entorno se acercan demasiado en luminosidad; en claro, varios controles y superficies quedan muy pálidos.                                                            | Se pierde el contraste entre «espacio de trabajo» y «documento», especialmente en sesiones largas.              | Mantener una hoja cálida e inequívoca en ambos temas; regular la interfaz que la rodea con contrastes AA.                                     |
| P1        | La Biblioteca utiliza un modal ancho incluso cuando solo hay una partitura; queda una gran zona vacía.                                                                                       | La información no aprovecha el espacio ni comunica una siguiente acción clara.                                  | Usar layout adaptativo: una lista editorial compacta para 1–2 obras y una cuadrícula/lista densa cuando haya varias.                          |
| P1        | La bienvenida de nueve pasos es útil pero bloquea el lienzo al iniciar y duplica parte de la ayuda contextual.                                                                               | Retrasa la primera nota y fatiga a quien sólo quiere abrir una obra.                                            | Primer inicio en tres hitos opcionales; consejos contextuales y recuperables para piano, inspector y exportación.                             |
| P2        | Hay detalle de contenido que debe auditarse junto al rediseño: el tutorial describe figuras «1 a 5» aunque la toolbar ofrece también Fusa con `6`.                                           | La guía puede erosionar confianza si el texto no coincide con el control visible.                               | Centralizar textos de atajo o validarlos contra la fuente de configuraciones.                                                                 |

## Concepto visual propuesto

### Principio rector

> **Una hoja de música es el producto; la interfaz es el atril.**

La composición visual debe asignar, de forma aproximada, 70% de atención al documento, 20% a los instrumentos de edición y 10% a estado/navegación. No es una regla de píxeles; es un criterio para resolver cada conflicto de densidad.

### Personalidad

- **Precisa, serena y artesanal:** la precisión de un editor musical sin la austeridad hostil de un IDE.
- **Pedagógica cuando se solicita:** nombres de notas, atajos y práctica aparecen para enseñar, no de forma constante.
- **Contemporánea sin estética de dashboard:** sin gradientes decorativos, nubes de sombras, tarjetas repetitivas ni colores de estado como decoración.
- **Bilingüe en tipografía:** Inter para controles y lectura rápida; EB Garamond sólo para título de obra, créditos y detalles expresivos; JetBrains Mono para BPM, compás, contadores y atajos.

### Paleta y tokens semánticos

La paleta final debe verificarse con contraste, pero los roles deben ser estables desde el primer refactor:

| Rol                          | Claro                  | Oscuro                          | Uso permitido                                                                |
| ---------------------------- | ---------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| `app-canvas`                 | gris cálido muy tenue  | grafito profundo                | Fondo de la aplicación y áreas no documentales.                              |
| `surface` / `surface-raised` | blanco cálido / blanco | carbón medio / carbón elevado   | Paneles, menús y controles agrupados.                                        |
| `score-paper`                | marfil casi blanco     | marfil atenuado, no gris oscuro | Hoja, previsualización e impresión. Debe sentirse como papel en ambos temas. |
| `score-ink`                  | tinta casi negra       | tinta casi negra sobre papel    | Pentagrama, texto musical y notación. Nunca depender de la UI oscura.        |
| `accent`                     | ocre/ámbar editorial   | ámbar contenido                 | Acción primaria, selección actual, foco y progreso.                          |
| `signal`                     | verde petróleo/teal    | teal luminoso                   | MIDI conectado, audio listo o éxito no destructivo.                          |
| `danger`                     | rojo sobrio            | rojo sobrio                     | Eliminación, errores y confirmaciones irreversibles.                         |
| `muted`                      | gris cálido            | gris azulado                    | Metadatos, bordes y controles secundarios.                                   |

Reglas:

- El ámbar no se combina con lima, púrpura y azul para diferenciar herramientas de edición; esas diferencias deben venir de la selección, icono y texto.
- No usar color como única señal de modo: cada modo activo debe tener `aria-pressed`, icono, etiqueta y/o una marca de selección.
- Exponer los tokens desde `tailwind.config.js`; eliminar gradualmente colores literales y familias cromáticas aplicadas directamente en componentes.
- Medir contraste de texto normal a **4.5:1** y de iconos/bordes interactivos a **3:1** como mínimo en los dos temas.

### Escala de composición

| Elemento    | Propuesta                                                                                        | Motivo                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Espaciado   | Base de 4 px: 4, 8, 12, 16, 24, 32.                                                              | Evita valores improvisados y compacta sin apretar.                               |
| Radios      | 6 px en controles, 10–12 px en paneles, píldora sólo en chips y filtros.                         | Acerca la interfaz a instrumentos y papel; evita el aspecto de tarjeta genérica. |
| Elevación   | 0–1 sombra para shell; 2 para menú/modal; ninguna dentro de la hoja.                             | La jerarquía viene de superficie y posición, no de sombras repetidas.            |
| Títulos     | Título de documento prominente pero no editable con apariencia de input hasta recibir foco.      | Conserva el carácter editorial y reduce ruido de formularios.                    |
| Iconografía | Un tamaño base de 16 px, trazo coherente y etiqueta visible sólo en acciones de alta frecuencia. | Mejora escaneo sin exigir recordar pictogramas.                                  |
| Movimiento  | 120–180 ms, opacidad/desplazamiento corto; sin rebotes para acciones repetidas.                  | Sensación precisa; conservar `prefers-reduced-motion`.                           |

## Arquitectura de experiencia

### Modos explícitos

No se añaden funciones: se reorganizan las presentes para que cambien de prioridad según la tarea.

| Modo                          | Objetivo                                           | Siempre visible                                                     | Contextual/colapsado                                             |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Escribir** (predeterminado) | Introducir y corregir notación.                    | Documento, duración/alteración activa, deshacer/rehacer, inspector. | Piano, metrónomo, mezcla, práctica, ayudas de teclas.            |
| **Ensayar**                   | Escuchar, repetir y tocar una obra.                | Transporte, BPM, bucle, métrica, piano o entrada MIDI, progreso.    | Controles de estructura, acciones de archivo y edición avanzada. |
| **Preparar/compartir**        | Revisar metadatos, parte, impresión e intercambio. | Vista de partitura, título/compositor, archivo/exportar.            | Piano, práctica y controles de inserción.                        |

La primera fase no requiere implementar un selector visual grande. Bastará con que «Práctica» active una composición de ensayo y que Archivo/Exportar abra el contexto de preparación; en una segunda iteración puede exponerse una conmutación de modo si las pruebas de uso demuestran que es necesaria.

### Nueva jerarquía del shell

```text
Barra de documento (una fila) ─ título, estado de guardado, Archivo, Compartir
Barra de trabajo contextual    ─ Escribir: figuras y alteraciones / Ensayar: transporte
────────────────────────────────────────────────────────────────────────────
Navegación discreta |                 Hoja de partitura                 | Inspector
                   |                 (máximo espacio)                    | contextual
────────────────────────────────────────────────────────────────────────────
Piano/entrada: cajón inferior, cerrado por defecto excepto en Ensayar
```

Decisiones concretas:

1. **Barra de documento:** dejar título, compositor, Archivo y Herramientas; mover el indicador de guardado desde el pie a un estado pequeño junto al título. En pantallas estrechas, Archivo y Herramientas usan icono con nombre accesible; no deben empujar el título.
2. **Barra de trabajo:** intercambiar contenido por contexto. En Escribir, figuras, silencio, puntillo, tresillo, ligadura y alteraciones en dos grupos planos, con el valor activo inequívoco. En Ensayar, Transporte, bucle, metrónomo y BPM obtienen la zona principal.
3. **Lienzo:** la hoja debe ser visualmente papel incluso en el tema oscuro. El fondo que la rodea puede ser oscuro, pero debe quedar una separación de luminancia y borde moderado. El zoom/scroll conserva el comportamiento actual.
4. **Inspector:** pestañas `Nota`, `Compás`, `Partitura` se mantienen; cuando no hay selección, abrir `Partitura` o mostrar una tarjeta breve de primer paso en lugar de ocupar todo el panel con ayuda de atajos. En escritorio ancho queda visible; en anchos medios pasa a cajón superpuesto y en móvil a sheet inferior.
5. **Piano:** al abrirse, usar una cabecera corta con modo de teclado, octava y conexión MIDI; ocultar explicaciones largas tras un icono de ayuda. Al cerrarse, dejar un tirador con `Piano / Entrada MIDI` y una sola señal de conexión.
6. **Barra de estado:** mantener estructura y duración, pero compactarla a texto de lectura; el autoguardado vive junto al título. El pie no debe ser otra fila de chips elevada.

### Navegación lateral

Reorganizar `Sidebar` en tres grupos, sin cambiar destinos:

1. **Obras:** `Editor`, `Mis partituras`, `Obras y plantillas`.
2. **Herramientas de sesión:** `Piano / Entrada`, `Audio y mezcla`.
3. **Preferencias y ayuda:** notación, guía de notas, tablatura, tema, tutorial, atajos.

El soporte al proyecto se conserva, pero pasa a un enlace de bajo énfasis en este último grupo o a «Acerca de Sonata». La tarjeta grande con icono de corazón y degradado/púrpura debe desaparecer de la navegación principal: es el elemento que más rompe la identidad editorial.

### Biblioteca, importación y modales

- Usar la misma cabecera: icono semántico, título, subtítulo opcional, acción primaria a la derecha y cierre.
- Elegir el ancho por contenido, no un máximo fijo: Biblioteca y Exportar pueden ser anchos; Afinador, Donar y confirmaciones deben ser compactos.
- En Biblioteca, si hay hasta dos partituras, mostrar lista de filas con miniatura de pentagrama, título, compositor, última edición y menú contextual. Desde tres obras, permitir cuadrícula o lista ordenable. El área vacía debe ofrecer «Crear partitura» e «Importar» en vez de un gran marco sin contenido.
- En Exportar, organizar formatos por objetivo (`Imprimir`, `Compartir con otro editor`, `Producción`) antes que por extensión técnica; conservar las extensiones como detalle.
- Acciones destructivas (eliminar biblioteca/partitura) sólo aparecen en menú contextual o zona de peligro, nunca junto a duplicar y descargar con el mismo peso visual.
- Conservar el portal, la trampa de foco, Escape y devolución de foco de `ModalBase`.

### Onboarding y aprendizaje progresivo

1. Reemplazar el bloqueo inicial de nueve pasos por una bienvenida de una pantalla con dos decisiones: `Crear desde cero` / `Abrir una obra`, más «Ver recorrido» opcional.
2. El recorrido extendido se reduce a tres hitos: colocar la primera nota, escuchar/ensayar, guardar/exportar. Las demás explicaciones son tooltips recuperables al abrir el panel correspondiente.
3. Mostrar nombres de notas y leyendas de teclas como configuración pedagógica inicial, pero permitir ocultarlas sin que reaparezcan con persistencia.
4. Mantener los indicadores de progreso y `Saltar`, pero no desplazar el lienzo innecesariamente ni tapar el objetivo en viewport pequeño.
5. Obtener los textos de atajo de una única fuente para evitar divergencias entre tutorial, toolbar y modal de ayuda.

## Plan de implementación

### Dependencias

```text
Inventario + tokens
        ↓
Shell y breakpoints ──→ Barra contextual + inspector ──→ Piano/modos
        ↓                                                   ↓
Patrones de modal ───────────────────────────────────→ Biblioteca y flujos
                                                            ↓
                                             Onboarding + QA visual/a11y
```

El orden evita estilizar modales o controles antes de haber decidido sus tokens, densidad y breakpoints. Ninguna tarea debe cambiar la lógica musical para lograr un cambio visual.

## Fase 0 — Base medible

### Tarea 1: Crear el inventario visual y los tokens semánticos

**Descripción:** Consolidar los roles visuales en lugar de seguir aplicando variantes de ámbar/lima/púrpura/azul por componente. Documentar los estados de cada tema antes de reemplazar utilidades.

**Archivos probables:**

- `tailwind.config.js`
- `src/index.css`
- `tasks/plan.md` (actualizar decisiones aprobadas)

**Aceptación:**

- [ ] Existen tokens para canvas, surface, surface-raised, paper, ink, accent, signal, muted y danger en claro y oscuro.
- [ ] Las muestras de papel/notación cumplen contraste y el papel se mantiene distinguible del entorno oscuro.
- [ ] Queda definido por escrito qué token corresponde a selección, MIDI/audio, éxito y peligro.

**Verificación:**

- [ ] `pnpm typecheck` y `pnpm lint` finalizan sin errores.
- [ ] Comparar capturas en claro/oscuro antes y después sin cambiar SVG, audio ni impresión.
- [ ] Revisar foco visible y `prefers-reduced-motion`.

**Dependencias:** ninguna. **Tamaño:** S (2 archivos).

### Tarea 2: Definir la matriz responsiva y los presupuestos de densidad

**Descripción:** Convertir los breakpoints en comportamientos de producto, no sólo en clases Tailwind. Establecer qué panel se muestra, se colapsa o se vuelve cajón en cada ancho.

| Viewport      | Navegación                   | Inspector                 | Piano                      | Objetivo de composición                                     |
| ------------- | ---------------------------- | ------------------------- | -------------------------- | ----------------------------------------------------------- |
| 320–479 px    | Drawer                       | Bottom sheet              | Cerrado; tira activable    | Primera nota y reproducción sin scroll horizontal global.   |
| 480–767 px    | Drawer                       | Bottom sheet              | Cerrado; abrir en práctica | Herramientas por grupos y texto reducido.                   |
| 768–1023 px   | Sidebar/drawer según espacio | Overlay lateral           | Cerrado por defecto        | Hoja como prioridad; toolbar con scroll interno controlado. |
| 1024–1279 px  | Sidebar compacta             | Overlay o columna angosta | Cerrado salvo práctica     | No comprimir la hoja para sostener tres columnas.           |
| 1280 px o más | Sidebar                      | Columna de 280–320 px     | Configurable               | Edición con hoja, navegación e inspector simultáneos.       |

**Archivos probables:**

- `src/App.tsx`
- `src/components/Sidebar/Sidebar.tsx`
- `src/components/Inspector/ScoreInspector.tsx`
- `src/components/PianoRoll/VirtualPiano.tsx`

**Aceptación:**

- [ ] El estado de inspector responde a cambios de tamaño, no sólo a la medida en el montaje.
- [ ] Ninguna capa fija genera scroll horizontal de página en los cinco tamaños.
- [ ] La hoja conserva un área útil mayor que navegación + inspector + piano juntos en modo Escribir.

**Verificación:**

- [ ] Recorrido manual a 320, 768, 1024 y 1440 px en ambos temas.
- [ ] Tabular por drawer, inspector y piano; Escape cierra las capas superpuestas correctas.

**Dependencias:** Tarea 1. **Tamaño:** M (4 archivos).

### Checkpoint 0

- [ ] Tokens, criterios de contraste y matriz responsiva aprobados.
- [ ] Capturas de referencia de editor oscuro, claro, inspector abierto y biblioteca guardadas para comparación local.
- [ ] La app sigue compilando y no hay cambios funcionales musicales.

## Fase 1 — El lienzo vuelve a ser protagonista

### Tarea 3: Simplificar el shell, la navbar y el estado de documento

**Descripción:** Reducir las dos filas de controles permanentes a una barra de documento clara y una barra contextual de trabajo. Reubicar autoguardado, limitar los contenedores elevados y conservar los menús Archivo/Herramientas.

**Archivos probables:**

- `src/App.tsx`
- `src/components/Navbar/Navbar.tsx`
- `src/components/Cards/StatusBar.tsx`
- `src/components/ui/Dropdown.tsx`

**Aceptación:**

- [ ] Título, compositor, guardado, Archivo y Herramientas se leen en una jerarquía única y no parecen cinco formularios independientes.
- [ ] Transporte y edición no compiten cuando se está escribiendo; la barra contextual muestra la tarea activa.
- [ ] Voz y volumen siguen disponibles, pero no fragmentan la cabecera en tarjetas equivalentes.

**Verificación:**

- [ ] Teclas Espacio, V, Ctrl+Z/Ctrl+Y y menús de Archivo/Herramientas conservan su comportamiento.
- [ ] Navegación por teclado y etiquetas accesibles de iconos no regresan en la simplificación.

**Dependencias:** Tareas 1–2. **Tamaño:** M (4 archivos).

### Tarea 4: Rediseñar toolbar y jerarquía de selección

**Descripción:** Reagrupar figuras, modificadores y alteraciones sobre una superficie plana y contextual. Hacer que duración, voz, accidental y selección se entiendan sin depender de una paleta arcoíris.

**Archivos probables:**

- `src/components/Toolbar/Toolbar.tsx`
- `src/components/ScoreView/ScoreView.tsx`
- `src/index.css`

**Aceptación:**

- [ ] La duración activa se identifica con texto/icono/forma, no sólo con color.
- [ ] En ancho medio sólo la toolbar, no toda la página, puede desplazar horizontalmente; sus grupos no se cortan.
- [ ] La selección sobre el pentagrama usa el mismo acento editorial y no compite con etiquetas pedagógicas o reproducción.

**Verificación:**

- [ ] Insertar nota, silencio, alteración, puntillo, tresillo y ligadura conserva exactamente los atajos actuales.
- [ ] Comprobar toolbar a 320, 768, 1024 y 1440 px.

**Dependencias:** Tareas 1–3. **Tamaño:** S (3 archivos).

### Tarea 5: Reequilibrar hoja, inspector y piano

**Descripción:** Dar un tratamiento de papel coherente al lienzo, volver contextual el inspector y convertir el piano en cajón de tarea. Preservar todas las capacidades de entrada, MIDI y práctica.

**Archivos probables:**

- `src/App.tsx`
- `src/components/ScoreView/ScoreView.tsx`
- `src/components/Inspector/ScoreInspector.tsx`
- `src/components/PianoRoll/VirtualPiano.tsx`
- `src/components/Cards/StatusBar.tsx`

**Aceptación:**

- [ ] En oscuro, la página de partitura se reconoce como documento y su tinta mantiene contraste suficiente.
- [ ] El inspector muestra una siguiente acción útil sin nota seleccionada y se vuelve overlay/sheet en los breakpoints definidos.
- [ ] El piano inicia cerrado en Escribir, se abre/persiste con intención de la persona usuaria y se prioriza en Práctica.

**Verificación:**

- [ ] Práctica, MIDI, teclado físico, reproducción y clic en teclas funcionan sin regresión.
- [ ] Imprimir y exportar mantienen papel blanco, sin chrome de app ni cambios en medidas SVG.

**Dependencias:** Tareas 2–4. **Tamaño:** M (5 archivos).

### Checkpoint 1

- [ ] A 1440 px se visualiza una hoja de tamaño suficiente sin que el piano le quite protagonismo por defecto.
- [ ] A 768 px el inspector no comprime ilegiblemente la partitura.
- [ ] Los controles de edición frecuentes se encuentran en menos de una mirada y una acción.
- [ ] `pnpm test`, `pnpm typecheck` y `pnpm lint` pasan.

## Fase 2 — Navegación y flujos secundarios con la misma voz

### Tarea 6: Reorganizar sidebar y estados de aprendizaje

**Descripción:** Dar a la navegación lateral un orden por tarea, rebajar el bloque de apoyo y convertir ayudas constantes en aprendizaje progresivo configurable.

**Archivos probables:**

- `src/components/Sidebar/Sidebar.tsx`
- `src/App.tsx`
- `src/components/Modals/DonateModal.tsx`
- `src/components/Modals/ShortcutsModal.tsx`

**Aceptación:**

- [ ] Obras, herramientas de sesión y preferencias son grupos distinguibles y escaneables.
- [ ] El apoyo al proyecto sigue disponible, sin ser la tarjeta visual dominante de la navegación.
- [ ] Nombres de nota y keycaps tienen una preferencia visible y no saturan a quien los desactiva.

**Verificación:**

- [ ] El drawer móvil conserva cierre por botón, backdrop y foco correcto.
- [ ] Atajos `?`, cambio de tema, nomenclatura y tablatura mantienen sus resultados.

**Dependencias:** Tareas 1–3. **Tamaño:** M (4 archivos).

### Tarea 7: Aplicar un patrón editorial a modales y biblioteca

**Descripción:** Establecer una composición compartida de modal y emplearla primero en Biblioteca. Ajustar densidad y vacíos según cantidad de obras; después propagar el patrón a Importar, Exportar, Mezclador y herramientas pequeñas.

**Archivos probables:**

- `src/components/ui/ModalBase.tsx`
- `src/components/Modals/LibraryModal.tsx`
- `src/components/Modals/ExportModal.tsx`
- `src/components/Modals/ImportModal.tsx`
- `src/components/Modals/MixerModal.tsx`
- `src/components/Modals/{Share,Templates,TunerModal,PlayAlongModal,PracticeResultModal,DonateModal,ShortcutsModal}.tsx`

**Aceptación:**

- [ ] Cabecera, acciones primarias, acciones secundarias, zona de peligro y pie siguen un mismo patrón visual.
- [ ] Biblioteca con una sola obra no exhibe una tarjeta pequeña dentro de una superficie masivamente vacía.
- [ ] Exportar agrupa resultados por propósito sin ocultar formatos disponibles.
- [ ] Afinador, compartir y confirmaciones no heredan el ancho de una biblioteca.

**Verificación:**

- [ ] Abrir/cerrar cada modal por botón, Escape y Tab devuelve el foco al disparador.
- [ ] La eliminación conserva sus diálogos de confirmación y señalización de peligro.
- [ ] Capturas a 320 y 768 px no tienen contenido cortado ni doble scroll confuso.

**Dependencias:** Tareas 1–2 y 6. **Tamaño:** dividir en S/M por modal; no hacer una única PR gigante.

### Tarea 8: Convertir onboarding en una guía breve y contextual

**Descripción:** Reducir el onboarding a los hitos de valor y delegar detalle a herramientas contextuales. Corregir textos de atajos según su fuente real.

**Archivos probables:**

- `src/components/Onboarding/OnboardingTour.tsx`
- `src/constants/keyboardLayout.ts`
- `src/components/Toolbar/Toolbar.tsx`
- `src/components/Modals/ShortcutsModal.tsx`

**Aceptación:**

- [ ] El primer inicio permite llegar al lienzo de inmediato y el recorrido completo es opcional.
- [ ] Cada atajo mostrado coincide con el control que lo ejecuta, incluido Fusa (`6`) si se conserva ese atajo.
- [ ] La guía no tapa su objetivo ni introduce scroll de fondo en móvil.

**Verificación:**

- [ ] Recorrer los hitos con mouse, teclado y lector de pantalla básico.
- [ ] Borrar/restaurar la preferencia de tutorial durante QA y comprobar primera visita, salto y reapertura manual.

**Dependencias:** Tareas 2, 4 y 6. **Tamaño:** S (4 archivos).

### Checkpoint 2

- [ ] Una obra se puede abrir, editar, ensayar, guardar y exportar con una voz visual consistente.
- [ ] Ningún modal crítico tiene scroll doble, foco perdido o acción destructiva con el mismo peso que una acción normal.
- [ ] Las ayudas aparecen en el momento en que aportan valor y no como ruido permanente.

## Fase 3 — Validación y estabilización

### Tarea 9: QA visual, responsive y de accesibilidad

**Descripción:** Convertir la intención estética en una validación repetible antes de aceptar el rediseño.

**Archivos probables:**

- Pruebas existentes que cambien por texto/roles.
- Nuevas pruebas de componentes sólo donde se añada una variante de estado relevante.
- Opcionalmente, una guía de capturas local para revisión de PR.

**Matriz de verificación:**

| Flujo                                | 320    | 768     | 1024       | 1440    | Claro/Oscuro |
| ------------------------------------ | ------ | ------- | ---------- | ------- | ------------ |
| Abrir/crear partitura                | Sí     | Sí      | Sí         | Sí      | Ambos        |
| Insertar y seleccionar nota          | Sí     | Sí      | Sí         | Sí      | Ambos        |
| Inspector de Nota/Compás/Partitura   | Sheet  | Overlay | Adaptativo | Columna | Ambos        |
| Reproducción, bucle y práctica       | Sí     | Sí      | Sí         | Sí      | Ambos        |
| Piano e entrada MIDI                 | Drawer | Drawer  | Panel      | Panel   | Ambos        |
| Biblioteca e importación/exportación | Sí     | Sí      | Sí         | Sí      | Ambos        |
| Modal y onboarding                   | Sí     | Sí      | Sí         | Sí      | Ambos        |

**Aceptación:**

- [ ] Teclado: todos los controles interactivos se alcanzan y su foco se percibe sin depender del color de fondo.
- [ ] Táctil: acciones frecuentes miden al menos 44 × 44 px cuando no hay puntero fino.
- [ ] Lectura: el título, los metadatos y el papel no pierden contraste en ninguno de los temas.
- [ ] Impresión/exportación PDF permanece libre de cromo y no altera el documento.

**Verificación:**

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] Auditoría de contraste y recorrido manual de Tab/Escape en los flujos de la matriz.

**Dependencias:** Tareas 1–8. **Tamaño:** M.

## Criterios de éxito

El rediseño está listo cuando se cumplan simultáneamente estos resultados:

1. Una persona nueva reconoce la partitura como centro de la pantalla y encuentra cómo poner su primera nota sin abrir la ayuda.
2. Una persona que practica identifica reproducir, tempo, bucle y piano sin que esos controles estorben mientras edita.
3. En 1024 px no hay tres columnas permanentes que reduzcan la hoja a un área incómoda; en móvil no hay scroll horizontal de documento para controles de app.
4. El tema oscuro se percibe como entorno de estudio y la hoja como papel; el claro conserva jerarquía sin blanquear controles ni bordes.
5. Selección, reproducción, MIDI conectado, autoguardado y peligro usan roles repetibles, no colores arbitrarios.
6. Todo flujo modal conserva foco, Escape, lectura accesible y acciones inequívocas.
7. Las pruebas, build e impresión existentes continúan funcionando.

## Riesgos y mitigaciones

| Riesgo                                                                      | Impacto    | Mitigación                                                                                                               |
| --------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| El refactor de colores cambia accidentalmente tinta o estilos de impresión. | Alto       | Separar tokens de UI y de `score-paper`/`score-ink`; ejecutar impresión/PDF en cada checkpoint.                          |
| Reducir chrome deja una función difícil de encontrar.                       | Medio      | Mantener Archivo/Herramientas y usar pruebas de descubribilidad en cinco tareas frecuentes antes de retirar controles.   |
| Un modo explícito crea más navegación que valor.                            | Medio      | Empezar por composiciones contextuales al activar Práctica/Exportar; añadir conmutador visible sólo tras pruebas de uso. |
| El inspector overlay tapa el lienzo en pantallas medianas.                  | Medio      | Usar transición a sheet, botón de cierre y conservar contexto de selección; validar 768/1024 px.                         |
| Cambiar tutorial puede reducir adopción de funciones avanzadas.             | Bajo/medio | Mantener «Tutorial» y atajos recuperables; medir finalización del primer hito, no la duración del tour.                  |
| Cambios visuales grandes se mezclan con el árbol de trabajo ya modificado.  | Alto       | Aislar el trabajo en commits/PRs pequeños por tarea y no editar archivos fuera del alcance de cada una.                  |

## Decisiones que conviene validar con producto antes de implementar

- Confirmar si el carácter de marca debe inclinarse más a **conservatorio/editorial clásico** o a **estudio contemporáneo**. Este plan propone un equilibrio 70/30 a favor del primero.
- Confirmar si el bloque de apoyo debe pasar a una ubicación discreta o mantenerse visible por una necesidad de sostenibilidad. Si debe permanecer, limitarlo a una línea y no a una tarjeta de alta elevación.
- Decidir si el piano debe recordar «abierto/cerrado» por dispositivo y por modo; por defecto se recomienda cerrado en Escribir y abierto en Ensayar.
- Definir si la primera visita abre una obra de ejemplo o un lienzo vacío. La guía inicial sólo puede optimizarse después de decidir ese punto de entrada.

## Orden recomendado de entrega

1. Aprobar concepto y tokens (Tareas 1–2).
2. Entregar el editor base: shell, toolbar, inspector/piano (Tareas 3–5).
3. Entregar navegación, biblioteca y modales en cambios pequeños (Tareas 6–7).
4. Reducir onboarding y cerrar con QA transversal (Tareas 8–9).

El checklist ejecutable está en [`todo.md`](todo.md). Cada tarea puede revisarse y revertirse de manera independiente, manteniendo la aplicación funcional entre fases.
