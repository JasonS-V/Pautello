# Guía de Contribución a Pautello 🎼

¡Gracias por tu interés en contribuir a **Pautello**! Este proyecto es libre, de código abierto y está desarrollado con pasión por la música y el software bien diseñado.

Toda contribución es bienvenida: desde reportar errores y sugerir ideas, hasta corregir traducciones, mejorar el motor de audio o implementar nuevas funcionalidades musicales.

---

## 🛠️ Requisitos Previos

Para trabajar en el proyecto necesitas:

- **Node.js**: Versión `20` o superior (recomendado `24+ LTS`).
- **pnpm**: Versión `11` o superior (`npm install -g pnpm`).
- **Git**: Para el control de versiones.

---

## 🚀 Configuración del Entorno Local

1. **Haz un Fork** del repositorio en GitHub: `https://github.com/JasonS-V/Pautello`.
2. **Clona tu fork** localmente:
   ```bash
   git clone https://github.com/TU_USUARIO/Pautello.git
   cd Pautello
   ```
3. **Instala las dependencias**:
   ```bash
   pnpm install
   ```
4. **Inicia el servidor de desarrollo web**:
   ```bash
   pnpm dev
   ```
   Abre `http://localhost:3000` en tu navegador.
5. _(Opcional)_ Para probar la aplicación de escritorio en Electron:
   ```bash
   pnpm electron:start
   ```

---

## 🧪 Comandos de Validación y Calidad

Antes de enviar cualquier cambio o abrir un Pull Request, asegúrate de que todos los controles de calidad pasen localmente:

| Comando              | Propósito                                                  |
| :------------------- | :--------------------------------------------------------- |
| `pnpm format:check`  | Comprueba que el código cumpla con las reglas de Prettier  |
| `pnpm format`        | Aplica el formato automático de Prettier                   |
| `pnpm lint`          | Analiza el código con ESLint                               |
| `pnpm typecheck`     | Verifica los tipos con el compilador de TypeScript (`tsc`) |
| `pnpm test`          | Ejecuta la suite completa de pruebas unitarias con Vitest  |
| `pnpm test:coverage` | Ejecuta pruebas con informe de cobertura de código         |
| `pnpm build`         | Compila el bundle web de producción                        |
| `pnpm package:win`   | Genera el instalador de Windows con Electron Builder       |

---

## 🌿 Convención de Ramas y Commits

### Nombres de ramas

Crea una rama descriptiva para tu trabajo a partir de `main`:

- `feat/nueva-funcionalidad`
- `fix/correccion-error-sostenidos`
- `docs/actualizar-atajos`
- `refactor/limpieza-synth`

### Mensajes de commit

Seguimos la convención de [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: añadir soporte para tresillos en el compás`
- `fix: resolver desalineación visual de la clave de Fa`
- `docs: clarificar atajos de teclado en el README`
- `test: añadir pruebas unitarias para exportación MusicXML`
- `refactor: simplificar cálculo de espaciado en engraver`

---

## 📥 Proceso de Pull Request (PR)

1. Empuja tu rama a tu fork:
   ```bash
   git push origin feat/mi-mejora
   ```
2. Ve a GitHub y abre un **Pull Request** hacia la rama `main` de `JasonS-V/Pautello`.
3. Completa la plantilla del PR describiendo detalladamente la motivación, los cambios y las pruebas realizadas.
4. El flujo de Integración Continua (CI) se ejecutará automáticamente validando formato, lint, TypeScript y pruebas.
5. Una vez revisado y aprobado, tu contribución será fusionada. ¡Muchísimas gracias por ser parte del proyecto!

---

## 📜 Código de Conducta

Al participar en este proyecto, te comprometes a mantener un entorno respetuoso y acogedor. Por favor revisa nuestro [Código de Conducta](CODE_OF_CONDUCT.md).
