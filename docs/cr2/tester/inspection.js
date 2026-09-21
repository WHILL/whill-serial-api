/* =============================================================================
   WHILL Serial API Tester - Inspection add-on
   -----------------------------------------------------------------------------
   Not part of the published tester. index.html loads this file only when it is
   opened with ?addon=inspection, so an ordinary user never sees the tab.

   Everything this add-on needs from the tester is listed in
   INSP_TESTER_CONTRACT below. If you change the tester, run the regression
   tests in tools/cr2-inspection/tests/ - they load this file against the tester
   and against a simulated WHILL, and will tell you if the contract broke.

   All symbols defined here are prefixed insp / INSP_ so they cannot collide
   with the tester's own top-level declarations.
   ============================================================================ */

// ---- Tester contract ---------------------------------------------------------
// Checked at install time. `port` and `isConnected` are used as well, but they
// are plain variables that are legitimately undefined before the first connect,
// so they cannot be probed this way - they are part of the contract regardless.
const INSP_TESTER_CONTRACT = [
  ['testerAddons', typeof testerAddons],
  ['appendLog', typeof appendLog],
  ['formatHexBytes', typeof formatHexBytes],
  ['getJapanTimeString', typeof getJapanTimeString],
  ['getJapanTimeStringForFilename', typeof getJapanTimeStringForFilename],
  ['switchTab', typeof switchTab],
  ['stopJoystickContinuousSending', typeof stopJoystickContinuousSending],
  ['stopVelocityContinuousSending', typeof stopVelocityContinuousSending],
  ['stopJoystickInterval', typeof stopJoystickInterval],
];

// ---- Markup injected into the tester -----------------------------------------
const INSP_STYLE = `
/* ===== Inspection tab ===== */
#inspection-tab .insp-controls {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 8px;
}
#inspection-tab .insp-controls > label { font-weight: bold; color: #0075B8; font-size: 11pt; }
#inspection-tab .insp-check { display: flex; align-items: center; gap: 6px; }
#inspection-tab .insp-check input { width: 18px; height: 18px; }
#inspection-tab .insp-mode { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
#inspection-tab .insp-mode label {
  display: flex; align-items: center; gap: 4px;
  font-weight: bold; color: #0075B8; font-size: 11pt;
}
#inspection-tab .insp-mode input { width: 16px; height: 16px; }
#inspection-tab .insp-run-button { width: 110px; padding: 9px 12px; font-size: 12pt; margin: 0; }
#inspection-tab .insp-warn {
  background: #fff3cd; border: 1px solid #ffeaa7; color: #856404;
  font-weight: bold; border-radius: 5px; padding: 6px 10px; margin-top: 4px;
}
#inspection-tab .insp-warn div + div { margin-top: 2px; }
#inspection-tab .insp-status { font-weight: bold; color: #0075B8; font-size: 11pt; }
#inspection-tab .insp-info-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 3px 16px; font-size: 10pt; color: #000;
}
#inspection-tab .insp-info-grid .k { color: #0075B8; font-weight: bold; margin-right: 6px; }
#inspection-tab .insp-module-table {
  border-collapse: collapse; margin-bottom: 10px; font-size: 10pt; color: #000;
}
#inspection-tab .insp-module-table th, #inspection-tab .insp-module-table td {
  border: 1px solid #cfe0ee; padding: 3px 12px; text-align: left; white-space: nowrap;
}
#inspection-tab .insp-module-table thead th { background: #0075B8; color: #fff; }
#inspection-tab .insp-module-table tbody th { background: #eef4fb; color: #0075B8; }
#inspection-tab .insp-module-table tbody td { font-family: monospace; }
#inspection-tab .insp-summary {
  display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
  margin-bottom: 8px; font-size: 11pt; font-weight: bold; color: #000;
}
#inspection-tab .insp-verdict { padding: 3px 12px; border-radius: 5px; color: #fff; }
#inspection-tab .insp-verdict.ok { background: #2e7d32; }
#inspection-tab .insp-verdict.ng { background: #E94816; }
#inspection-tab .insp-verdict.none { background: #999; }
#inspection-tab .insp-table { border-collapse: collapse; width: 100%; font-size: 9.5pt; color: #000; }
#inspection-tab .insp-table th, #inspection-tab .insp-table td {
  border: 1px solid #cfe0ee; padding: 3px 6px; text-align: left; vertical-align: top;
}
#inspection-tab .insp-table thead th { background: #0075B8; color: #fff; white-space: nowrap; }
#inspection-tab .insp-table td.no { text-align: right; white-space: nowrap; color: #666; }
#inspection-tab .insp-table td.cmd { white-space: nowrap; font-family: monospace; }
#inspection-tab .insp-table tr.stage th {
  background: #eef4fb; color: #0075B8; font-size: 10.5pt; text-align: left;
}
#inspection-tab .insp-table td.res { white-space: nowrap; font-weight: bold; text-align: center; }
#inspection-tab .insp-table td.res.PASS { color: #2e7d32; }
#inspection-tab .insp-table td.res.FAIL { color: #E94816; }
#inspection-tab .insp-table td.res.INFO { color: #0075B8; }
#inspection-tab .insp-table td.res.SKIP { color: #999; }
`;

const INSP_MARKUP = `
<div id="inspection-tab" class="tab-content">
  <div class="panel">
    <div class="panel-title">Select case</div>
    <div class="insp-mode">
      <label><input type="radio" name="insp-mode" value="full"> Full</label>
      <label><input type="radio" name="insp-mode" value="light" checked=""> Light</label>
      <label><input type="radio" name="insp-mode" value="legacy"> Legacy</label>
    </div>
    <div class="insp-controls">
      <label class="insp-check"><input type="checkbox" id="insp-jackup-check"> Chair is jacked up</label>
      <button id="insp-start-button" type="button" class="version-button insp-run-button" disabled="">Start</button>
      <button id="insp-end-button" type="button" class="power-button power-off insp-run-button" disabled="">End</button>
      <span id="insp-status" class="insp-status">Not run</span>
    </div>
    <div id="insp-warn" class="insp-warn"></div>
  </div>

  <div class="panel">
    <div class="panel-title">Device / Inspection Information</div>
    <table class="insp-module-table" id="insp-module-table">
      <thead>
        <tr><th>Module</th><th>Firmware</th><th>Serial number</th></tr>
      </thead>
      <tbody id="insp-module-body"></tbody>
    </table>
    <div id="insp-info-grid" class="insp-info-grid"></div>
  </div>

  <div class="panel">
    <div class="panel-title">Result</div>
    <div id="insp-summary" class="insp-summary"></div>
    <div style="margin-bottom: 8px;">
      <button id="insp-download-button" type="button" class="download-csv-button" style="padding: 6px 16px; font-size: 10pt; margin: 0;" disabled="">Download Report (CSV)</button>
    </div>
    <table class="insp-table">
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th style="width: 150px;">Command</th>
          <th>Test item</th>
          <th style="width: 150px;">Sent</th>
          <th style="width: 190px;">Expected</th>
          <th style="width: 210px;">Measured</th>
          <th style="width: 70px;">Result</th>
        </tr>
      </thead>
      <tbody id="insp-result-body"></tbody>
    </table>
  </div>
</div>
`;

/* =========================================================================
   Inspection tab - automatic check of every published command
   -------------------------------------------------------------------------
   Start : sends every command in turn, checks the outcome against Dataset0 /
           Dataset1 / GetSettings / the response frames, and builds a report.
   End   : aborts a running inspection (settings are restored where possible).

   Each parameter is exercised with five values: below range / minimum /
   middle / maximum / above range.
     - Boolean commands ("1 acts, any other value does not") use 0 / 1 / 2 /
       255 instead, because a range means nothing for them.
     - A parameter whose lower bound is 0 has no representable below-range
       value, so that case is reported as SKIP.
   The motor commands (SetJoystick / SetVelocity) are sent every 60 ms for the
   drive time below; the case passes when the peak speed over the last 2 s is
   within 5% of the target speed.
   ========================================================================= */

// Element handles, filled in by inspInstall() once the markup above is in the page.
let inspJackupCheck, inspStartButton, inspEndButton, inspStatusText, inspWarnBox,
    inspInfoGrid, inspModuleTable, inspModuleBody, inspSummaryBox, inspResultBody, inspDownloadButton;

const INSP_DRIVE_MS        = 4000;   // how long each motor command is driven
const INSP_DRIVE_PERIOD_MS = 60;     // how often the motor command is repeated
// Tail window used to find the plateau ("where the value stops moving").
const INSP_PLATEAU_MS      = 2000;
const INSP_SPEED_TOL       = 0.05;   // tolerance against the target speed
const INSP_ZERO_KMH        = 0.05;   // speed allowed when the target is 0 [km/h]
const INSP_COOLDOWN_MS     = 2500;   // upper bound on the coast-down wait between cases
const INSP_STOP_KMH        = 0.05;   // at or below this wheel speed the chair counts as stopped
const INSP_STOP_HOLD_MS    = 300;    // the stop must hold this long before the next case
const INSP_GAP_MS          = 30;     // gap between commands (the specification requires 2 ms or more)
const INSP_POWER_WAIT_MS   = 5500;   // Power OFF -> ON wait (the specification requires more than 5 s)
const INSP_MIN_BATTERY     = 20;     // abort below this battery level
// Dataset1 error codes that must not abort the inspection.
//   7  = calibration incomplete
//   63 = speed profile error (always raised, because the inspection
//        deliberately sends out-of-range profiles)
const INSP_IGNORED_ERRORS  = [7, 63];
const INSP_DS1_INTERVAL_MS = 100;    // Dataset1 interval used while measuring the motors
// Wait between sending SetSpeedProfile and reading it back from Dataset0.
// SM -> MC goes over CAN as two RESERVE frames plus a STORE, so the new value
// takes a moment to land. 100-200 ms was enough for all 50 cases on real
// hardware; 300 ms leaves some margin.
const INSP_PROFILE_SETTLE_MS = 300;

// full   - every parameter across its whole range.
// light  - one accepted and one rejected value per parameter; about a third of the
//          report and of the time.
// legacy - the same case set as light, but only the six commands an older chair
//          has: StartSendingData, StopSendingData, SetPower, SetJoystick,
//          SetSpeedProfile and SetVelocity. Everything that needs GetSettings,
//          GetIdentification or GetCapability is left out, so the power state is
//          judged from the power-on response and from whether state data flows.
let inspMode = 'light';
let inspLight = true;        // true for light and legacy: the abbreviated case set
let inspLegacy = false;      // true when only the six legacy commands may be sent

// true while the automatic check is running. The tester's raw receive log is
// suppressed while it is set, because this add-on writes its own log lines.
let inspRunning = false;
let inspAbortReason = null;
let inspResults = [];
let inspRowNo = 0;
let inspInfoData = {};
let inspModules = [];        // one row per module: { name, firmware, serial }
let inspRxBuffer = new Uint8Array(0);
const inspFrameHandlers = new Set();
let inspLastPowerOffAt = 0;
let inspRightSign = 1;               // +1 when the right motor reads the same sign as the left when driving forward

class InspectionAbort extends Error {
  constructor(message) { super(message); this.name = 'InspectionAbort'; }
}

// ---- Frame reception -----------------------------------------------------
// Generic frame parser, active only while an inspection runs. It validates
// 0xAF / length / checksum and hands complete frames to the listeners,
// independently of the per-feature parsers elsewhere in this file.
function inspectionRx(chunk) {
  if (!inspRunning) { inspRxBuffer = new Uint8Array(0); return; }
  const buf = new Uint8Array(inspRxBuffer.length + chunk.length);
  buf.set(inspRxBuffer);
  buf.set(chunk, inspRxBuffer.length);

  let i = 0;
  while (i + 2 <= buf.length) {
    if (buf[i] !== 0xAF) { i++; continue; }
    const len = buf[i + 1];
    const total = len + 2;              // 0xAF + length + (payload + checksum)
    if (len < 2 || total > 64) { i++; continue; }
    if (buf.length - i < total) break;  // frame incomplete; wait for the next chunk
    let cs = 0;
    for (let k = 0; k < total - 1; k++) cs ^= buf[i + k];
    if (cs !== buf[i + total - 1]) { i++; continue; }
    const payload = buf.slice(i + 2, i + total - 1);
    const frame = { cmd: payload[0], payload, at: Date.now() };
    inspFrameHandlers.forEach((h) => { try { h(frame); } catch (e) { console.error(e); } });
    i += total;
  }
  inspRxBuffer = buf.slice(i);
  if (inspRxBuffer.length > 512) inspRxBuffer = inspRxBuffer.slice(inspRxBuffer.length - 512);
}

function inspOnFrame(handler) {
  inspFrameHandlers.add(handler);
  return () => inspFrameHandlers.delete(handler);
}

// Wait for a frame matching the predicate. Resolves to null on timeout.
function inspWaitFrame(predicate, timeoutMs) {
  return new Promise((resolve) => {
    let off = () => {};
    const timer = setTimeout(() => { off(); resolve(null); }, timeoutMs);
    off = inspOnFrame((f) => {
      if (!predicate(f)) return;
      clearTimeout(timer);
      off();
      resolve(f);
    });
  });
}

// ---- Sending / waiting ---------------------------------------------------
function inspBuildFrame(payload) {
  const frame = [0xAF, payload.length + 1, ...payload];
  let cs = 0;
  for (const b of frame) cs ^= b;
  return new Uint8Array([...frame, cs]);
}

async function inspSend(bytes, label) {
  if (!(port && port.writable)) throw new Error('the serial port is not available');
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const writer = port.writable.getWriter();
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
  }
  if (label) appendLog(`[${getJapanTimeString()}] [inspection] ${label}: ${formatHexBytes(Array.from(data))}\n`);
}

// Send a command with a log label, then leave the required gap before the next one.
async function inspCommand(payload, label) {
  await inspSend(inspBuildFrame(payload), label);
  await inspSleep(INSP_GAP_MS);
}

const inspRawSleep = (ms) => new Promise((r) => setTimeout(r, ms));

function inspCheckAbort() {
  if (inspAbortReason) throw new InspectionAbort(inspAbortReason);
}

async function inspSleep(ms) {
  const end = Date.now() + ms;
  for (;;) {
    inspCheckAbort();
    const left = end - Date.now();
    if (left <= 0) return;
    await inspRawSleep(Math.min(60, left));
  }
}

// ---- Report --------------------------------------------------------------
function inspEsc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inspAddStage(title) {
  inspResults.push({ stage: title });
  inspRenderResults();
  appendLog(`[${getJapanTimeString()}] [inspection] === ${title} ===\n`);
}

// result: 'PASS' | 'FAIL' | 'INFO' | 'SKIP'
function inspAddResult(row) {
  if (inspLight && row.result === 'SKIP') return null;   // a light report carries results only
  const rec = { no: ++inspRowNo, ...row };
  inspResults.push(rec);
  inspRenderResults();
  appendLog(`[${getJapanTimeString()}] [inspection] #${rec.no} ${rec.cmd} / ${rec.item}` +
            ` -> ${rec.result}${rec.actual ? ` (${rec.actual})` : ''}\n`);
  return rec;
}

const inspJudge = (ok) => (ok ? 'PASS' : 'FAIL');

function inspRenderResults() {
  inspResultBody.innerHTML = inspResults.map((r) => {
    if (r.stage) return `<tr class="stage"><th colspan="7">${inspEsc(r.stage)}</th></tr>`;
    return `<tr>` +
      `<td class="no">${r.no}</td>` +
      `<td class="cmd">${inspEsc(r.cmd)}</td>` +
      `<td>${inspEsc(r.item)}</td>` +
      `<td>${inspEsc(r.sent)}</td>` +
      `<td>${inspEsc(r.expect)}</td>` +
      `<td>${inspEsc(r.actual)}</td>` +
      `<td class="res ${inspEsc(r.result)}">${inspEsc(r.result)}</td>` +
      `</tr>`;
  }).join('');
}

function inspRenderSummary(finished) {
  const rows = inspResults.filter((r) => !r.stage);
  const count = (v) => rows.filter((r) => r.result === v).length;
  const pass = count('PASS'), fail = count('FAIL'), info = count('INFO'), skip = count('SKIP');
  let verdict = 'In progress', cls = 'none';
  if (finished) {
    if (pass + fail === 0) { verdict = 'Not run'; cls = 'none'; }
    else if (fail === 0) { verdict = 'PASS'; cls = 'ok'; }
    else { verdict = 'FAIL'; cls = 'ng'; }
  }
  inspSummaryBox.innerHTML =
    `<span class="insp-verdict ${cls}">Overall: ${inspEsc(verdict)}</span>` +
    `<span>${pass + fail} judged</span>` +
    `<span style="color:#2e7d32;">PASS ${pass}</span>` +
    `<span style="color:#E94816;">FAIL ${fail}</span>` +
    `<span style="color:#0075B8;">Info ${info}</span>` +
    `<span style="color:#999;">Skipped ${skip}</span>`;
}

function inspRenderInfo() {
  inspInfoGrid.innerHTML = Object.entries(inspInfoData)
    .map(([k, v]) => `<div><span class="k">${inspEsc(k)}</span>${inspEsc(v)}</div>`)
    .join('');
}

function inspSetInfo(key, value) {
  inspInfoData[key] = value;
  inspRenderInfo();
}

function inspRenderModules() {
  inspModuleTable.hidden = inspModules.length === 0;   // a legacy chair has no GetIdentification
  inspModuleBody.innerHTML = inspModules.map((m) =>
    `<tr><th>${inspEsc(m.name)}</th><td>${inspEsc(m.firmware)}</td><td>${inspEsc(m.serial)}</td></tr>`
  ).join('');
}

function inspSetModules(rows) {
  inspModules = rows;
  inspRenderModules();
}

function inspSetStatus(text) { inspStatusText.textContent = text; }

// ---- Reading the responses -----------------------------------------------
const inspS16 = (hi, lo) => (((hi << 8) | lo) << 16) >> 16;

// GetSettings (0x0F). A missing reply is not an error by itself, so try 3 times.
async function inspGetSettings(retries = 3) {
  for (let i = 0; i < retries; i++) {
    inspCheckAbort();
    const waiter = inspWaitFrame((f) => f.cmd === 0x0F && f.payload.length >= 7, 700);
    await inspSend(inspBuildFrame([0x0F]), i === 0 ? 'GetSettings' : `GetSettings (retry ${i})`);
    const f = await waiter;
    if (f) {
      const v = f.payload.slice(1);
      return {
        deviceLock: v[0], joystickPause: v[1], maxSpeedLevel: v[2],
        speedLevel: v[3], autoPowerOff: v[4], powerOn: v[5],
        fields: Array.from(v),
      };
    }
    await inspSleep(150);
  }
  return null;
}

// Send a setting and read it back with GetSettings. Some settings are relayed
async function inspSetAndRead(payload, label, settleMs = 400) {
  await inspCommand(payload, label);
  await inspSleep(settleMs);
  return inspGetSettings();
}

async function inspGetCapability(retries = 3) {
  for (let i = 0; i < retries; i++) {
    inspCheckAbort();
    const waiter = inspWaitFrame((f) => f.cmd === 0x10 && f.payload.length >= 4, 700);
    await inspSend(inspBuildFrame([0x10]), i === 0 ? 'GetCapability' : `GetCapability (retry ${i})`);
    const f = await waiter;
    if (f) {
      const v = f.payload;
      return {
        major: v[1], minor: v[2],
        commands: Array.from(v.slice(3, 11)),
        dataset1: Array.from(v.slice(11, 15)),
      };
    }
    await inspSleep(150);
  }
  return null;
}

// GetIdentification (0x07). HMI / MC read 0.0 until they answer on the internal bus, so retry.
async function inspGetIdentification(retries = 4) {
  let last = null;
  for (let i = 0; i < retries; i++) {
    inspCheckAbort();
    const waiter = inspWaitFrame((f) => f.cmd === 0x07 && f.payload[1] === 0x00 && f.payload.length >= 8, 700);
    await inspSend(inspBuildFrame([0x07, 0x00]), i === 0 ? 'GetIdentification' : `GetIdentification (retry ${i})`);
    const f = await waiter;
    if (f) {
      const v = f.payload;
      last = { sm: [v[2], v[3]], hmi: [v[4], v[5]], mc: [v[6], v[7]] };
      if (last.hmi[0] !== 0 && last.mc[0] !== 0) return last;
    }
    await inspSleep(300);
  }
  return last;
}

// GetIdentification D0=1..3 returns the serial number of the Service Module, the
// HMI and the Motor Controller. The response carries the number as ASCII with no
// terminator: AF [len] 07 [type] [characters] [checksum]. The HMI and Motor
// Controller numbers are fetched over the internal bus, so the first attempt can
// come back empty - retry, then give up and record it as unavailable.
async function inspGetSerialNumber(type, moduleName, retries = 3) {
  for (let i = 0; i < retries; i++) {
    inspCheckAbort();
    const waiter = inspWaitFrame((f) => f.cmd === 0x07 && f.payload[1] === type, 700);
    await inspSend(inspBuildFrame([0x07, type]),
                   i === 0 ? `GetIdentification D0=${type} (${moduleName} serial number)`
                           : `GetIdentification D0=${type} (retry ${i})`);
    const f = await waiter;
    if (f) {
      const text = Array.from(f.payload.slice(2))
        .filter((b) => b >= 0x20 && b <= 0x7E)
        .map((b) => String.fromCharCode(b))
        .join('')
        .trim();
      if (text) return text;
    }
    await inspSleep(200);
  }
  return '';
}

const inspVerStr = (pair) => (pair ? `${pair[0]}.${String(pair[1]).padStart(2, '0')}` : '-');

// ---- Stream control ------------------------------------------------------
function inspStartSendingData(dataSet, intervalMs, speedMode) {
  return [0x00, dataSet, (intervalMs >> 8) & 0xFF, intervalMs & 0xFF, speedMode];
}

async function inspStopStream(label) {
  await inspCommand([0x01], label);
  await inspSleep(200);
}

function inspParseDs0(payload) {
  return { mode: payload[1], params: Array.from(payload.slice(2, 11)) };
}

// Wait for Dataset0 of the given mode, skipping frames so the one taken is after the write.
function inspWaitDs0(mode, skip, timeoutMs) {
  return new Promise((resolve) => {
    let seen = 0;
    let off = () => {};
    const timer = setTimeout(() => { off(); resolve(null); }, timeoutMs);
    off = inspOnFrame((f) => {
      if (f.cmd !== 0x00 || f.payload.length < 11 || f.payload[1] !== mode) return;
      if (seen++ < skip) return;
      clearTimeout(timer);
      off();
      resolve(inspParseDs0(f.payload));
    });
  });
}

function inspParseDs1(payload) {
  const info = (n) => payload[1 + n];
  return {
    deviceLock: info(2), joystickPause: info(3), maxSpeedLevel: info(4),
    speedLevel: info(5), autoPowerOff: info(6),
    battery: info(14),
    rightKmh: inspS16(info(21), info(22)) * 0.004,
    leftKmh: inspS16(info(23), info(24)) * 0.004,
    speedModeIndicator: info(26), error: info(27),
  };
}

// Body speeds derived from the two motor speeds (the sign of the right motor
// is determined by measurement). Forward speed is the average of both wheels.
// A turn command (T_M1 / the X axis of SetVelocity) expresses the DIFFERENCE
// between the wheels, and each wheel turns at half that, so the observed turn
// speed is the difference itself - not halved.
// Measured: X=750 (3.0 km/h) gives 1.54 km/h per wheel, 3.08 km/h difference.
const inspFwdKmh  = (s) => (s.leftKmh + inspRightSign * s.rightKmh) / 2;
const inspTurnKmh = (s) => s.leftKmh - inspRightSign * s.rightKmh;

// Safety monitor, active for the whole inspection: aborts on an error code or a low battery.
function inspInstallSafetyMonitor() {
  return inspOnFrame((f) => {
    if (f.cmd !== 0x01 || f.payload.length < 30) return;
    const s = inspParseDs1(f.payload);
    if (s.error !== 0 && !INSP_IGNORED_ERRORS.includes(s.error) && !inspAbortReason) {
      inspAbortReason = `WHILL reported error code ${s.error}`;
    }
    if (s.battery > 0 && s.battery < INSP_MIN_BATTERY && !inspAbortReason) {
      inspAbortReason = `the battery level fell to ${s.battery}% (below ${INSP_MIN_BATTERY}%)`;
    }
  });
}

// ---- Power control -------------------------------------------------------
async function inspPowerOn(label) {
  const wait = INSP_POWER_WAIT_MS - (Date.now() - inspLastPowerOffAt);
  if (inspLastPowerOffAt && wait > 0) await inspSleep(wait);   // Power OFF -> ON needs more than 5 s
  let acked = false;
  for (let i = 0; i < 40 && !acked; i++) {
    inspCheckAbort();
    const waiter = inspWaitFrame((f) => f.cmd === 0x52, 200);
    await inspSend(inspBuildFrame([0x02, 0x01]), i === 0 ? (label || 'SetPower ON') : null);
    if (await waiter) acked = true;
  }
  await inspSleep(600);
  return { acked, settings: await inspGetSettings() };
}

async function inspPowerOff(label) {
  await inspCommand([0x02, 0x00], label || 'SetPower OFF');
  inspLastPowerOffAt = Date.now();
  await inspSleep(1200);
  return inspGetSettings();
}

// Wait until the wheels have actually stopped. A fixed wait would be wasted
// where the chair stops quickly, and too short where it does not - leaving
// residual rotation at the start of the next case - so the real speed from
// Dataset1 decides. With no Dataset1 there is nothing to judge on, so the
// full timeout is used (the safe side).
async function inspWaitUntilStopped(maxMs) {
  let latest = null;
  const off = inspOnFrame((f) => {
    if (f.cmd === 0x01 && f.payload.length >= 30) latest = inspParseDs1(f.payload);
  });
  const end = Date.now() + maxMs;
  try {
    let stoppedAt = 0;
    while (Date.now() < end) {
      inspCheckAbort();
      await inspRawSleep(60);
      if (!latest) continue;
      const speed = Math.max(Math.abs(latest.leftKmh), Math.abs(latest.rightKmh));
      if (speed > INSP_STOP_KMH) { stoppedAt = 0; continue; }
      if (!stoppedAt) stoppedAt = Date.now();
      if (Date.now() - stoppedAt >= INSP_STOP_HOLD_MS) return;
    }
  } finally {
    off();
  }
}

// ---- Motor command measurement -------------------------------------------
// Send the command every 60 ms for the drive time, then compare the peak
// speed over the last 2 s against the target speed.
async function inspDriveCase({ cmd, item, sent, payloadFn, targetKmh, kind, durationMs }) {
  const samples = [];
  const off = inspOnFrame((f) => {
    if (f.cmd === 0x01 && f.payload.length >= 30) {
      samples.push({ at: f.at, ...inspParseDs1(f.payload) });
    }
  });
  const duration = durationMs || INSP_DRIVE_MS;
  const t0 = Date.now();
  const end = t0 + duration;
  try {
    appendLog(`[${getJapanTimeString()}] [inspection] ${cmd} ${sent} for ${duration / 1000} s at ` +
              `${INSP_DRIVE_PERIOD_MS} ms intervals\n`);
    let k = 0;
    while (Date.now() < end) {
      inspCheckAbort();
      await inspSend(inspBuildFrame(payloadFn()), null);
      k++;
      const left = t0 + k * INSP_DRIVE_PERIOD_MS - Date.now();
      if (left > 0) await inspRawSleep(left);
    }
  } finally {
    off();
  }

  // Stop driving (SetJoystick U0=1 means "apply no value") and let the chair coast.
  for (let i = 0; i < 4; i++) {
    await inspSend(inspBuildFrame([0x03, 0x01, 0x00, 0x00]), null);
    await inspRawSleep(60);
  }

  const tail = samples.filter((s) => s.at >= end - INSP_PLATEAU_MS);
  const used = tail.length ? tail : samples;
  const values = used.map((s) => (kind === 'turn' ? inspTurnKmh(s) : inspFwdKmh(s)));
  const peak = values.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  let result, actual;
  if (!samples.length) {
    result = 'FAIL';
    actual = 'no Dataset1 received';
  } else if (Math.abs(targetKmh) < 1e-9) {
    result = inspJudge(Math.abs(peak) <= INSP_ZERO_KMH);
    actual = `peak ${peak.toFixed(3)} km/h / mean ${mean.toFixed(3)} km/h (${used.length} samples)`;
  } else {
    const err = (Math.abs(peak) - Math.abs(targetKmh)) / Math.abs(targetKmh);
    // The specification does not say which way a positive left/right input
    // turns the chair, so a turn is judged on magnitude only; the direction is
    // checked separately from the symmetry of the left / right pair.
    const dirOk = kind === 'turn'
      ? peak !== 0
      : (peak !== 0 && Math.sign(peak) === Math.sign(targetKmh));
    result = inspJudge(dirOk && Math.abs(err) <= INSP_SPEED_TOL);
    actual = `peak ${peak.toFixed(3)} km/h (error ${(err * 100).toFixed(1)}%) / mean ${mean.toFixed(3)} km/h` +
             (dirOk ? '' : ' / wrong direction');
  }

  inspAddResult({
    cmd, item, sent,
    expect: Math.abs(targetKmh) < 1e-9
      ? `within ${INSP_ZERO_KMH} km/h of zero`
      : `${kind === 'turn' ? `magnitude ${Math.abs(targetKmh).toFixed(3)}` : targetKmh.toFixed(3)} km/h ±5%`,
    actual, result,
  });
  await inspWaitUntilStopped(INSP_COOLDOWN_MS);
  return { peak, mean, result };
}

// Build the five test values: below range / minimum / middle / maximum /
// above range. Passing null as lowOut / highOut marks that case as "none".
// Light mode keeps the middle value and the above-range one, so both an accepted
// and a rejected value are still exercised.
function inspRangeValues(min, max, opts) {
  const o = opts || {};
  const lowOut = o.lowOut === undefined ? min - 1 : o.lowOut;
  const highOut = o.highOut === undefined ? max + 1 : o.highOut;
  const mid = o.mid === undefined ? Math.round((min + max) / 2) : o.mid;
  const values = [
    { label: 'below range', v: lowOut, inRange: false },
    { label: 'minimum', v: min, inRange: true },
    { label: 'middle', v: mid, inRange: true },
    { label: 'maximum', v: max, inRange: true },
    { label: 'above range', v: highOut, inRange: false },
  ];
  return inspLight ? values.filter((v) => v.label === 'middle' || v.label === 'above range') : values;
}

// The "1 acts, any other value does not" commands have no range, so they are
// exercised with these values instead.
function inspBooleanValues() {
  return inspLight ? [1, 0] : [0, 1, 2, 255];
}

// ---- Test definitions ----------------------------------------------------
// The 9 SetSpeedProfile parameters and their documented ranges.
const INSP_SP_PARAMS = [
  { idx: 0, short: 'F_M1', name: 'F_M1 forward max speed', min: 8,  max: 60  },
  { idx: 1, short: 'F_A1', name: 'F_A1 forward acceleration',   min: 10, max: 64  },
  { idx: 2, short: 'F_D1', name: 'F_D1 forward deceleration',   min: 40, max: 160 },
  { idx: 3, short: 'R_M1', name: 'R_M1 reverse max speed', min: 8,  max: 30  },
  { idx: 4, short: 'R_A1', name: 'R_A1 reverse acceleration',   min: 10, max: 50  },
  { idx: 5, short: 'R_D1', name: 'R_D1 reverse deceleration',   min: 40, max: 80  },
  { idx: 6, short: 'T_M1', name: 'T_M1 turn max speed', min: 8,  max: 35  },
  { idx: 7, short: 'T_A1', name: 'T_A1 turn acceleration',   min: 10, max: 60,
    // The specification says 60, but the effective limit in the firmware is 90
    // (SM 10-90 intersected with MC 10-100), so 61 is accepted. The two are
    // expected to be aligned later, so the above-range case is recorded but
    // not judged.
    skipHighOut: 'The specification says 60; the effective limit in the firmware is ' +
                 '90 (SM 10-90 intersected with MC 10-100). Known difference, not judged.' },
  { idx: 8, short: 'T_D1', name: 'T_D1 turn deceleration',   min: 40, max: 160 },
];
// Mid-point of every parameter range, used as the base that one test value is substituted into.
const INSP_SP_BASELINE = INSP_SP_PARAMS.map((p) => Math.round((p.min + p.max) / 2));
// Profile used for the motor tests (forward 3.0 / reverse 2.0 / turn 2.0 km/h).
const INSP_MOTOR_PROFILE = [30, 25, 56, 20, 25, 56, 20, 25, 56];
const INSP_SPEED_MODE = 4;           // the speed mode used for RS232C host control

let inspOriginalSettings = null;
let inspOriginalProfiles = [];
let inspProfilesRestored = false;

// ---- Legacy: the stages that cannot use GetSettings ------------------------
// A legacy chair has no GetIdentification, GetSettings or GetCapability, so there
// is nothing to read at the start - only a note of what is not being sent.
async function inspStageLegacyPrepare() {
  inspSetStatus('Running: preparation');
  inspAddStage('1. Preparation');
  inspSetModules([]);
  inspAddResult({
    cmd: '(setup)', item: 'Commands this chair does not have',
    sent: '-', expect: '-',
    actual: 'GetIdentification / GetSettings / GetCapability / SetSpeedLevel / SetMaxSpeedLevel / ' +
            'SetJoystickPause / SetAutoPowerOff / SetDeviceLock / SoundHorn are not sent',
    result: 'INFO',
  });
}

// Without GetSettings the proof that the chair is on is the power-on response plus
// the fact that state data is streamed only while the power is on.
async function inspStageLegacyPowerOn() {
  inspSetStatus('Running: SetPower ON');
  inspAddStage('4. SetPower (0x02) - power on');

  const wait = INSP_POWER_WAIT_MS - (Date.now() - inspLastPowerOffAt);
  if (inspLastPowerOffAt && wait > 0) await inspSleep(wait);
  let acked = false;
  for (let i = 0; i < 40 && !acked; i++) {
    inspCheckAbort();
    const waiter = inspWaitFrame((f) => f.cmd === 0x52, 200);
    await inspSend(inspBuildFrame([0x02, 0x01]), i === 0 ? 'SetPower P0=1' : null);
    if (await waiter) acked = true;
  }
  await inspSleep(600);

  const first = inspWaitFrame((f) => f.cmd === 0x01 && f.payload.length >= 30, 3000);
  await inspCommand(inspStartSendingData(1, INSP_DS1_INTERVAL_MS, INSP_SPEED_MODE),
                    `StartSendingData D0=1 ${INSP_DS1_INTERVAL_MS} ms (power check)`);
  const sample = await first;
  const streamed = await inspCountFrames(0x01, 800);
  await inspStopStream(null);

  inspAddResult({
    cmd: 'SetPower (0x02)', item: 'Power on and the power-on response (0x52)',
    sent: 'P0=1 (re-sent until the response arrives)',
    expect: '0x52 response received, and Dataset1 is streamed afterwards',
    actual: `0x52 response ${acked ? 'received' : 'missing'} / ` +
            `${streamed.count} Dataset1 frames in 800 ms`,
    result: inspJudge(acked && streamed.count > 0),
  });
  if (!streamed.count) {
    throw new Error('the chair does not power on; the inspection cannot continue');
  }

  if (sample) {
    const state = inspParseDs1(sample.payload);
    inspSetInfo('Battery level at start', `${state.battery}%`);
    inspAddResult({
      cmd: '(setup)', item: 'Check the battery level',
      sent: '-', expect: `${INSP_MIN_BATTERY}% or above`, actual: `${state.battery}%`,
      result: 'INFO',
    });
    if (state.battery > 0 && state.battery < INSP_MIN_BATTERY) {
      throw new Error(`the battery is at ${state.battery}%, so the inspection is stopped`);
    }
  }
}

async function inspStageLegacyPowerOff() {
  inspSetStatus('Running: SetPower OFF');
  inspAddStage('10. SetPower (0x02) - power off');

  await inspCommand(inspStartSendingData(1, INSP_DS1_INTERVAL_MS, INSP_SPEED_MODE), null);
  await inspSleep(400);
  await inspCommand([0x02, 0x00], 'SetPower P0=0');
  inspLastPowerOffAt = Date.now();
  await inspSleep(1200);
  const after = await inspCountFrames(0x01, 1200);
  await inspStopStream(null);

  inspAddResult({
    cmd: 'SetPower (0x02)', item: 'Power off',
    sent: 'P0=0',
    expect: 'the Dataset1 stream stops (state data is sent only while the power is on)',
    actual: `${after.count} Dataset1 frames in the 1200 ms after the command`,
    result: inspJudge(after.count === 0),
  });
}

// ---- 1. Preparation / device information ---------------------------------
async function inspStagePrepare() {
  inspSetStatus('Running: preparation / device information');
  inspAddStage('1. Preparation / device information');

  // GetIdentification is not a published command, so it is recorded but not judged.
  const ident = await inspGetIdentification();
  inspAddResult({
    cmd: 'GetIdentification (0x07)',
    item: 'Read the firmware version of each module',
    sent: 'D0=0x00',
    expect: 'not judged (recorded for reference only)',
    actual: ident
      ? `SM ${inspVerStr(ident.sm)} / HMI ${inspVerStr(ident.hmi)} / MC ${inspVerStr(ident.mc)}`
      : 'no response',
    result: 'INFO',
  });

  const serials = {
    sm: await inspGetSerialNumber(1, 'Service Module'),
    hmi: await inspGetSerialNumber(2, 'HMI'),
    mc: await inspGetSerialNumber(3, 'Motor Controller'),
  };
  inspAddResult({
    cmd: 'GetIdentification (0x07)',
    item: 'Read the serial number of each module',
    sent: 'D0=0x01 / 0x02 / 0x03',
    expect: 'not judged (recorded for reference only)',
    actual: `SM ${serials.sm || 'not available'} / HMI ${serials.hmi || 'not available'} / ` +
            `MC ${serials.mc || 'not available'}`,
    result: 'INFO',
  });

  inspSetModules([
    { name: 'Service Module', firmware: inspVerStr(ident && ident.sm), serial: serials.sm || '-' },
    { name: 'HMI', firmware: inspVerStr(ident && ident.hmi), serial: serials.hmi || '-' },
    { name: 'Motor Controller', firmware: inspVerStr(ident && ident.mc), serial: serials.mc || '-' },
  ]);

  // GetCapability (0x10)
  const cap = await inspGetCapability();
  const expCommands = [0x1F, 0xFF, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00];
  const expDataset1 = [0x7C, 0xFF, 0xFF, 0x1F];
  const capHex = (a) => a.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  if (!cap) {
    inspSetInfo('Serial API Version', '-');
    inspAddResult({
      cmd: 'GetCapability (0x10)', item: 'Read the published command / data bitmaps',
      sent: 'no parameter', expect: '0x10 response received', actual: 'no response', result: 'FAIL',
    });
  } else {
    const version = `${cap.major}.${cap.minor}`;
    inspSetInfo('Serial API Version', version);
    const known = cap.major === 1 && cap.minor === 1;
    const match = known &&
      expCommands.every((v, i) => cap.commands[i] === v) &&
      expDataset1.every((v, i) => cap.dataset1[i] === v);
    inspAddResult({
      cmd: 'GetCapability (0x10)', item: 'Read the published command / data bitmaps',
      sent: 'no parameter',
      expect: known
        ? `Version 1.1 / commands ${capHex(expCommands)} / dataset1 ${capHex(expDataset1)}`
        : 'not Serial API 1.1 (no expected value defined)',
      actual: `Version ${version} / commands ${capHex(cap.commands)} / dataset1 ${capHex(cap.dataset1)}`,
      result: known ? inspJudge(match) : 'INFO',
    });
  }

  // GetSettings (0x0F) - this also saves the settings the chair had before the inspection.
  const st = await inspGetSettings();
  inspOriginalSettings = st;
  const inRange = st && st.fields.length >= 6 &&
    st.deviceLock <= 1 && st.joystickPause <= 1 &&
    st.maxSpeedLevel >= 1 && st.maxSpeedLevel <= 4 &&
    st.speedLevel >= 1 && st.speedLevel <= 4 &&
    st.autoPowerOff <= 1 && st.powerOn <= 1;
  inspAddResult({
    cmd: 'GetSettings (0x0F)', item: 'Read every setting in one request',
    sent: 'no parameter',
    expect: '0x0F response received, 6 fields within their documented ranges',
    actual: st
      ? `Lock=${st.deviceLock} Pause=${st.joystickPause} MaxLv=${st.maxSpeedLevel} ` +
        `Lv=${st.speedLevel} AutoOff=${st.autoPowerOff} Power=${st.powerOn}`
      : 'no response',
    result: inspJudge(!!inRange),
  });
  if (st) {
    inspSetInfo('Settings before the inspection', `Lock=${st.deviceLock} Pause=${st.joystickPause} ` +
      `MaxLv=${st.maxSpeedLevel} Lv=${st.speedLevel} AutoOff=${st.autoPowerOff}`);
  }
}

// ---- 2. SoundHorn (needs a person, so it runs first) ----------------------
async function inspStageHorn() {
  inspSetStatus('Running: SoundHorn (listen and confirm)');
  inspAddStage('2. SoundHorn (0x0D) - confirmed by ear');

  await inspCommand([0x0D, 0x01], 'SoundHorn D0=1');
  await inspSleep(1200);
  const rang = window.confirm(
    'SoundHorn (D0=1) has been sent.\n\nDid the horn sound?\n\n' +
    '[OK] = it sounded (PASS)   [Cancel] = it stayed silent (FAIL)');
  inspAddResult({
    cmd: 'SoundHorn (0x0D)', item: 'The horn sounds (confirmed by ear)',
    sent: 'D0=1', expect: 'the horn sounds', actual: rang ? 'sounded' : 'stayed silent',
    result: inspJudge(rang),
  });

  if (inspLight) return;   // one dialog is enough for a light inspection

  for (const v of [0, 2, 255]) {
    await inspCommand([0x0D, v], `SoundHorn D0=${v}`);
    await inspSleep(1200);
  }
  const silent = window.confirm(
    'SoundHorn has been sent with D0=0 / 2 / 255.\n\nDid the horn stay silent every time?\n\n' +
    '[OK] = it stayed silent (PASS)   [Cancel] = it sounded (FAIL)');
  inspAddResult({
    cmd: 'SoundHorn (0x0D)', item: 'Values other than 1 do not sound the horn (confirmed by ear)',
    sent: 'D0=0 / 2 / 255', expect: 'the horn stays silent for all of them',
    actual: silent ? 'stayed silent' : 'sounded', result: inspJudge(silent),
  });
  inspAddResult({
    cmd: 'SoundHorn (0x0D)', item: 'Below range / middle value',
    sent: '-', expect: '-',
    actual: 'D0 is boolean (1 acts, any other value is ignored), so the five-value range test does not apply',
    result: 'SKIP',
  });
}

// ---- 3. Commands that need the power off (SetSpeedLevel) -----------------
async function inspStagePowerOffCommands() {
  inspSetStatus('Running: SetSpeedLevel (power off)');
  inspAddStage('3. SetSpeedLevel (0x0C) - effective only while the power is off');

  let st = await inspGetSettings();
  if (st && st.powerOn === 1) {
    st = await inspPowerOff('SetPower OFF (for the SetSpeedLevel test)');
    inspAddResult({
      cmd: '(setup)', item: 'Turn the power off for the SetSpeedLevel test',
      sent: 'SetPower P0=0', expect: 'POWER_ON=0',
      actual: st ? `POWER_ON=${st.powerOn}` : 'no response', result: 'INFO',
    });
  }
  if (!st) {
    inspAddResult({
      cmd: 'SetSpeedLevel (0x0C)', item: 'Read the settings before the test',
      sent: 'GetSettings', expect: 'a response', actual: 'no response', result: 'FAIL',
    });
    return;
  }

  let current = st.speedLevel;
  for (const tv of inspRangeValues(1, 4)) {
    const after = await inspSetAndRead([0x0C, tv.v & 0xFF], `SetSpeedLevel S0=${tv.v}`, 600);
    const expected = tv.inRange ? tv.v : current;
    const ok = !!after && after.speedLevel === expected;
    inspAddResult({
      cmd: 'SetSpeedLevel (0x0C)', item: `Speed level, ${tv.label}`,
      sent: `S0=${tv.v}`,
      expect: tv.inRange ? `SPEED_LEVEL=${expected}` : `out of range is rejected, SPEED_LEVEL stays ${expected}`,
      actual: after ? `SPEED_LEVEL=${after.speedLevel}` : 'GetSettings: no response',
      result: inspJudge(ok),
    });
    if (after) current = after.speedLevel;
  }
}

// ---- 4. SetPower ON ------------------------------------------------------
async function inspStagePowerOn() {
  inspSetStatus('Running: SetPower ON');
  inspAddStage('4. SetPower (0x02) - power on');

  const on = await inspPowerOn('SetPower P0=1');
  inspAddResult({
    cmd: 'SetPower (0x02)', item: 'Power on and the power-on response (0x52)',
    sent: 'P0=1 (re-sent until the response arrives)',
    expect: '0x52 response received, POWER_ON=1',
    actual: `0x52 response ${on.acked ? 'received' : 'missing'} / ` +
            `POWER_ON=${on.settings ? on.settings.powerOn : 'no response'}`,
    result: inspJudge(on.acked && !!on.settings && on.settings.powerOn === 1),
  });
  if (!(on.settings && on.settings.powerOn === 1)) {
    throw new Error('the chair does not power on; the inspection cannot continue');
  }

  // The inspection takes minutes, so disable auto power off (0x0E itself is tested later).
  await inspCommand([0x0E, 0x00], 'SetAutoPowerOff D0=0 (disable auto power off during the inspection)');
  inspAddResult({
    cmd: '(setup)', item: 'Disable auto power off for the duration of the inspection',
    sent: 'SetAutoPowerOff D0=0', expect: '-', actual: 'sent', result: 'INFO',
  });

  // Check the battery level (stream Dataset1 briefly).
  const waiter = inspWaitFrame((f) => f.cmd === 0x01 && f.payload.length >= 30, 3000);
  await inspCommand(inspStartSendingData(1, INSP_DS1_INTERVAL_MS, INSP_SPEED_MODE),
                    'StartSendingData D0=1 100 ms (battery check)');
  const f = await waiter;
  await inspStopStream(null);
  if (f) {
    const s = inspParseDs1(f.payload);
    inspSetInfo('Battery level at start', `${s.battery}%`);
    inspAddResult({
      cmd: '(setup)', item: 'Check the battery level',
      sent: '-', expect: `${INSP_MIN_BATTERY}% or above`, actual: `${s.battery}%`,
      result: 'INFO',
    });
    if (s.battery > 0 && s.battery < INSP_MIN_BATTERY) {
      throw new Error(`the battery is at ${s.battery}%, so the inspection is stopped`);
    }
  }
}

// ---- 5. StartSendingData / StopSendingData -------------------------------
// Count frames with the given command id over windowMs.
async function inspCountFrames(cmdId, windowMs) {
  let count = 0, first = 0, last = 0;
  const off = inspOnFrame((f) => {
    if (f.cmd !== cmdId) return;
    if (!count) first = f.at;
    last = f.at;
    count++;
  });
  try {
    await inspSleep(windowMs);
  } finally {
    off();
  }
  return { count, interval: count > 1 ? (last - first) / (count - 1) : null };
}

async function inspStageStreaming() {
  inspSetStatus('Running: StartSendingData / StopSendingData');
  inspAddStage('5. StartSendingData (0x00) / StopSendingData (0x01)');

  // Send intervals of 10 / 100 / 1000 ms
  for (const interval of (inspLight ? [100] : [10, 100, 1000])) {
    await inspStopStream(null);
    const windowMs = interval >= 1000 ? 6000 : 2000;
    await inspCommand(inspStartSendingData(1, interval, INSP_SPEED_MODE),
                      `StartSendingData D0=1 T=${interval}ms S0=${INSP_SPEED_MODE}`);
    const r = await inspCountFrames(0x01, windowMs);
    // A 33-byte frame takes about 9.5 ms at 38400 bps 8N2, so a 10 ms request is
    // right at the line rate. Short intervals carry a larger relative error,
    // so allow at least 4 ms of tolerance.
    const tol = Math.max(interval * 0.2, 4);
    const ok = r.interval !== null && Math.abs(r.interval - interval) <= tol;
    inspAddResult({
      cmd: 'StartSendingData (0x00)', item: `Dataset1 send interval ${interval} ms`,
      sent: `D0=1 T=${interval} S0=${INSP_SPEED_MODE}`,
      expect: `measured interval ${interval} ms +/-${Math.round(tol)} ms`,
      actual: r.interval === null
        ? `${r.count} frames in ${windowMs} ms (interval not measurable)`
        : `${r.interval.toFixed(1)} ms (${r.count} frames in ${windowMs} ms)`,
      result: inspJudge(ok),
    });
  }

  // Data set number 0 (the speed profile)
  await inspStopStream(null);
  const ds0 = inspWaitDs0(INSP_SPEED_MODE, 0, 3000);
  await inspCommand(inspStartSendingData(0, 100, INSP_SPEED_MODE),
                    `StartSendingData D0=0 T=100ms S0=${INSP_SPEED_MODE}`);
  const got0 = await ds0;
  inspAddResult({
    cmd: 'StartSendingData (0x00)', item: 'Selecting data set number 0 (the minimum)',
    sent: `D0=0 S0=${INSP_SPEED_MODE}`,
    expect: `Dataset0 for speed mode ${INSP_SPEED_MODE} is received`,
    actual: got0 ? `Dataset0 mode=${got0.mode} / ${got0.params.join(' ')}` : 'no Dataset0 received',
    result: inspJudge(!!got0),
  });

  // An out-of-range value discards the whole command, leaving the previous stream in place.
  const badCases = [
    { label: 'Data set number, above range', payload: [2, 100, INSP_SPEED_MODE], sent: 'D0=2' },
    { label: 'Send interval, below range', payload: [1, 5, INSP_SPEED_MODE], sent: 'T=5 ms (below the 10 ms minimum)', light: true },
    { label: 'Speed mode, above range', payload: [1, 100, 6], sent: 'S0=6 (range 0-5)' },
  ];
  for (const bc of (inspLight ? badCases.filter((c) => c.light) : badCases)) {
    await inspStopStream(null);
    await inspCommand(inspStartSendingData(1, 100, INSP_SPEED_MODE), null);
    await inspSleep(300);
    await inspCommand(inspStartSendingData(bc.payload[0], bc.payload[1], bc.payload[2]),
                      `StartSendingData ${bc.sent} (out of range)`);
    const r = await inspCountFrames(0x01, 1500);
    const ok = r.interval !== null && Math.abs(r.interval - 100) <= 20;
    inspAddResult({
      cmd: 'StartSendingData (0x00)', item: bc.label,
      sent: bc.sent,
      expect: 'the whole command is discarded and the previous Dataset1 100 ms stream continues',
      actual: r.interval === null
        ? `${r.count} frames in 1500 ms`
        : `Dataset1 ${r.interval.toFixed(1)} ms (${r.count} frames)`,
      result: inspJudge(ok),
    });
  }
  inspAddResult({
    cmd: 'StartSendingData (0x00)', item: 'Data set number / speed mode below range, send interval above range',
    sent: '-', expect: '-',
    actual: 'D0 and S0 have a lower bound of 0 and the send interval has no documented upper bound, so there is no such value',
    result: 'SKIP',
  });

  // StopSendingData
  await inspCommand([0x01], 'StopSendingData');
  await inspSleep(300);
  const after = await inspCountFrames(0x01, 1200);
  inspAddResult({
    cmd: 'StopSendingData (0x01)', item: 'Stopping the periodic transmission',
    sent: 'no parameter', expect: 'no Dataset1 frame arrives for 1200 ms',
    actual: `${after.count} frames`, result: inspJudge(after.count === 0),
  });
}

// ---- 6. SetSpeedProfile --------------------------------------------------
// Build the value written by the S1 test: this mode's current values with one
// parameter moved by one. The upper limits differ per speed mode (the Motor
// Controller holds a per-mode table) and some modes already sit at their
// ceiling - the BLE profile's 20 24 72 ... IS its upper limit. The lower
// limits are common to every mode, so the value is moved DOWN, which stays in
// range whatever the mode.
function inspNudgeProfile(base) {
  const p = base.slice();
  const fd = INSP_SP_PARAMS[2];                           // F_D1 (forward deceleration)
  p[2] = p[2] > fd.min ? p[2] - 1 : p[2] + 1;
  return p;
}

// Restart the stream on the given speed mode and read one Dataset0 frame.
async function inspReadProfile(mode) {
  const waiter = inspWaitDs0(mode, 0, 3000);
  await inspCommand(inspStartSendingData(0, 100, mode), null);
  return waiter;
}

async function inspStageSpeedProfile() {
  inspSetStatus('Running: SetSpeedProfile');
  inspAddStage('6. SetSpeedProfile (0x04)');

  // The inspection overwrites these, so save the current profile of every speed mode.
  inspOriginalProfiles = [];
  for (let mode = 0; mode <= 5; mode++) {
    const p = await inspReadProfile(mode);
    inspOriginalProfiles[mode] = p ? p.params : null;
  }
  const savedCount = inspOriginalProfiles.filter(Boolean).length;
  inspAddResult({
    cmd: '(setup)', item: 'Save the current profile of every speed mode',
    sent: 'StartSendingData D0=0 × 6', expect: 'all 6 modes read',
    actual: `${savedCount} of 6 modes saved`,
    result: savedCount === 6 ? 'INFO' : 'FAIL',
  });

  // S1 (speed mode) test. The parameter ranges themselves are covered on speed
  // mode 4, so this only checks that the mode named by S1 - and only that mode -
  // is written. Each mode is written its own current values with F_D1 moved by
  // one, so the per-mode limits are never touched.
  let lastS1Profile = null;      // last profile actually read, used as the reference for the out-of-range case
  for (const tv of inspRangeValues(0, 5, { lowOut: null })) {
    if (tv.v === null) {
      inspAddResult({
        cmd: 'SetSpeedProfile (0x04)', item: 'Speed mode S1, below range',
        sent: '-', expect: '-', actual: 'S1 has a lower bound of 0, so there is no below-range value', result: 'SKIP',
      });
      continue;
    }
    const own = inspOriginalProfiles[tv.inRange ? tv.v : 5];
    if (!own) {
      inspAddResult({
        cmd: 'SetSpeedProfile (0x04)', item: `Speed mode S1, ${tv.label}`,
        sent: `S1=${tv.v}`, expect: 'the current profile of the mode has been saved',
        actual: 'the profile could not be saved, so this case cannot be tested', result: 'FAIL',
      });
      continue;
    }
    const target = inspNudgeProfile(own);
    if (tv.inRange) {
      // The Motor Controller stores the profile through a CAN handshake (two
      // RESERVE frames plus a STORE), which can drop a write. Re-send once if
      // the value did not land, and record which attempt succeeded.
      let back = null, ok = false, retried = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        retried = attempt > 0;
        await inspCommand([0x04, tv.v, ...target],
                          `SetSpeedProfile S1=${tv.v} F_D1 ${own[2]} -> ${target[2]}` +
                          (retried ? ' (retry)' : ''));
        await inspSleep(INSP_PROFILE_SETTLE_MS);
        back = await inspReadProfile(tv.v);
        ok = !!back && target.every((v, i) => back.params[i] === v);
      }
      if (back) lastS1Profile = { mode: back.mode, params: back.params.slice() };
      inspAddResult({
        cmd: 'SetSpeedProfile (0x04)', item: `Speed mode S1, ${tv.label}`,
        sent: `S1=${tv.v} / F_D1 of that mode's own values, ${own[2]} -> ${target[2]}`,
        expect: `Dataset0 mode=${tv.v} reads ${target.join(' ')}`,
        actual: (back ? `mode=${back.mode} / ${back.params.join(' ')}` : 'no Dataset0 received') +
                (ok && retried ? ' / not applied on the first attempt, applied after a re-send' : ''),
        result: inspJudge(ok),
      });
    } else {
      // The stream stays on the mode read last: its values must not change and no mode 6 may appear.
      const seen = [];
      const off = inspOnFrame((f) => {
        if (f.cmd === 0x00 && f.payload.length >= 11) seen.push(inspParseDs0(f.payload));
      });
      await inspCommand([0x04, tv.v, ...target], `SetSpeedProfile S1=${tv.v} (out of range)`);
      await inspSleep(1500);
      off();
      const ref = lastS1Profile;
      const ok = seen.length > 0 && !!ref && seen.every((p) => p.mode === ref.mode &&
        ref.params.every((v, i) => p.params[i] === v));
      inspAddResult({
        cmd: 'SetSpeedProfile (0x04)', item: `Speed mode S1, ${tv.label}`,
        sent: `S1=${tv.v}`,
        expect: ref
          ? `the whole command is discarded and mode ${ref.mode} stays at ${ref.params.join(' ')}`
          : 'the whole command is discarded and no Dataset0 for mode 6 appears',
        actual: seen.length
          ? `Dataset0 mode=${[...new Set(seen.map((p) => p.mode))].join(',')} / ` +
            `${seen[seen.length - 1].params.join(' ')} (${seen.length} frames)`
          : 'no Dataset0 received',
        result: inspJudge(ok),
      });
    }
  }

  // 9 parameters x 5 values. The stream stays on Dataset0 of the mode under test.
  await inspCommand(inspStartSendingData(0, 100, INSP_SPEED_MODE),
                    `StartSendingData D0=0 S0=${INSP_SPEED_MODE} (for read-back)`);
  let current = INSP_SP_BASELINE.slice();
  await inspCommand([0x04, INSP_SPEED_MODE, ...current], `SetSpeedProfile mode${INSP_SPEED_MODE} baseline`);
  await inspSleep(INSP_PROFILE_SETTLE_MS);

  for (const p of (inspLight ? INSP_SP_PARAMS.slice(0, 1) : INSP_SP_PARAMS)) {
    inspSetStatus(`Running: SetSpeedProfile ${p.short}`);
    for (const tv of inspRangeValues(p.min, p.max)) {
      if (!tv.inRange && tv.v > p.max && p.skipHighOut) {
        inspAddResult({
          cmd: 'SetSpeedProfile (0x04)', item: `${p.name} ${tv.label}`,
          sent: '-', expect: '-', actual: p.skipHighOut, result: 'SKIP',
        });
        continue;
      }
      const attempt = current.slice();
      attempt[p.idx] = tv.v;
      await inspCommand([0x04, INSP_SPEED_MODE, ...attempt], null);
      await inspSleep(INSP_PROFILE_SETTLE_MS);          // let the write land before reading it back
      const back = await inspWaitDs0(INSP_SPEED_MODE, 0, 3000);
      const expected = tv.inRange ? attempt : current;
      const ok = !!back && expected.every((v, i) => back.params[i] === v);
      inspAddResult({
        cmd: 'SetSpeedProfile (0x04)', item: `${p.name} ${tv.label}`,
        sent: `${p.short}=${tv.v} (range ${p.min}-${p.max})`,
        expect: tv.inRange
          ? `Dataset0 ${p.short}=${tv.v}`
          : `the whole command is discarded, ${p.short} stays ${current[p.idx]}`,
        actual: back ? `${p.short}=${back.params[p.idx]} / ${back.params.join(' ')}` : 'no Dataset0 received',
        result: inspJudge(ok),
      });
      // Build and judge the next case from what the chair actually holds now,
      // so that one unexpected accept / reject does not drag the following
      // cases down with it.
      if (back) current = back.params.slice();
    }
  }

  // Switch to the profile used for the motor tests.
  await inspCommand([0x04, INSP_SPEED_MODE, ...INSP_MOTOR_PROFILE],
                    `SetSpeedProfile mode${INSP_SPEED_MODE} for the motor tests`);
  await inspSleep(INSP_PROFILE_SETTLE_MS);
  const back = await inspWaitDs0(INSP_SPEED_MODE, 0, 3000);
  inspAddResult({
    cmd: '(setup)', item: 'Set the profile used for the motor tests',
    sent: `mode${INSP_SPEED_MODE} = ${INSP_MOTOR_PROFILE.join(' ')}`,
    expect: `forward ${(INSP_MOTOR_PROFILE[0] * 0.1).toFixed(1)} / reverse ${(INSP_MOTOR_PROFILE[3] * 0.1).toFixed(1)} / turn ${(INSP_MOTOR_PROFILE[6] * 0.1).toFixed(1)} km/h`,
    actual: back ? back.params.join(' ') : 'no Dataset0 received',
    result: back && INSP_MOTOR_PROFILE.every((v, i) => back.params[i] === v) ? 'INFO' : 'FAIL',
  });
  await inspStopStream(null);
}

// ---- 7. Motor control (SetJoystick / SetVelocity) ------------------------
async function inspStageMotor() {
  inspSetStatus('Running: motor commands');
  inspAddStage('7. SetJoystick (0x03) / SetVelocity (0x08) - motor control');

  // Raise the max speed level to 4 first, so nothing caps the measured speed.
  if (!inspLegacy) {   // SetMaxSpeedLevel does not exist on a legacy chair
    await inspCommand([0x0B, 0x04], 'SetMaxSpeedLevel S0=4 (setup before measuring)');
  }
  await inspCommand(inspStartSendingData(1, INSP_DS1_INTERVAL_MS, INSP_SPEED_MODE),
                    `StartSendingData D0=1 ${INSP_DS1_INTERVAL_MS} ms (for speed measurement)`);

  // Determine the sign convention by measurement (same or opposite sign when driving forward).
  const samples = [];
  const off = inspOnFrame((f) => {
    if (f.cmd === 0x01 && f.payload.length >= 30) samples.push({ at: f.at, ...inspParseDs1(f.payload) });
  });
  const t0 = Date.now();
  try {
    let k = 0;
    while (Date.now() < t0 + 2500) {
      inspCheckAbort();
      await inspSend(inspBuildFrame([0x08, 0x00, 0x01, 0xF4, 0x00, 0x00]), null);  // 2.0 km/h forward
      k++;
      const left = t0 + k * INSP_DRIVE_PERIOD_MS - Date.now();
      if (left > 0) await inspRawSleep(left);
    }
  } finally {
    off();
  }
  for (let i = 0; i < 4; i++) {
    await inspSend(inspBuildFrame([0x03, 0x01, 0x00, 0x00]), null);
    await inspRawSleep(60);
  }
  const tail = samples.filter((s) => s.at >= t0 + 1500);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const mR = avg(tail.map((s) => s.rightKmh));
  const mL = avg(tail.map((s) => s.leftKmh));
  if (Math.abs(mR) < 0.05 && Math.abs(mL) < 0.05) {
    throw new Error('the motors do not turn on SetVelocity (check the jack-up, the power and the device lock)');
  }
  inspRightSign = mR * mL >= 0 ? 1 : -1;
  inspAddResult({
    cmd: '(setup)', item: 'Determine the sign convention of the two motor speeds',
    sent: 'SetVelocity Y=500 (2.0 km/h forward) for 2.5 s',
    expect: 'forward = (left + sign x right) / 2, turn = left - sign x right',
    actual: `right ${mR.toFixed(3)} / left ${mL.toFixed(3)} km/h -> right sign ${inspRightSign > 0 ? '+1 (same sign)' : '-1 (opposite sign)'}`,
    result: 'INFO',
  });
  await inspWaitUntilStopped(INSP_COOLDOWN_MS);

  const fwdMax = INSP_MOTOR_PROFILE[0] * 0.1;
  const revMax = INSP_MOTOR_PROFILE[3] * 0.1;
  const turnMax = INSP_MOTOR_PROFILE[6] * 0.1;

  // --- SetJoystick (no middle value: the specification defines no target speed for it) ---
  const joyCases = [
    { label: 'Forward/backward, below range', fb: -128, lr: 0, target: -revMax, kind: 'fwd', note: 'limited to -100, reverse max speed' },
    { label: 'Forward/backward, minimum',       fb: -100, lr: 0, target: -revMax, kind: 'fwd', note: 'reverse max speed', light: true },
    { label: 'Forward/backward, maximum',       fb:  100, lr: 0, target:  fwdMax, kind: 'fwd', note: 'forward max speed', light: true },
    { label: 'Forward/backward, above range', fb:  127, lr: 0, target:  fwdMax, kind: 'fwd', note: 'limited to +100, forward max speed' },
    { label: 'Left/right, below range', fb: 0, lr: -128, target: turnMax, kind: 'turn', note: 'limited to -100, turn max speed' },
    { label: 'Left/right, minimum',       fb: 0, lr: -100, target: turnMax, kind: 'turn', note: 'turn max speed' },
    { label: 'Left/right, maximum',       fb: 0, lr:  100, target: turnMax, kind: 'turn', note: 'turn max speed' },
    { label: 'Left/right, above range', fb: 0, lr:  127, target: turnMax, kind: 'turn', note: 'limited to +100, turn max speed' },
  ];
  const joyPeaks = {};
  for (const c of (inspLight ? joyCases.filter((c) => c.light) : joyCases)) {
    joyPeaks[c.label] = await inspDriveCase({
      cmd: 'SetJoystick (0x03)',
      item: `${c.label} (${c.note})`,
      sent: `U0=0 FB0=${c.fb} LR0=${c.lr}`,
      payloadFn: () => [0x03, 0x00, c.fb & 0xFF, c.lr & 0xFF],
      targetKmh: c.target, kind: c.kind,
    });
  }
  if (!inspLight) {
    inspAddSymmetryResult('SetJoystick (0x03)', 'LR0=-100 / +100',
                          joyPeaks['Left/right, minimum'], joyPeaks['Left/right, maximum']);
  }
  inspAddResult({
    cmd: 'SetJoystick (0x03)', item: 'Forward/backward and left/right, middle value',
    sent: '-', expect: '-',
    actual: 'the specification does not define how a joystick value maps to a speed, so middle values are out of scope',
    result: 'SKIP',
  });

  // --- SetVelocity (the commanded value IS the target speed) ---
  const velY = [
    { label: 'Forward/backward, below range', v: -600, eff: -500 },
    { label: 'Forward/backward, minimum',       v: -500, eff: -500, light: true },
    { label: 'Forward/backward, middle',       v:  500, eff:  500 },
    { label: 'Forward/backward, maximum',       v: 1500, eff: 1500, light: true },
    { label: 'Forward/backward, above range', v: 1600, eff: 1500 },
  ];
  for (const c of (inspLight ? velY.filter((c) => c.light) : velY)) {
    const y = c.v & 0xFFFF;
    await inspDriveCase({
      cmd: 'SetVelocity (0x08)',
      item: `${c.label} (range -500 to 1500, unit 0.004 km/h)`,
      sent: `U0=0 Y=${c.v}${c.v !== c.eff ? ` -> limited to ${c.eff}` : ''} X=0`,
      payloadFn: () => [0x08, 0x00, (y >> 8) & 0xFF, y & 0xFF, 0x00, 0x00],
      targetKmh: c.eff * 0.004, kind: 'fwd',
    });
  }
  const velX = [
    { label: 'Left/right, below range', v: -800, eff: -750 },
    { label: 'Left/right, minimum',       v: -750, eff: -750 },
    { label: 'Left/right, middle',       v:    0, eff:    0 },
    { label: 'Left/right, maximum',       v:  750, eff:  750, light: true },
    { label: 'Left/right, above range', v:  800, eff:  750 },
  ];
  const velXPeaks = {};
  for (const c of (inspLight ? velX.filter((c) => c.light) : velX)) {
    const x = c.v & 0xFFFF;
    velXPeaks[c.label] = await inspDriveCase({
      cmd: 'SetVelocity (0x08)',
      item: `${c.label} (range -750 to 750, unit 0.004 km/h)`,
      sent: `U0=0 Y=0 X=${c.v}${c.v !== c.eff ? ` -> limited to ${c.eff}` : ''}`,
      payloadFn: () => [0x08, 0x00, 0x00, 0x00, (x >> 8) & 0xFF, x & 0xFF],
      targetKmh: Math.abs(c.eff) * 0.004, kind: 'turn',
    });
  }
  if (!inspLight) {
    inspAddSymmetryResult('SetVelocity (0x08)', 'X=-750 / +750',
                          velXPeaks['Left/right, minimum'], velXPeaks['Left/right, maximum']);
  }
}

// Confirm from a left / right pair of turn cases that the direction reverses.
function inspAddSymmetryResult(cmd, sent, negative, positive) {
  const ok = !!negative && !!positive && negative.peak * positive.peak < 0;
  inspAddResult({
    cmd, item: 'A positive and a negative input turn the chair opposite ways', sent,
    expect: 'the turn speed changes sign',
    actual: negative && positive
      ? `${negative.peak.toFixed(3)} km/h / ${positive.peak.toFixed(3)} km/h`
      : 'not measured',
    result: inspJudge(ok),
  });
}

// ---- 8. Setting commands that need the power on --------------------------
async function inspStagePowerOnSettings() {
  inspSetStatus('Running: SetJoystickPause / SetMaxSpeedLevel / SetAutoPowerOff');
  inspAddStage('8. SetJoystickPause (0x0A) / SetMaxSpeedLevel (0x0B) / SetAutoPowerOff (0x0E)');

  // SetJoystickPause - the flag itself
  for (const v of inspBooleanValues()) {
    const st = await inspSetAndRead([0x0A, v], `SetJoystickPause D0=${v}`, 500);
    const expected = v === 1 ? 1 : 0;
    inspAddResult({
      cmd: 'SetJoystickPause (0x0A)', item: `Pause state D0=${v}${v === 1 ? ' (pause)' : ' (resume)'}`,
      sent: `D0=${v}`, expect: `JOYSTICK_PAUSE=${expected}`,
      actual: st ? `JOYSTICK_PAUSE=${st.joystickPause}` : 'GetSettings: no response',
      result: inspJudge(!!st && st.joystickPause === expected),
    });
  }
  inspAddResult({
    cmd: 'SetJoystickPause (0x0A)', item: 'Below range / middle value',
    sent: '-', expect: '-',
    actual: 'D0 is boolean (1 pauses, any other value resumes), so the five-value range test does not apply',
    result: 'SKIP',
  });

  // SetJoystickPause - SetJoystick must not drive while paused. This costs two
  // drives, so a light inspection checks the flag only.
  if (!inspLight) {
    const fwdMax = INSP_MOTOR_PROFILE[0] * 0.1;
    await inspSetAndRead([0x0A, 1], 'SetJoystickPause D0=1 (behaviour check)', 500);
    await inspDriveCase({
      cmd: 'SetJoystickPause (0x0A)', item: 'SetJoystick has no effect while paused',
      sent: 'D0=1 → SetJoystick FB0=100',
      payloadFn: () => [0x03, 0x00, 100, 0x00],
      targetKmh: 0, kind: 'fwd', durationMs: 3000,
    });
    await inspSetAndRead([0x0A, 0], 'SetJoystickPause D0=0 (resume)', 500);
    await inspDriveCase({
      cmd: 'SetJoystickPause (0x0A)', item: 'SetJoystick works again after resuming',
      sent: 'D0=0 → SetJoystick FB0=100',
      payloadFn: () => [0x03, 0x00, 100, 0x00],
      targetKmh: fwdMax, kind: 'fwd',
    });
  }

  // SetMaxSpeedLevel - out-of-range values are clamped into 1-4
  for (const tv of inspRangeValues(1, 4)) {
    const expected = Math.min(4, Math.max(1, tv.v));
    const st = await inspSetAndRead([0x0B, tv.v & 0xFF], `SetMaxSpeedLevel S0=${tv.v}`, 500);
    inspAddResult({
      cmd: 'SetMaxSpeedLevel (0x0B)', item: `Max speed level, ${tv.label}`,
      sent: `S0=${tv.v}`,
      expect: tv.inRange ? `MAX_SPEED_LEVEL=${expected}` : `clamped into 1-4, MAX_SPEED_LEVEL=${expected}`,
      actual: st ? `MAX_SPEED_LEVEL=${st.maxSpeedLevel}` : 'GetSettings: no response',
      result: inspJudge(!!st && st.maxSpeedLevel === expected),
    });
  }

  // SetAutoPowerOff
  for (const v of inspBooleanValues()) {
    const expected = v === 1 ? 1 : 0;
    const st = await inspSetAndRead([0x0E, v], `SetAutoPowerOff D0=${v}`, 500);
    inspAddResult({
      cmd: 'SetAutoPowerOff (0x0E)', item: `Auto power off D0=${v}${v === 1 ? ' (enabled)' : ' (disabled)'}`,
      sent: `D0=${v}`, expect: `AUTO_POWER_OFF=${expected}`,
      actual: st ? `AUTO_POWER_OFF=${st.autoPowerOff}` : 'GetSettings: no response',
      result: inspJudge(!!st && st.autoPowerOff === expected),
    });
  }
  inspAddResult({
    cmd: 'SetAutoPowerOff (0x0E)', item: 'Below range / middle value, and auto power off in practice',
    sent: '-', expect: '-',
    actual: 'D0 is boolean, so the range test does not apply. Auto power off itself takes too long to leave idle, so it is out of scope for an automatic inspection',
    result: 'SKIP',
  });
  // Keep auto power off disabled for the rest of the inspection.
  await inspCommand([0x0E, 0x00], 'SetAutoPowerOff D0=0 (re-applied so the inspection can continue)');
}

// ---- 9. Restore the saved speed profiles ---------------------------------
async function inspRestoreProfiles(verify) {
  if (inspProfilesRestored || !inspOriginalProfiles.length) return;
  inspAddStage('9. Restore the speed profiles');
  if (verify) {
    await inspCommand(inspStartSendingData(0, 100, INSP_SPEED_MODE), null);
  }
  let restored = 0, failed = 0;
  for (let mode = 0; mode <= 5; mode++) {
    const p = inspOriginalProfiles[mode];
    if (!p) continue;
    await inspCommand([0x04, mode, ...p], `SetSpeedProfile mode${mode} restore`);
    await inspSleep(INSP_PROFILE_SETTLE_MS);
    if (verify) {
      const back = await inspReadProfile(mode);
      if (back && p.every((v, i) => back.params[i] === v)) restored++; else failed++;
    } else {
      restored++;
    }
  }
  if (verify) await inspStopStream(null);
  inspProfilesRestored = true;
  inspAddResult({
    cmd: '(cleanup)', item: 'Restore the speed profiles the chair had before the inspection',
    sent: `mode 0-5 (${inspOriginalProfiles.filter(Boolean).length} modes)`,
    expect: verify ? 'Dataset0 matches the saved values' : 'written only (not verified, the power is off)',
    actual: verify ? `${restored} matched / ${failed} did not` : `written to ${restored} modes`,
    result: failed ? 'FAIL' : 'INFO',
  });
}

// ---- 10. SetPower OFF ----------------------------------------------------
async function inspStagePowerOffTest() {
  inspSetStatus('Running: SetPower OFF');
  inspAddStage('10. SetPower (0x02) - power off / out-of-range values');

  await inspStopStream('StopSendingData (measurement finished)');
  const st = await inspPowerOff('SetPower P0=0');
  inspAddResult({
    cmd: 'SetPower (0x02)', item: 'Power off',
    sent: 'P0=0', expect: 'POWER_ON=0',
    actual: st ? `POWER_ON=${st.powerOn}` : 'GetSettings: no response',
    result: inspJudge(!!st && st.powerOn === 0),
  });

  // The specification does not define P0 values other than 0 / 1, so only record the outcome.
  for (const v of (inspLight ? [] : [2, 255])) {
    const after = await inspSetAndRead([0x02, v], `SetPower P0=${v} (out of range)`, 1000);
    inspAddResult({
      cmd: 'SetPower (0x02)', item: `Power state out of range, P0=${v}`,
      sent: `P0=${v}`, expect: 'not defined by the specification (recorded for reference)',
      actual: after ? `POWER_ON=${after.powerOn}` : 'GetSettings: no response',
      result: 'INFO',
    });
    if (after && after.powerOn === 1) await inspPowerOff('SetPower P0=0 (restore the state)');
  }
  inspAddResult({
    cmd: 'SetPower (0x02)', item: 'Below range / middle value',
    sent: '-', expect: '-',
    actual: 'P0 is boolean (0 / 1), so the five-value range test does not apply',
    result: 'SKIP',
  });
}

// ---- 11. SetDeviceLock (runs last, because locking cuts the power) -------
async function inspStageDeviceLock() {
  inspSetStatus('Running: SetDeviceLock');
  inspAddStage('11. SetDeviceLock (0x09)');

  const locked = await inspSetAndRead([0x09, 0x01], 'SetDeviceLock D0=1 (lock)', 1500);
  inspLastPowerOffAt = Date.now();
  inspAddResult({
    cmd: 'SetDeviceLock (0x09)', item: 'The chair can be locked',
    sent: 'D0=1', expect: 'DEVICE_LOCK=1',
    actual: locked ? `DEVICE_LOCK=${locked.deviceLock}` : 'GetSettings: no response',
    result: inspJudge(!!locked && locked.deviceLock === 1),
  });
  inspAddResult({
    cmd: 'SetDeviceLock (0x09)', item: 'Locking turns the power off',
    sent: 'D0=1', expect: 'POWER_ON=0',
    actual: locked ? `POWER_ON=${locked.powerOn}` : 'GetSettings: no response',
    result: inspJudge(!!locked && locked.powerOn === 0),
  });

  // SetPower ON must have no effect while locked.
  for (let i = 0; i < 5; i++) {
    await inspCommand([0x02, 0x01], i === 0 ? 'SetPower P0=1 (while locked)' : null);
    await inspSleep(200);
  }
  await inspSleep(800);
  const still = await inspGetSettings();
  inspAddResult({
    cmd: 'SetDeviceLock (0x09)', item: 'SetPower ON has no effect while locked',
    sent: 'D0=1 → SetPower P0=1', expect: 'POWER_ON stays 0',
    actual: still ? `POWER_ON=${still.powerOn} / DEVICE_LOCK=${still.deviceLock}` : 'GetSettings: no response',
    result: inspJudge(!!still && still.powerOn === 0),
  });
  if (still && still.powerOn === 1) await inspPowerOff('SetPower P0=0 (restore the state)');

  // Any value other than 1 unlocks.
  for (const v of (inspLight ? [0] : [0, 2, 255])) {
    if (v !== 0) {
      await inspSetAndRead([0x09, 0x01], `SetDeviceLock D0=1 (lock again before testing ${v})`, 1200);
    }
    const st = await inspSetAndRead([0x09, v], `SetDeviceLock D0=${v} (unlock)`, 1500);
    inspAddResult({
      cmd: 'SetDeviceLock (0x09)', item: `D0=${v} unlocks the chair`,
      sent: `D0=${v}`, expect: 'DEVICE_LOCK=0',
      actual: st ? `DEVICE_LOCK=${st.deviceLock}` : 'GetSettings: no response',
      result: inspJudge(!!st && st.deviceLock === 0),
    });
  }
  inspAddResult({
    cmd: 'SetDeviceLock (0x09)', item: 'Below range / middle value',
    sent: '-', expect: '-',
    actual: 'D0 is boolean (1 locks, any other value unlocks), so the five-value range test does not apply',
    result: 'SKIP',
  });
}

// ---- Cleanup -------------------------------------------------------------
async function inspFinalRestore() {
  inspSetStatus('Cleanup: restoring settings');
  inspAddStage('12. Cleanup - restore the settings');
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      inspAddResult({ cmd: '(cleanup)', item: label, sent: '-', expect: '-',
                      actual: `could not be restored: ${e.message}`, result: 'FAIL' });
    }
  };

  await step('Stop the motor input and the data stream', async () => {
    for (let i = 0; i < 3; i++) {
      await inspSend(inspBuildFrame([0x03, 0x01, 0x00, 0x00]), null);
      await inspRawSleep(60);
    }
    await inspSend(inspBuildFrame([0x01]), 'StopSendingData (cleanup)');
    await inspRawSleep(200);
  });

  if (!inspLegacy) await step('Release the device lock', async () => {
    await inspSend(inspBuildFrame([0x09, 0x00]), 'SetDeviceLock D0=0 (cleanup)');
    await inspRawSleep(300);
  });

  await step('Restore the speed profiles', async () => {
    await inspRestoreProfiles(false);
  });

  const org = inspLegacy ? null : inspOriginalSettings;
  if (org) {
    await step('Restore the settings the chair had before the inspection', async () => {
      // SetSpeedLevel / SetMaxSpeedLevel are relayed internally and can take a
      // moment, and the preceding unlock can move them as well. Read the values
      // back and re-send only the ones that do not match.
      const targets = [
        { key: 'joystickPause', value: org.joystickPause, label: 'SetJoystickPause',
          frame: (v) => [0x0A, v] },
        { key: 'maxSpeedLevel', value: org.maxSpeedLevel, label: 'SetMaxSpeedLevel',
          frame: (v) => [0x0B, v] },
        { key: 'speedLevel', value: org.speedLevel, label: 'SetSpeedLevel',
          frame: (v) => [0x0C, v] },
        { key: 'autoPowerOff', value: org.autoPowerOff, label: 'SetAutoPowerOff',
          frame: (v) => [0x0E, v] },
      ];
      let st = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const pending = targets.filter((t) => !st || st[t.key] !== t.value);
        if (!pending.length) break;
        // SetSpeedLevel only takes effect while the power is off. If an abort left
        // the power on, turn it off here before restoring (after a normal run
        // the power is already off, so nothing happens).
        if (st && st.powerOn === 1 && pending.some((t) => t.key === 'speedLevel')) {
          await inspSend(inspBuildFrame([0x02, 0x00]), 'SetPower P0=0 (so SetSpeedLevel can be restored)');
          await inspRawSleep(1500);
        }
        for (const t of pending) {
          await inspSend(inspBuildFrame(t.frame(t.value)),
                         `${t.label} ${t.value} (cleanup${attempt ? ', retry' : ''})`);
          await inspRawSleep(200);
        }
        await inspRawSleep(600);
        st = await inspGetSettings(2);
        if (!st) break;
      }
      const missed = st ? targets.filter((t) => st[t.key] !== t.value) : targets;
      inspAddResult({
        cmd: '(cleanup)', item: 'Restore the settings the chair had before the inspection',
        sent: `Pause=${org.joystickPause} MaxLv=${org.maxSpeedLevel} ` +
              `Lv=${org.speedLevel} AutoOff=${org.autoPowerOff}`,
        expect: 'the saved values are restored',
        actual: (st
          ? `Lock=${st.deviceLock} Pause=${st.joystickPause} MaxLv=${st.maxSpeedLevel} ` +
            `Lv=${st.speedLevel} AutoOff=${st.autoPowerOff} Power=${st.powerOn}`
          : 'GetSettings: no response') +
          (missed.length ? ` / could not restore: ${missed.map((t) => t.label).join(', ')}` : ''),
        result: st && !missed.length ? 'INFO' : 'FAIL',
      });
    });
  }
}

// ---- Run control ---------------------------------------------------------
// What the operator has to know before pressing Start, per mode.
const INSP_CAUTIONS = [
  { modes: ['full', 'light'], text: 'The horn sounds at the start.' },
  { modes: ['full', 'light', 'legacy'],
    text: 'The wheels turn at up to 6 km/h - keep the area around the chair clear.' },
  { modes: ['light', 'legacy'], text: 'A run takes about 1 minute.' },
  { modes: ['full'], text: 'A run takes about 3 minutes.' },
];

function inspRenderCautions() {
  const mode = inspSelectedMode();
  inspWarnBox.innerHTML = INSP_CAUTIONS
    .filter((c) => c.modes.includes(mode))
    .map((c, i) => `<div>${i === 0 ? '\u26A0\uFE0F ' : ''}${inspEsc(c.text)}</div>`)
    .join('');
}

// The mode is read when Start is pressed, so changing it mid-run has no effect.
function inspSelectedMode() {
  const checked = document.querySelector('input[name="insp-mode"]:checked');
  const value = checked ? checked.value : 'light';
  return ['full', 'light', 'legacy'].includes(value) ? value : 'light';
}

function inspUpdateStartEnabled() {
  inspStartButton.disabled = inspRunning || !isConnected || !inspJackupCheck.checked;
  inspEndButton.disabled = !inspRunning;
  inspJackupCheck.disabled = inspRunning;
  document.querySelectorAll('input[name="insp-mode"]').forEach((radio) => {
    radio.disabled = inspRunning;
  });
}

async function inspRun() {
  if (inspRunning) return;
  if (!isConnected) { alert('Connect to the WHILL before starting.'); return; }
  if (!inspJackupCheck.checked) { alert('Confirm the chair is jacked up and tick the checkbox.'); return; }

  // Stop any continuous sending, so manual controls cannot fight the inspection.
  stopJoystickContinuousSending();
  stopVelocityContinuousSending();
  stopJoystickInterval();

  inspMode = inspSelectedMode();
  inspLight = inspMode !== 'full';
  inspLegacy = inspMode === 'legacy';
  inspRunning = true;
  inspAbortReason = null;
  inspResults = [];
  inspRowNo = 0;
  inspInfoData = {};
  inspModules = [];
  inspRxBuffer = new Uint8Array(0);
  inspOriginalSettings = null;
  inspOriginalProfiles = [];
  inspProfilesRestored = false;
  inspRightSign = 1;
  inspLastPowerOffAt = 0;
  inspDownloadButton.disabled = true;
  inspRenderResults();
  inspRenderSummary(false);

  const startedAt = new Date();
  inspSetInfo('Inspection type', inspMode.charAt(0).toUpperCase() + inspMode.slice(1));
  inspSetInfo('Started at', getJapanTimeString());
  inspUpdateStartEnabled();
  appendLog(`[${getJapanTimeString()}] [inspection] ===== ${inspMode} inspection started =====\n`);

  const safetyOff = inspInstallSafetyMonitor();
  let finalStatus = 'Inspection complete';
  try {
    await inspStopStream('StopSendingData (initial state before the inspection)');
    if (inspLegacy) {
      // Only the six commands a legacy chair has. The stage numbers follow the full
      // sequence, so the gaps show what such a chair cannot be checked for.
      await inspStageLegacyPrepare();
      await inspStageLegacyPowerOn();
      await inspStageStreaming();
      await inspStageSpeedProfile();
      await inspStageMotor();
      await inspRestoreProfiles(true);
      await inspStageLegacyPowerOff();
    } else {
      await inspStagePrepare();
      await inspStageHorn();
      await inspStagePowerOffCommands();
      await inspStagePowerOn();
      await inspStageStreaming();
      await inspStageSpeedProfile();
      await inspStageMotor();
      await inspStagePowerOnSettings();
      await inspRestoreProfiles(true);
      await inspStagePowerOffTest();
      await inspStageDeviceLock();
    }
    finalStatus = 'Inspection complete';
  } catch (e) {
    const aborted = e instanceof InspectionAbort;
    if (!aborted) console.error('Inspection error:', e);
    inspAddStage(aborted ? `!! Inspection aborted: ${e.message}`
                         : `!! Inspection ended with an error: ${e.message}`);
    finalStatus = `${aborted ? 'Aborted' : 'Error'}: ${e.message}`;
    // A stage heading only reaches the CSV as a Stage column, so record the reason as a row too.
    inspAddResult({
      cmd: aborted ? '(aborted)' : '(error)',
      item: aborted ? 'The inspection did not run to the end' : 'The inspection ended on an exception',
      sent: '-', expect: 'all stages up to 12 are run',
      actual: `${e.message} (the remaining stages were not run)`,
      result: 'FAIL',
    });
    // Keep the stack in the log as well (the log can be exported with Download CSV).
    appendLog(`[${getJapanTimeString()}] [inspection] end reason: ${(e && e.stack) || e}\n`);
    inspSetStatus(finalStatus);
  } finally {
    safetyOff();
    inspAbortReason = null;          // cleanup must not be stopped by an abort request
    try {
      await inspFinalRestore();
    } catch (e) {
      console.error('Inspection restore error:', e);
    }
    const elapsed = Math.round((Date.now() - startedAt.getTime()) / 1000);
    const elapsedText = `${Math.floor(elapsed / 60)} min ${elapsed % 60} s`;
    inspSetInfo('Finished at', getJapanTimeString());
    inspSetInfo('Duration', elapsedText);
    inspRunning = false;
    inspAbortReason = null;
    inspRxBuffer = new Uint8Array(0);
    inspDownloadButton.disabled = inspResults.length === 0;
    inspRenderSummary(true);
    inspSetStatus(finalStatus);      // do not leave the cleanup progress in the status line
    inspUpdateStartEnabled();
    appendLog(`[${getJapanTimeString()}] [inspection] ===== inspection finished =====\n`);
    inspShowCompletionPopup(finalStatus, elapsedText);
  }
}

// Tell the operator the inspection is over. It runs unattended, so this has to be noticeable.
function inspShowCompletionPopup(finalStatus, elapsedText) {
  const rows = inspResults.filter((r) => !r.stage);
  const count = (v) => rows.filter((r) => r.result === v).length;
  const fails = rows.filter((r) => r.result === 'FAIL');
  const verdict = count('PASS') + fails.length === 0 ? 'Not run'
                : fails.length === 0 ? 'PASS' : 'FAIL';
  let message = `${finalStatus}\n\n` +
                `Inspection type: ${inspMode.charAt(0).toUpperCase() + inspMode.slice(1)}\n` +
                `Overall: ${verdict}\n` +
                `PASS ${count('PASS')} / FAIL ${fails.length} / ` +
                `Info ${count('INFO')} / Skipped ${count('SKIP')}\n` +
                `Duration: ${elapsedText}`;
  if (fails.length) {
    const shown = fails.slice(0, 10);
    message += '\n\nFailed items:\n' +
               shown.map((r) => `  #${r.no} ${r.cmd} / ${r.item}`).join('\n');
    if (fails.length > shown.length) message += `\n  and ${fails.length - shown.length} more`;
  }
  message += '\n\nThe report can be saved with Download Report (CSV) under Result.';
  setTimeout(() => alert(message), 50);   // let the page repaint before the modal blocks it
}

// ---- Report export (CSV) -------------------------------------------------
function inspBuildReportCsv() {
  const q = (s) => `"${String(s === undefined || s === null ? '' : s).replace(/"/g, '""')}"`;
  const lines = ['WHILL Serial API Inspection Report'];
  if (inspModules.length) {
    lines.push(['Module', 'Firmware', 'Serial number'].map(q).join(','));
    inspModules.forEach((m) => lines.push([q(m.name), q(m.firmware), q(m.serial)].join(',')));
    lines.push('');
  }
  Object.entries(inspInfoData).forEach(([k, v]) => lines.push([q(k), q(v)].join(',')));
  const rows = inspResults.filter((r) => !r.stage);
  const count = (v) => rows.filter((r) => r.result === v).length;
  lines.push([q('PASS / FAIL / Info / Skipped'),
              q(`${count('PASS')} / ${count('FAIL')} / ${count('INFO')} / ${count('SKIP')}`)].join(','));
  lines.push([q('Overall'), q(count('FAIL') === 0 ? 'PASS' : 'FAIL')].join(','));
  lines.push('');
  lines.push(['No', 'Stage', 'Command', 'Test item', 'Sent', 'Expected', 'Measured', 'Result'].map(q).join(','));
  let stage = '';
  for (const r of inspResults) {
    if (r.stage) { stage = r.stage; continue; }
    lines.push([r.no, stage, r.cmd, r.item, r.sent, r.expect, r.actual, r.result].map(q).join(','));
  }
  return '﻿' + lines.join('\r\n');
}

function inspDownloadReport() {
  if (!inspResults.length) { alert('There is no inspection result to export.'); return; }
  const blob = new Blob([inspBuildReportCsv()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspection_${getJapanTimeStringForFilename()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Called when the tester is connected or disconnected.
function inspOnConnectionChange(connected) {
  if (!connected && inspRunning) {
    inspAbortReason = 'the serial port was disconnected during the inspection';
  }
  inspUpdateStartEnabled();
}

// ---- Install -----------------------------------------------------------------
// Adds the stylesheet, the tab button and the tab itself to the tester, then
// registers with the add-on hooks. Does nothing if the tester is not compatible.
function inspInstall() {
  const missing = INSP_TESTER_CONTRACT.filter(([, kind]) => kind === 'undefined').map(([n]) => n);
  if (missing.length) {
    console.error('Inspection add-on: this tester is missing ' + missing.join(', ') +
                  ' - see tools/cr2-inspection/README.md');
    return;
  }

  const style = document.createElement('style');
  style.textContent = INSP_STYLE;
  document.head.appendChild(style);

  document.querySelector('.tab-buttons').insertAdjacentHTML(
    'beforeend', '<button class="tab-button" onclick="switchTab(\'inspection\')">Inspection</button>');
  document.querySelector('.shell-content').insertAdjacentHTML('beforeend', INSP_MARKUP);

  inspJackupCheck    = document.getElementById('insp-jackup-check');
  inspWarnBox        = document.getElementById('insp-warn');
  inspStartButton    = document.getElementById('insp-start-button');
  inspEndButton      = document.getElementById('insp-end-button');
  inspStatusText     = document.getElementById('insp-status');
  inspInfoGrid       = document.getElementById('insp-info-grid');
  inspModuleTable    = document.getElementById('insp-module-table');
  inspModuleBody     = document.getElementById('insp-module-body');
  inspSummaryBox     = document.getElementById('insp-summary');
  inspResultBody     = document.getElementById('insp-result-body');
  inspDownloadButton = document.getElementById('insp-download-button');

  inspStartButton.addEventListener('click', inspRun);
  inspEndButton.addEventListener('click', () => {
    if (!inspRunning) return;
    inspAbortReason = 'stopped with the End button';
    inspSetStatus('Stop requested...');
  });
  inspJackupCheck.addEventListener('change', inspUpdateStartEnabled);
  document.querySelectorAll('input[name="insp-mode"]').forEach((radio) => {
    radio.addEventListener('change', inspRenderCautions);
  });
  inspDownloadButton.addEventListener('click', inspDownloadReport);

  testerAddons.onReceive.push(inspectionRx);
  testerAddons.onConnectionChange.push(inspOnConnectionChange);
  testerAddons.suppressRawLog = () => inspRunning;

  inspRenderCautions();
  inspUpdateStartEnabled();
  inspRenderSummary(false);
}

inspInstall();
