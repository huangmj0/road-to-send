const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Loads the Apps Script embedded in the built index.html into a vm context with a fake Sheet
// environment. Shared by backend-script.test.js and the Supabase conformance suite.
function loadScript() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const match = html.match(/const SCRIPT=(`[^`]*`);\nconst SUPPORTED_API_VERSIONS/);
  assert.ok(match, 'embedded Apps Script was found');
  const outer = {};
  vm.createContext(outer);
  vm.runInContext(`SCRIPT=${match[1]}`, outer);
  const context = {
    Utilities: {
      getUuid: () => 'uuid-test',
      formatDate: date => [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-'),
    },
    SpreadsheetApp: {getActive: () => ({getSpreadsheetTimeZone: () => 'UTC'})},
  };
  vm.createContext(context);
  vm.runInContext(outer.SCRIPT, context);
  context.__source = outer.SCRIPT;
  return context;
}

module.exports = {loadScript};
