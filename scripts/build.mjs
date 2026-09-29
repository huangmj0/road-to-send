import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

export const artifactPath = new URL('../index.html', import.meta.url);
export const contractPath = new URL('../supabase/functions/road-to-send/contract.generated.json', import.meta.url);

// Pure: the Supabase function's copy of the shared contract, {apiVersion, scoring}, taken from
// src/schema.json and src/scoring.json so scoring has one source. Byte-stable across builds.
export function buildContract() {
  const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const apiVersion = read('../src/schema.json').properties.version.const;
  return `${JSON.stringify({apiVersion, scoring: read('../src/scoring.json')}, null, 2)}\n`;
}

// Pure: reads src/ and returns the rendered artifact as a string. Writes nothing,
// so scripts/check-generated.mjs can compare in memory.
export function buildHtml() {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').trimEnd();
  const template = read('../src/index.template.html');
  const styles = read('../src/styles.css');
  const scoring = JSON.parse(read('../src/scoring.json'));
  const schema = JSON.parse(read('../src/schema.json'));
  const apiVersion = schema.properties.version.const;
  const injectSharedConfig = source => source
    .replaceAll('__SCORING_CONFIG__', JSON.stringify(scoring))
    .replaceAll('__API_VERSION__', String(apiVersion));
  const appsScript = injectSharedConfig(read('../src/apps-script.js'));
  const appSource = injectSharedConfig(read('../src/app-core.js')+'\n'+read('../src/app.js')).replace('const SCRIPT=__APPS_SCRIPT__;\n', '').replace(/const SUPPORTED_API_VERSIONS=.*?\n/, '');
  const app = buildSync({stdin:{contents:appSource,loader:'js'},bundle:true,minify:true,format:'iife',write:false}).outputFiles[0].text;
  const prefix = `const SCRIPT=\`${appsScript.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')}\`;\nconst SUPPORTED_API_VERSIONS=new Set([${apiVersion},12]);\n`;

  if (!template.includes('__INLINE_STYLES__') || !template.includes('__INLINE_APP__')) {
    throw new Error('Source template is missing an inline build marker.');
  }
  if (app.includes('__APPS_SCRIPT__')) {
    throw new Error('Application source still contains an Apps Script build marker.');
  }
  if (app.includes('__SCORING_CONFIG__') || app.includes('__API_VERSION__')) {
    throw new Error('Application source still contains a shared configuration marker.');
  }

  return `${template.replace('__INLINE_STYLES__', () => styles).replace('__INLINE_APP__', () => prefix+app)}\n`;
}

// CLI path: `npm run build` writes index.html and the Supabase function contract, one line each.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(artifactPath, buildHtml());
  writeFileSync(contractPath, buildContract());
  console.log('Built self-contained index.html from src/.');
  console.log('Built the Supabase function contract from src/.');
}
