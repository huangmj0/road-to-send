import { readFileSync, writeFileSync } from 'node:fs';

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
const app = injectSharedConfig(read('../src/app.js')).replace(
  'const SCRIPT=__APPS_SCRIPT__;',
  `const SCRIPT=\`${appsScript.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')}\`;`,
);

if (!template.includes('__INLINE_STYLES__') || !template.includes('__INLINE_APP__')) {
  throw new Error('Source template is missing an inline build marker.');
}
if (app.includes('__APPS_SCRIPT__')) {
  throw new Error('Application source still contains an Apps Script build marker.');
}
if (app.includes('__SCORING_CONFIG__') || app.includes('__API_VERSION__')) {
  throw new Error('Application source still contains a shared configuration marker.');
}

writeFileSync(
  new URL('../index.html', import.meta.url),
  `${template.replace('__INLINE_STYLES__', styles).replace('__INLINE_APP__', app)}\n`,
);

console.log('Built self-contained index.html from src/.');
