<div align="center">

# 🎼 Pautello

### Editor y Creador Profesional de Partituras Libres

**Un entorno moderno, ágil y artesanal de notación musical, síntesis de audio polifónica, práctica interactiva con micrófono y exportación universal. 100% gratuito, libre y sin muros de pago.**

[![GitHub Release](https://img.shields.io/github/v/release/JasonS-V/Pautello?color=6366f1&label=versión&logo=github&style=flat-square)](https://github.com/JasonS-V/Pautello/releases/latest)
[![CI Status](https://img.shields.io/github/actions/workflow/status/JasonS-V/Pautello/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white&style=flat-square)](https://github.com/JasonS-V/Pautello/actions/workflows/ci.yml)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-10b981.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black&style=flat-square)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white&style=flat-square)](https://www.electronjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-bienvenidos-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

<br/>

[📥 **Descargar para Windows (.exe)**](https://github.com/JasonS-V/Pautello/releases/latest) •
[📖 **Documentación**](#-características-principales) •
[⌨️ **Atajos de Teclado**](#️-atajos-de-teclado) •
[🚀 **Instalación Local**](#-instalación-y-ejecución-local) •
[🤝 **Cómo Contribuir**](CONTRIBUTING.md)

</div>

---

## 🌟 Visión del Proyecto

**Pautello** nace como una herramienta diseñada para estudiantes de música, profesores, directores de coro y compositores que buscan plasmar ideas musicales con agilidad, precisión y belleza tipográfica sin depender de software pesado ni modelos de suscripción restrictivos.

Construida bajo una estricta filosofía de **artesanía visual**, cada elemento visual, botón y atajo de teclado cumple una función pedagógica y musical concreta:

- **Cero distracciones:** Interfaz minimalista en tema oscuro y tema claro de alto contraste.
- **Rendimiento instantáneo:** Sin tiempos de carga prolongados, funciona tanto en el navegador como aplicación de escritorio nativa.
- **Privacidad y autonomía:** Tus partituras se almacenan en tu dispositivo. Funciona 100% sin conexión a internet (PWA y Desktop).

---

## ✨ Características Principales

### 1. Edición y Grabado Musical Completo

- **Figuras Rítmicas:** Redonda (`1`), Blanca (`2`), Negra (`3`), Corchea (`4`), Semicorchea (`5`) y Fusa (`6`).
- **Modo Silencio:** Alterna con la tecla `R` para insertar silencios de cualquier valor rítmico.
- **Alteraciones y Modificadores:** Sostenido (`#`), Bemol (`b`), Becuadro (`n`) y Puntillo (`.`) que añade el 50% del valor.
- **Claves:** Clave de Sol (agudos), Clave de Fa (graves) y Clave de Do en 3ª línea.
- **Grand Staff (Sistema de Piano):** Doble pentagrama simultáneo con soporte polifónico independiente por mano.
- **Tablatura de Guitarra:** Tablatura interactiva de 6 cuerdas con asignación de trastes y cuerdas.
- **Compases y Tonalidades:** 4/4, 3/4, 2/4, 6/8, 2/2 y armaduras mayores y menores con generación canónica de alteraciones en el pentagrama.
- **Guía de Solfeo Pedagógica:** Etiquetas opcionales de lectura en solfeo (`Do`, `Re`, `Mi`, `Fa`, `Sol`, `La`, `Si`) o cifrado anglosajón (`C`, `D`, `E`...).

### 2. Motor de Audio Web Audio API & Síntesis Polifónica

- **Sintetizador Integrado:** Generación sonora armónica en tiempo real con timbres de Piano Acústico, Marimba, Cuerdas y Flauta.
- **Metrónomo:** Pulso acentuado dinámico en el primer tiempo del compás y pulsos secundarios regulares.
- **Cursor Sincronizado:** Línea de barrido visual que recorre y resalta las notas activas en tiempo real.
- **Control de Tempo:** Rango dinámico de 30 a 300 BPM con modo de reproducción en bucle (_loop_).

### 3. Modo Práctica Interactiva con Micrófono y Afinador

- **Afinador y Detector de Tono en Vivo:** Analiza la señal de audio de tu micrófono en tiempo real para verificar la afinación de tu instrumento o voz.
- **Evaluación de Desempeño:** Mide la precisión de notas y tiempos con retroalimentación inmediata y pantalla de resultados.
- **Pista de Acompañamiento (Play-Along):** Permite tocar sobre una base rítmica o armónica guiada.

### 4. Teclado Virtual Interactivo (Piano Roll)

- 3 octavas interactivas de C3 a B5.
- Iluminación reactiva durante la reproducción de la partitura.
- Inserción de notas con un solo clic y panel colapsable para maximizar el área de trabajo.

### 5. Interoperabilidad y Exportación Universal

- **PDF Vectorial de Alta Resolución:** Impresión y guardado optimizado para formatos de hoja A4 y Carta.
- **MusicXML (`.musicxml` / `.xml`):** Estándar de la industria compatible con MuseScore, Sibelius, Finale, Dorico y Flat.io.
- **Audio WAV:** Exportación estéreo sin compresión del audio generado por el sintetizador.
- **MIDI (`.mid`):** Archivo binario SMF Formato 0 multicanal compatible con DAWs (Ableton Live, FL Studio, Logic Pro, Reaper).
- **Imágenes SVG y PNG:** Para inserción de compases y fragmentos en apuntes y documentos didácticos.
- **Copia de Seguridad JSON y Enlace Compartible:** Guarda copias de seguridad locales o comparte partituras completas mediante URLs comprimidas.

---

## 💻 Descargas y Versiones de Escritorio

Puedes descargar la última versión compilada para tu sistema operativo desde la sección de [Releases de GitHub](https://github.com/JasonS-V/Pautello/releases/latest):

| Plataforma                   | Formato                   | Enlace                                                                       |
| :--------------------------- | :------------------------ | :--------------------------------------------------------------------------- |
| **Windows 10 / 11 (64-bit)** | Instalador NSIS (`.exe`)  | [Descargar Instalador](https://github.com/JasonS-V/Pautello/releases/latest) |
| **Navegador Web (PWA)**      | Aplicación Web Progresiva | Compatible con Chrome, Firefox, Edge y Safari                                |

---

## ⌨️ Atajos de Teclado

Pautello está optimizado para editar a la velocidad del pensamiento musical sin necesidad de tocar el ratón:

| Atajo                                                                                      | Acción Musical                                                                                   |
| :----------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| <kbd>Espacio</kbd>                                                                         | Reproducir / Pausar reproducción                                                                 |
| <kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd> <kbd>D</kbd> <kbd>E</kbd> <kbd>F</kbd> <kbd>G</kbd> | Insertar nota con altura correspondiente (La, Si, Do, Re, Mi, Fa, Sol)                           |
| <kbd>1</kbd> a <kbd>6</kbd>                                                                | Seleccionar duración: `1` Redonda, `2` Blanca, `3` Negra, `4` Corchea, `5` Semicorchea, `6` Fusa |
| <kbd>R</kbd>                                                                               | Alternar modo silencio de la duración activa                                                     |
| <kbd>.</kbd>                                                                               | Activar / desactivar puntillo (+50% valor)                                                       |
| <kbd>#</kbd> o <kbd>S</kbd> / <kbd>B</kbd> / <kbd>N</kbd>                                  | Sostenido / Bemol / Becuadro                                                                     |
| <kbd>↑</kbd> / <kbd>↓</kbd>                                                                | Transportar nota seleccionada +/- 1 semitono                                                     |
| <kbd>Shift</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd>                                             | Transportar nota seleccionada +/- 1 octava                                                       |
| <kbd>Supr</kbd> / <kbd>Backspace</kbd>                                                     | Eliminar elemento seleccionado                                                                   |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd>                            | Deshacer / Rehacer cambios                                                                       |
| <kbd>Insert</kbd> o <kbd>Ctrl</kbd> + <kbd>Enter</kbd>                                     | Añadir compás después del actual                                                                 |
| <kbd>Shift</kbd> + <kbd>←</kbd> / <kbd>→</kbd>                                             | Extender o reducir selección de compases                                                         |
| <kbd>?</kbd>                                                                               | Abrir panel interactivo de ayuda                                                                 |

---

## 🚀 Instalación y Ejecución Local

### Requisitos

- **Node.js** v20+ (recomendado Node 24 LTS).
- **pnpm** v11+ (`npm i -g pnpm`).

### Pasos

1. Clona el repositorio:

   ```bash
   git clone https://github.com/JasonS-V/Pautello.git
   cd Pautello
   ```

2. Instala las dependencias:

   ```bash
   pnpm install
   ```

3. Inicia el servidor de desarrollo web:

   ```bash
   pnpm dev
   ```

   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

4. Para iniciar la aplicación de escritorio en modo desarrollo con Electron:
   ```bash
   pnpm electron:start
   ```

---

## 🧪 Pruebas y Calidad de Código

El repositorio cuenta con una batería completa de más de 300 pruebas automatizadas y cobertura estricta:

```bash
# Ejecutar pruebas unitarias (Vitest)
pnpm test

# Ejecutar pruebas con reporte de cobertura
pnpm test:coverage

# Comprobación estricta de tipos (TypeScript)
pnpm typecheck

# Análisis estático de código (ESLint)
pnpm lint

# Verificación de formato (Prettier)
pnpm format:check
```

---

## 📦 Empaquetado y Publicación de Releases

### Compilación local del instalador de escritorio

Para generar el instalador ejecutable `.exe` para Windows:

```bash
pnpm package:win
```

El instalador compilado se ubicará en la carpeta `release/` con el nombre `Pautello-Setup-<versión>.exe`.

### Publicación automatizada en GitHub

El repositorio cuenta con un flujo automatizado en GitHub Actions (`.github/workflows/release.yml`):

1. Incrementa la versión en `package.json` si corresponde.
2. Crea y empuja una etiqueta de versión Git:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions compilará automáticamente el instalador en un entorno limpio de Windows, generará las sumas de verificación `SHA256SUMS.txt` y publicará la nueva versión en la sección [Releases](https://github.com/JasonS-V/Pautello/releases).
4. También puedes disparar la publicación de forma manual desde la pestaña **Actions** en GitHub seleccionando el workflow **Release** y presionando **Run workflow**.

---

## 📴 Modo sin Conexión (PWA Offline)

Pautello incluye un Service Worker y un manifiesto web (`manifest.webmanifest`) configurados para precargar la aplicación completa y los fragmentos descargados bajo demanda:

```bash
pnpm build
pnpm preview
```

Carga la aplicación en tu navegador y activa el **modo avión**: la aplicación seguirá funcionando al 100%, permitiendo componer, reproducir audio y exportar partituras sin conexión a internet.

---

## 🤝 Cómo Contribuir

¡Nos encanta recibir contribuciones de la comunidad! Consulta nuestra [Guía de Contribución](CONTRIBUTING.md) para conocer las pautas de código, convenciones de ramas y cómo abrir un Pull Request.

Por favor respeta las normas de convivencia detalladas en nuestro [Código de Conducta](CODE_OF_CONDUCT.md).

---

## ☕ Apoyo Comunitario y Donaciones

Pautello es y seguirá siendo siempre un proyecto libre y accesible para todos los amantes de la música. Si el proyecto te resulta útil en tus clases, ensayos o composiciones, puedes apoyar su mantenimiento y desarrollo continuo:

- ☕ Apóyanos con un café en [Ko-fi @aizendev](https://ko-fi.com/aizendev)
- ⭐ Dale una estrella al repositorio en GitHub si te gusta el proyecto.
- 📢 Comparte Pautello con compañeros músicos, profesores y conservatorios.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

Desarrollado con dedicación por **Jason Sting** y el equipo de **Pautello Music Team**.
