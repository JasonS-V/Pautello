// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * El sistema de color vive en tailwind.config.js (tokens `studio-*`, `pastel-*`,
 * `score-*`) y su nota prohíbe escribir un hex arbitrario en una clase de
 * Tailwind (`dark:bg-[#161822]`).
 *
 * La comprobación es una regla local y no `no-restricted-syntax` porque los
 * selectores de esquery no pueden expresar el corchete de forma fiable: la
 * variante escapada (`[value=/-[a-z]+-\[#/]`) no coincide nunca y la variante
 * suelta rompe el parser. Además, las clases condicionales viven en las dos
 * partes de un template literal, así que hay que mirar `Literal` y
 * `TemplateElement`.
 */
const ARBITRARY_HEX_CLASS = /[a-zA-Z]+-\[#[0-9a-fA-F]{3,8}\]/;

const noArbitraryColors = {
  meta: {
    type: 'problem',
    docs: { description: 'Prohíbe colores hexadecimales fuera del tema' },
    schema: [],
    messages: {
      arbitraryColor:
        'Color hexadecimal arbitrario ("{{value}}"): usa un token del tema (studio-*, pastel-*, score-*).',
    },
  },
  create(context) {
    const report = (node, value) => {
      const match = value.match(ARBITRARY_HEX_CLASS);
      if (match) {
        context.report({
          node,
          messageId: 'arbitraryColor',
          data: { value: match[0] },
        });
      }
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') report(node, node.value);
      },
      TemplateElement(node) {
        report(node, node.value.raw ?? '');
      },
    };
  },
};

const localPlugin = { rules: { 'no-arbitrary-colors': noArbitraryColors } };

export default tseslint.config(
  {
    name: 'pautello/ignores',
    ignores: [
      'dist/**',
      'dist-installer/**',
      'release/**',
      'node_modules/**',
      'partituras_reales/**',
      // Informe HTML de cobertura: JS generado por vitest, no es código propio.
      'coverage/**',
    ],
  },

  // Aplicación: TypeScript + React.
  {
    name: 'pautello/app',
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactRefresh.configs.vite],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y, pautello: localPlugin },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Solo las dos reglas clásicas de hooks. En la v7 del plugin los presets
      // `recommended` / `recommended-latest` arrastran además toda la familia del
      // React Compiler (refs en render, setState en efectos, inmutabilidad,
      // pureza...), que señala deuda real pendiente de refactor. Se marca aparte
      // en eslint.compiler.config.js y se paga con `pnpm lint:compiler`, sin
      // bloquear cada PR mientras tanto.
      // Accesibilidad: jsx-a11y vigila lo que no se ve en una revision visual
      // (elementos clicables sin teclado, aria mal formado, botones sin nombre
      // accesible...). Es la red que impide que la accesibilidad se degrade.
      ...jsxA11y.flatConfigs.recommended.rules,
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/media-has-caption': 'off',

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Los identificadores con prefijo _ quedan exentos (parámetros de firma).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Un color hexadecimal en una clase de Tailwind rompe el sistema de color
      // del proyecto (ver la nota de `colors` en tailwind.config.js).
      'pautello/no-arbitrary-colors': 'error',
    },
  },

  // Barril de iconos: mezcla a propósito la fábrica `createIcon` con los 82
  // iconos que genera. Fast Refresh no puede con un módulo así y no compensa
  // partirlo en 82 archivos, así que se exime únicamente este archivo.
  {
    name: 'pautello/icons',
    files: ['src/components/ui/icons/index.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Tests: vitest corre en Node.
  {
    name: 'pautello/tests',
    files: ['src/**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Configuración del proyecto: TypeScript sobre Node.
  {
    name: 'pautello/config',
    files: ['vite.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // Proceso principal de Electron y configs en CommonJS.
  {
    name: 'pautello/electron',
    files: ['electron/**/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  // Configs de PostCSS/Tailwind: ESM sobre Node.
  {
    name: 'pautello/tooling',
    files: ['*config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // Último: apaga las reglas de estilo que ya resuelve Prettier.
  prettier
);
