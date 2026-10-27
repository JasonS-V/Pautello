import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const input = option('--input');
const out = option('--out');
if (!input || !out)
  throw new Error(
    'Uso: node scripts/omr-ui-check.mjs --input externo.pdf --out carpeta-nueva [--url http://127.0.0.1:3000] [--playwright ruta-del-paquete] [--channel msedge] [--width 320]'
  );
assert(fs.existsSync(input), 'Falta la entrada externa requerida');
assert(!fs.existsSync(out), 'La carpeta de salida debe ser nueva');
const require = createRequire(import.meta.url);
const { chromium } = require(
  option('--playwright') ? path.resolve(option('--playwright')) : 'playwright'
);
const browser = await chromium.launch({ headless: true, channel: option('--channel') });
const baseUrl = option('--url') ?? 'http://127.0.0.1:3000/';
fs.mkdirSync(out, { recursive: true });

async function openImporter() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  const resources = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (/\.onnx|\.wasm|vocab\.json|pdf\.worker/.test(response.url()))
      resources.push({ url: response.url(), status: response.status() });
  });
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Saltar', exact: true }).click();
  await page.getByRole('button', { name: 'Archivo', exact: true }).click();
  await page.getByText('Importar...', { exact: true }).click();
  await page.setViewportSize({ width: Number(option('--width') ?? 1280), height: 960 });
  return { context, page, errors, resources };
}

try {
  const external = await openImporter();
  try {
    const { page, errors, resources } = external;
    await page.getByLabel('Seleccionar archivo a importar').setInputFiles(input);
    await page.getByRole('button', { name: 'Cargar en el Editor' }).waitFor({ timeout: 60000 });
    const dialog = page.getByRole('dialog', { name: 'Importar partitura', exact: true });
    const summary = await dialog.innerText();
    assert(
      summary.includes('confianza del reconocimiento'),
      'La entrada externa debe ejecutar reconocimiento óptico'
    );
    assert(
      resources.some((resource) => /\.onnx/.test(resource.url) && resource.status === 200),
      'No se cargó el modelo real'
    );
    if (/\.pdf$/i.test(input))
      assert(
        resources.some((resource) => /pdf\.worker/.test(resource.url) && resource.status === 200),
        'No se cargó PDF.js'
      );

    const capturedRun = await page.evaluate(() => window.__PAUTELLO_LAST_OMR_RUN__ ?? null);
    assert(
      capturedRun && capturedRun.ir && capturedRun.score,
      'No se capturó el IR/Score del navegador'
    );
    assert(
      Array.isArray(capturedRun.stageTrace) && capturedRun.stageTrace.length >= 5,
      'Faltan etapas de progreso en la captura del navegador'
    );

    if (await dialog.locator('summary').count()) await dialog.locator('summary').click();
    const regionButton = page.getByRole('button', { name: /Ver región del aviso/ }).first();
    let regionViewBox = null;
    if (await regionButton.count()) {
      await regionButton.click();
      const source = page.getByRole('img', { name: /Fuente, página/ });
      assert(
        await source.evaluate((element) => document.activeElement === element),
        'El foco debe llegar a la fuente'
      );
      regionViewBox = await source.getAttribute('viewBox');
      await source.scrollIntoViewIfNeeded();
    }
    assert(
      await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
      'El modal desborda horizontalmente'
    );
    await page.screenshot({ path: path.join(out, 'source-review.png'), fullPage: true });
    // El ancho solicitado comprueba el modal; el lienzo general se verifica en escritorio.
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.getByRole('button', { name: 'Cargar en el Editor' }).click();
    await page.getByRole('button', { name: /Revisar lectura OMR: fuente/ }).click();
    await page.getByRole('dialog', { name: 'Revisar lectura OMR', exact: true }).waitFor();
    assert.deepEqual(errors, [], 'Errores del navegador');

    fs.writeFileSync(
      path.join(out, 'stages.json'),
      JSON.stringify(
        {
          stageTrace: capturedRun.stageTrace,
          pageDiagnostics: capturedRun.pageDiagnostics ?? [],
        },
        null,
        2
      ) + '\n'
    );
    fs.writeFileSync(path.join(out, 'ir.json'), JSON.stringify(capturedRun.ir, null, 2) + '\n');
    fs.writeFileSync(
      path.join(out, 'conversion.json'),
      JSON.stringify(
        {
          warnings: capturedRun.warnings,
          proposals: capturedRun.proposals ?? [],
          report: capturedRun.report ?? null,
          sourceLinks: capturedRun.sourceLinks ?? [],
          metadataHints: capturedRun.metadataHints ?? {},
        },
        null,
        2
      ) + '\n'
    );
    fs.writeFileSync(
      path.join(out, 'score.json'),
      JSON.stringify(capturedRun.score, null, 2) + '\n'
    );
    fs.writeFileSync(
      path.join(out, 'external.json'),
      JSON.stringify(
        {
          browser: await browser.version(),
          input: path.resolve(input),
          url: baseUrl,
          sourceType: capturedRun.sourceType,
          confidence: capturedRun.confidence,
          pagesProcessed: capturedRun.pagesProcessed,
          stavesDetected: capturedRun.stavesDetected,
          measuresDetected: capturedRun.measuresDetected,
          notesDetected: capturedRun.notesDetected,
          stagesCaptured: capturedRun.stageTrace.length,
          summary,
          regionViewBox,
          reviewAfterImport: true,
          resources,
          errors,
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    await external.context.close();
  }

  const native = await openImporter();
  try {
    const { page, errors, resources } = native;
    const score = {
      id: 'native-check',
      title: 'Restauración de control',
      composer: 'Control',
      tempo: 90,
      timeSignature: { beats: 3, beatType: 4 },
      keySignature: 'G',
      createdAt: 1,
      updatedAt: 1,
      staves: [
        {
          id: 'staff-control',
          name: 'Parte de control',
          clef: 'bass',
          measures: [
            {
              id: 'measure-control',
              items: [
                {
                  id: 'note-control',
                  type: 'note',
                  duration: 'h',
                  pitch: { step: 'C', octave: 3, accidental: null },
                },
              ],
            },
          ],
        },
      ],
    };
    const payload = Buffer.from(JSON.stringify(score)).toString('base64');
    await page.getByLabel('Seleccionar archivo a importar').setInputFiles({
      name: 'native.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg"><metadata>PAUTELLO_V1:${payload}:END_PAUTELLO</metadata></svg>`
      ),
    });
    await page.getByText('Restauración nativa', { exact: true }).waitFor();
    assert(
      !resources.some((resource) => /\.onnx/.test(resource.url)),
      'La restauración nativa no debe ejecutar inferencia'
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'native.json'),
      JSON.stringify({ sourceType: 'lossless-metadata', resources, errors }, null, 2) + '\n'
    );
  } finally {
    await native.context.close();
  }
  console.log(
    `Importación externa y restauración nativa verificadas en ${baseUrl}. Evidencia: ${path.resolve(out)}`
  );
} finally {
  await browser.close();
}
