// Loads the published tester and the inspection add-on into a Node vm, on top of
// a minimal DOM stub, so the inspection logic can be exercised without a browser
// and without hardware.
//
// The tester is a plain <script>, so the add-on shares its top-level scope - the
// same arrangement as in the browser. Both files are read straight from docs/, so
// these tests always run against what is actually published.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TESTER_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'cr2', 'tester');
const TESTER = path.join(TESTER_DIR, 'index.html');
const ADDON = path.join(TESTER_DIR, 'inspection.js');

// Everything the tests reach into. Kept in one place: if a name here stops
// resolving, the tester and the add-on have drifted apart.
const HOOK = `
;globalThis.__t = {
  // pure helpers
  inspBuildFrame, inspStartSendingData, inspParseDs0, inspParseDs1,
  inspRangeValues, inspBooleanValues, inspNudgeProfile, inspFwdKmh, inspTurnKmh,
  inspBuildReportCsv, inspectionRx, inspOnFrame, inspWaitUntilStopped,
  // the whole sequence
  run: inspRun,
  renderCautions: inspRenderCautions,
  cautionsHtml: () => inspWarnBox.innerHTML,
  // constants under test
  spParams: INSP_SP_PARAMS, spBaseline: INSP_SP_BASELINE, motorProfile: INSP_MOTOR_PROFILE,
  // state access for the tests
  setPort: (p) => { port = p; },
  setConnected: (v) => { isConnected = v; },
  setRunning: (v) => { inspRunning = v; },
  setLight: (v) => { inspLight = v; },
  setRightSign: (v) => { inspRightSign = v; },
  resetRx: () => { inspRxBuffer = new Uint8Array(0); },
  pushResults: (rows) => { inspResults = rows; inspRowNo = rows.length; },
  setInfo: (o) => { inspInfoData = o; },
  setModules: (rows) => { inspModules = rows; },
  results: () => inspResults,
  modules: () => inspModules,
  info: () => inspInfoData,
  status: () => inspStatusText.textContent,
};
`;

function makeElement(id) {
  return {
    id,
    value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
    scrollTop: 0, scrollHeight: 0, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, removeChild() {}, insertAdjacentHTML() {},
    click() {}, setAttribute() {}, scrollTo() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 200 }; },
    querySelector() { return makeElement('child'); },
    querySelectorAll() { return []; },
  };
}

function makeDocument() {
  const elements = new Map();
  return {
    // Set by a test to choose the inspection mode the add-on reads at start.
    selectedMode: 'light',
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelector(selector) {
      const el = makeElement('query');
      if (String(selector).includes('insp-mode')) el.value = this.selectedMode;
      return el;
    },
    querySelectorAll() { return []; },
    createElement(tag) { return makeElement(tag); },
    addEventListener() {}, removeEventListener() {},
    body: makeElement('body'),
    head: makeElement('head'),
  };
}

/**
 * @param {object} [options]
 * @param {object} [options.shrink]  constant name -> value, to cut the wall-clock
 *                                   time of a full run without changing the logic
 * @param {object} [options.context] extra globals for the vm context
 * @returns {{ T: object, ctx: object }}
 */
function loadTester(options) {
  const opts = options || {};
  const html = fs.readFileSync(TESTER, 'utf8');
  const scripts = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scripts) throw new Error('no inline <script> found in ' + TESTER);

  let source = scripts[1] + '\n// ===== inspection.js =====\n' + fs.readFileSync(ADDON, 'utf8');

  for (const [name, value] of Object.entries(opts.shrink || {})) {
    const re = new RegExp('const ' + name + '\\s*=\\s*\\d+;');
    if (!re.test(source)) throw new Error('constant not found: ' + name);
    source = source.replace(re, `const ${name} = ${value};`);
  }

  const document = makeDocument();
  const ctx = Object.assign({
    document,
    window: { confirm: () => true },
    navigator: { serial: {} },
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Intl, Date, Math, JSON, URLSearchParams,
    location: { search: '' },
    URL: { createObjectURL: () => 'blob:', revokeObjectURL() {} },
    Blob: function () {},
    alert() {}, confirm: () => true,
  }, opts.context || {});
  ctx.globalThis = ctx;
  ctx.window.document = document;

  vm.createContext(ctx);
  vm.runInContext(source + HOOK, ctx, { filename: 'tester.js' });
  return { T: ctx.__t, ctx };
}

module.exports = { loadTester, makeElement };
