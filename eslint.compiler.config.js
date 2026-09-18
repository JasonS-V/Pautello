// @ts-check
import reactHooks from 'eslint-plugin-react-hooks';
import base from './eslint.config.js';

/**
 * Configuración opt-in con las reglas del React Compiler.
 *
 * Se ejecuta con `pnpm lint:compiler` y NO bloquea el CI: son avisos de deuda
 * real (accesos a refs durante el render, setState dentro de efectos,
 * memoizaciones que el compilador no puede preservar) que requieren refactors
 * mayores, no un parche. Cuando el contador llegue a cero, esta config puede
 * absorberse en la principal.
 */
export default [
  ...base,
  {
    name: 'pautello/react-compiler',
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
    },
  },
];
