const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Loads the frozen v13 redirector (legacy/apps-script-v13.js, see ADR-0004) into a vm context with a
// fake Sheet environment. It is read from the legacy file, never from index.html: the build no
// longer embeds it. Shared by backend-script.test.js, the Supabase conformance suite and
// scripts/capture-validation-golden.mjs.
function loadScript() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'legacy', 'apps-script-v13.js'), 'utf8');
  const context = {
    Utilities: {
      getUuid: () => 'uuid-test',
      formatDate: date => [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-'),
    },
    SpreadsheetApp: {getActive: () => ({getSpreadsheetTimeZone: () => 'UTC'})},
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.__source = source;
  return context;
}

module.exports = {loadScript};
