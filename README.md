# 🎼 Pautello - Editor y Creador de Partituras Libre

**Pautello** es una aplicación web moderna, compacta y de código abierto diseñada para estudiantes de música, profesores, coros y compositores. Ofrece un entorno completo de notación musical, reproducción sonora polifónica, metrónomo, teclado virtual interactivo y exportación a formatos estándar (PDF, MIDI y MusicXML), sin registros, sin límites y 100% gratuita.

---

## 🌟 Características Principales

### 1. Interfaz Compacta y Amigable (Diseño Anti-Slop)

- Diseñada siguiendo los principios de artesanía visual y usabilidad de `antislop-completo.md`.
- **Tema Oscuro y Claro:** Modo noche con paleta suave para largas sesiones de composición, y modo claro de alto contraste óptimo para imprimir.
- Sin artificios ni decoraciones innecesarias: cada botón, atajo e indicador cumple un propósito musical real.

### 2. Edición Rápida y Notación Completa

- **Figuras Musicales:** Redonda (1), Blanca (2), Negra (3), Corchea (4), Semicorchea (5), Fusa (6).
- **Modo Silencio:** Alterna con la tecla `R` para insertar silencios de cualquier valor.
- **Alteraciones:** Sostenido (`#`), Bemol (`b`) y Becuadro (`n`).
- **Modificadores:** Puntillo (`.`) que añade el 50% del valor rítmico.
- **Claves:** Clave de Sol (agudos), Clave de Fa (graves) y Clave de Do en 3ª (viola).
- **Compases y Armaduras:** Admite 4/4, 3/4, 2/4, 6/8, 2/2 y tonalidades mayores/menores con generación de alteraciones en el pentagrama.
- **Guía de Solfeo Pedagógica:** Opción de mostrar etiquetas de solfeo (`Do`, `Re`, `Mi`, `Fa`, `Sol`, `La`, `Si`) o cifrado anglosajón (`C`, `D`, `E`...) para facilitar el aprendizaje de lectura musical.

### 3. Motor de Audio Web Audio API y Reproducción

- **Sintetizador Polifónico Integrado:** Síntesis armónica en tiempo real con timbres de Piano Acústico, Marimba, Cuerdas y Flauta.
- **Metrónomo:** Pulso acentuado para el primer tiempo del compás y pulso secundario para los restantes.
- **Cursor de Reproducción Sincronizado:** Línea de barrido visual que recorre las notas en tiempo real.
- **Tempo Ajustable:** Control de BPM (30 a 300 pulsaciones por minuto).
- **Bucle (Loop):** Repetición continua de pasajes para práctica y estudio.

### 4. Teclado Virtual Interactivo (Piano Roll)

- 3 octavas interactivas (C3 a B5).
- Iluminación en tiempo real durante la reproducción de la partitura.
- Inserción directa de notas con un solo clic.
- Panel colapsable para maximizar el área de trabajo.

### 5. Exportación e Importación Universal

- **Impresión / Guardar en PDF:** Hoja de partitura en vectores de alta resolución optimizada para papel A4/Carta.
- **MusicXML (.musicxml / .xml):** Estándar abierto compatible con MuseScore, Sibelius, Finale, Dorico y Flat.io.
- **MIDI (.mid):** Archivo binario estándar SMF Format 0 para producción en cualquier DAW (Ableton, FL Studio, Logic, Reaper).
- **Copia de Seguridad (.json):** Guardado local para recuperar proyectos en cualquier momento.
- **Persistencia Automática:** El proyecto se guarda automáticamente en `localStorage`.

---

## ⌨️ Atajos de Teclado

| Atajo                     | Acción                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| **Espacio**               | Reproducir / Pausar                                                       |
| **A, B, C, D, E, F, G**   | Insertar nota con altura correspondiente (La, Si, Do, Re, Mi, Fa, Sol)    |
| **1, 2, 3, 4, 5, 6**      | Seleccionar duración (Redonda, Blanca, Negra, Corchea, Semicorchea, Fusa) |
| **R**                     | Alternar modo silencio                                                    |
| **.** (Punto)             | Activar/desactivar puntillo                                               |
| **# o S / B / N**         | Sostenido / Bemol / Becuadro                                              |
| **↑ / ↓**                 | Transportar nota seleccionada +/- 1 semitono                              |
| **Shift + ↑ / ↓**         | Transportar nota +/- 1 octava                                             |
| **Supr / Backspace**      | Eliminar nota seleccionada                                                |
| **Ctrl + Z / Ctrl + Y**   | Deshacer / Rehacer                                                        |
| **Insert / Ctrl + Enter** | Añadir un compás después del compás seleccionado                          |
| **Shift + ← / →**         | Extender o encoger la selección de compases                               |
| **?**                     | Abrir panel de ayuda                                                      |

---

## 🚀 Instalación y Ejecución Local

1. Asegúrate de tener instalados **Node.js** (v18 o superior) y **pnpm** (`npm i -g pnpm`).
2. Clona o descarga este repositorio en tu equipo.
3. Instala las dependencias:
   ```bash
   pnpm install
   ```
4. Inicia el servidor de desarrollo:
   ```bash
   pnpm dev
   ```
5. Abre en tu navegador la dirección indicada (por defecto `http://localhost:3000`).

### Ejecución de Pruebas Unitarias

```bash
pnpm test
```

### Construcción para Producción

```bash
pnpm build
```

El paquete de escritorio se compila con `pnpm build:desktop`, que además emite
mapas de código para leer trazas del proceso de renderizado.

### Modo sin conexión (PWA)

El build web incluye un manifiesto (`manifest.webmanifest`) y un service worker
que se genera al compilar (`dist/sw.js`). El worker precarga todo el código
—incluidos los fragmentos de los modales, que se descargan bajo demanda— así que
la app abre sin red. `pnpm dev` no lo registra (cachearía el HMR y serviría
código viejo) y Electron tampoco (carga desde `file://`, donde los service
workers no existen).

Para comprobarlo:

```bash
pnpm build
pnpm preview
```

Abre la página, espera a que cargue y activa el modo avión: debe seguir
funcionando, incluidos los modales que aún no habías abierto.

---

## 💡 Modelo de Sostenibilidad y Viralidad

El proyecto incluye un modal de apoyo comunitario (`DonateModal`) que permite:

- Compartir el enlace con estudiantes de conservatorios, escuelas y academias.
- Enlaces para donaciones voluntarias ([Ko-fi @aizendev](https://ko-fi.com/aizendev)).
- Garantía de que la herramienta básica siempre se mantendrá 100% gratuita y sin muros de pago.
