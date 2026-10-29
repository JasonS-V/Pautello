import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { _electron } from 'playwright';

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const executablePath = option('--executable');
const input = option('--input') ?? 'src/omr/__tests__/fixtures/line.png';
assert(
  executablePath && fs.existsSync(executablePath),
  'Indica --executable del paquete Electron.'
);
assert(fs.existsSync(input), 'Falta la imagen de prueba.');

const app = await _electron.launch({ executablePath: path.resolve(executablePath) });
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(30000);
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) externalRequests.push(request.url());
  });
  await page.context().route(/^https?:/, (route) => route.abort());

  const skip = page.getByRole('button', { name: 'Saltar', exact: true });
  if (await skip.count()) await skip.click();
  await page.getByRole('button', { name: 'Archivo', exact: true }).click();
  await page.getByText('Importar...', { exact: true }).click();
  await page.getByLabel('Seleccionar archivo a importar').setInputFiles(path.resolve(input));
  await page.getByRole('button', { name: 'Cargar en el Editor' }).waitFor({ timeout: 60000 });
  const run = await page.evaluate(() => window.__PAUTELLO_LAST_OMR_RUN__ ?? null);
  assert.equal(run?.sourceType, 'neural-onnx');
  assert.equal(run.stavesDetected, 1);
  assert.equal(run.measuresDetected, 6);
  assert.equal(run.notesDetected, 9);
  const dialog = page.getByRole('dialog', { name: 'Importar partitura', exact: true });
  const firstEvent = dialog.locator('[aria-label="Eventos del compás"] button').first();
  await firstEvent.click();
  const originalEvent = await firstEvent.innerText();
  await dialog.getByLabel('Figura del evento').selectOption('h');
  assert.notEqual(await firstEvent.innerText(), originalEvent);
  await dialog.getByRole('button', { name: 'Deshacer corrección' }).click();
  assert.equal(await firstEvent.innerText(), originalEvent);
  await page.getByRole('button', { name: 'Cargar en el Editor' }).click();
  await page.getByRole('button', { name: /Revisar lectura OMR: fuente/ }).click();
  await page.getByRole('dialog', { name: 'Revisar lectura OMR', exact: true }).waitFor();
  assert.deepEqual(errors, [], 'Errores de renderer o CSP');
  assert.deepEqual(externalRequests, [], 'El flujo local no debe solicitar recursos externos');

  const result = {
    executable: path.resolve(executablePath),
    platform: process.platform,
    sourceType: run.sourceType,
    staves: run.stavesDetected,
    measures: run.measuresDetected,
    notes: run.notesDetected,
    reviewAfterImport: true,
    correctionAndUndoVerified: true,
    errors,
    externalRequests,
  };
  if (option('--out')) fs.writeFileSync(option('--out'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  await app.close();
}
