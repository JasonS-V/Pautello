import fs from 'node:fs';
import {
  checkCorpus,
  generateControlledCorpusVariants,
  type OmrCorpusManifest,
} from './omr-corpus-check';

const generateFlag = process.argv.includes('--generate-variants');
const variantsDir = 'tasks/local/corpus-variants';
if (generateFlag) {
  const generated = await generateControlledCorpusVariants(
    'src/omr/__tests__/fixtures/line.png',
    variantsDir
  );
  console.log(JSON.stringify({ generated }, null, 2));
}
const inputIdx = process.argv.indexOf('--input');
const manifestPath = inputIdx >= 0 ? process.argv[inputIdx + 1] : 'tasks/omr-corpus.json';
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as OmrCorpusManifest;
  const summary = checkCorpus(manifest, { verifyDiskFiles: true });
  console.log(JSON.stringify(summary, null, 2));
}
