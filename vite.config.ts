import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Politica de seguridad de contenido. La app no carga nada remoto: tipografia,
 * iconos y glifos viven en el bundle (`@fontsource/*`, `lucide-react`, SVG
 * propios). `file:` cubre el build de Electron y `ws:`/`wss:` el HMR de Vite.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self' file:",
  "script-src 'self' 'wasm-unsafe-eval' file: blob:",
  "worker-src 'self' file: blob: data:",
  "style-src 'self' 'unsafe-inline' file:",
  "img-src 'self' file: data: blob:",
  "font-src 'self' file: data:",
  "media-src 'self' file: blob: data:",
  "connect-src 'self' file: blob: data: ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/**
 * Modo sin conexión del build web.
 *
 * El service worker no puede conocer de antemano los nombres con hash que emite
 * Vite, así que se genera al compilar: la plantilla de `src/pwa/sw-template.js`
 * recibe la lista real de archivos (incluidos los chunks de los modales
 * diferidos, que si no quedarían fuera de la caché y fallarían sin conexión) y
 * una versión derivada de esa lista, que sirve para invalidar la caché vieja.
 *
 * Las tipografías se quedan fuera de la precarga a propósito: cada familia trae
 * decenas de subconjuntos por `unicode-range` y precargarlos todos sumaría
 * varios MB a la primera visita. El worker las cachea cuando se piden.
 */
const SW_TEMPLATE_PATH = new URL('./src/pwa/sw-template.js', import.meta.url);

/** Se precarga el código y los recursos propios más los archivos de `public/`. */
const PRECACHE_EXTENSIONS = /\.(js|css|svg)$/;
// `index.html` no aparece en el bundle de `generateBundle` (Vite lo procesa
// después), así que se nombra a mano: sin él, abrir la app sin conexión fallaría.
const ALWAYS_PRECACHE = [
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-maskable.svg',
  'favicon.svg',
];

const OMR_RESOURCES = [
  'omr/model-manifest.json',
  'omr/vocab.json',
  'omr/omr-line.fp32.onnx',
  'omr/omr-line.int8.onnx',
  'omr/pdf.worker.min.mjs',
  'omr/ocr/worker.min.js',
  'omr/ocr/tesseract-core-lstm.wasm.js',
  'omr/ocr/tesseract-core-lstm.wasm',
  'omr/ocr/eng.traineddata.gz',
  'omr/ocr/spa.traineddata.gz',
];

function buildServiceWorker(files: string[], wasm: Array<{ url: string; sha256: string }>): string {
  const precache = ['./', ...files.map((file) => `./${file}`)].sort();
  const omr = [
    ...OMR_RESOURCES.map((url) => {
      const bytes = readFileSync(new URL(`./public/${url}`, import.meta.url));
      const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
      return {
        url: `./${url}`,
        sha256: url.endsWith('.gz') ? [hash(bytes), hash(gunzipSync(bytes))] : hash(bytes),
      };
    }),
    ...wasm,
  ];
  const version = createHash('sha256')
    .update(JSON.stringify({ precache, omr }))
    .digest('hex')
    .slice(0, 12);

  return readFileSync(SW_TEMPLATE_PATH, 'utf8')
    .replace('__SW_VERSION__', version)
    .replace('__SW_PRECACHE__', JSON.stringify(precache, null, 2))
    .replace('__SW_OMR__', JSON.stringify(omr, null, 2));
}

export default defineConfig({
  base: './',
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  plugins: [
    react(),
    {
      name: 'pautello/service-worker',
      apply: 'build',
      generateBundle(_options, bundle) {
        const files = [...Object.keys(bundle).filter((file) => PRECACHE_EXTENSIONS.test(file))];
        files.push(...ALWAYS_PRECACHE);
        const wasm = Object.entries(bundle)
          .filter(([file]) => /^assets\/ort-wasm-simd-threaded-[^.]+\.wasm$/.test(file))
          .map(([file, output]) => ({
            url: `./${file}`,
            sha256: createHash('sha256')
              .update(output.type === 'asset' ? output.source : output.code)
              .digest('hex'),
          }));
        if (wasm.length !== 1) throw new Error('El build OMR requiere un WASM ONNX versionado.');
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: buildServiceWorker(files, wasm),
        });
      },
    },
    {
      // La CSP se inyecta en dev y en build para no duplicar el literal.
      name: 'pautello/csp',
      transformIndexHtml: {
        order: 'pre',
        handler: (html: string) =>
          html.replace(
            '<!-- csp -->',
            `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`
          ),
      },
    },
  ],
  build: {
    // Los mapas se activan solo donde aportan algo: el paquete de escritorio
    // (`pnpm build:desktop`, que añade `--sourcemap`) los conserva para leer
    // trazas reales del renderer. El build web distribuido no publica los ~2,4 MB
    // de mapas del chunk principal.
    sourcemap: false,
    rollupOptions: {
      output: {
        // React e iconos cambian poco: separarlos mejora el cacheado y deja
        // evidente cuanto pesa el codigo propio de la app.
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react';
          }
          if (id.includes('@hugeicons')) {
            return 'icons';
          }
          if (id.includes('/src/engraver/')) {
            return 'engraver';
          }
          if (id.includes('/src/audio/')) {
            return 'audio';
          }
          if (id.includes('onnxruntime-web')) {
            return 'omr-ort';
          }
          if (id.includes('pdfjs-dist')) {
            return 'omr-pdf';
          }
          if (id.includes('/src/omr/')) {
            return 'omr-engine';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/types/**',
        'src/constants/**',
      ],
      // Trinquete de cobertura: el umbral se fija justo por debajo de lo que
      // hay hoy (≈29% en líneas y sentencias). No puede bajar nunca; se sube a
      // mano cuando `useScore` y los componentes ganen pruebas. Antes el valor
      // era 45% y no se cumplía, así que el gate mentía: al no ejecutarse con
      // `--coverage` en CI, nadie se enteraba de que estaba por debajo.
      thresholds: {
        lines: 45,
        functions: 60,
        branches: 60,
        statements: 45,
      },
    },
  },
});
