// Unit tests for the inspection add-on. No browser, no hardware.
//
//   node tools/cr2-inspection/tests/run.js
'use strict';

const { loadTester } = require('./load');
const { LOWER, UPPER, SM_RANGE } = require('./simulator');

const { T, ctx } = loadTester();

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}
const hex = (bytes) => Array.from(bytes).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const bytes = (s) => new Uint8Array(s.split(' ').map((b) => parseInt(b, 16)));

console.log('\n[1] Frames match the ready-made frames in the specification');
const FRAMES = [
  ['StopSendingData', [0x01], 'AF 02 01 AC'],
  ['SetPower ON', [0x02, 0x01], 'AF 03 02 01 AF'],
  ['SetPower OFF', [0x02, 0x00], 'AF 03 02 00 AE'],
  ['SetDeviceLock lock', [0x09, 0x01], 'AF 03 09 01 A4'],
  ['SetDeviceLock unlock', [0x09, 0x00], 'AF 03 09 00 A5'],
  ['SetJoystickPause pause', [0x0A, 0x01], 'AF 03 0A 01 A7'],
  ['SetMaxSpeedLevel 4', [0x0B, 0x04], 'AF 03 0B 04 A3'],
  ['SetSpeedLevel 1', [0x0C, 0x01], 'AF 03 0C 01 A1'],
  ['SoundHorn', [0x0D, 0x01], 'AF 03 0D 01 A0'],
  ['SetAutoPowerOff enable', [0x0E, 0x01], 'AF 03 0E 01 A3'],
  ['GetSettings', [0x0F], 'AF 02 0F A2'],
  ['GetCapability', [0x10], 'AF 02 10 BD'],
  ['GetIdentification', [0x07, 0x00], 'AF 03 07 00 AB'],
  ['SetJoystick half forward', [0x03, 0x00, 0x32, 0x00], 'AF 05 03 00 32 00 9B'],
  ['SetVelocity 1.0 km/h', [0x08, 0x00, 0x00, 0xFA, 0x00, 0x00], 'AF 07 08 00 00 FA 00 00 5A'],
  ['SetSpeedProfile mode 4', [0x04, 0x04, 0x1E, 0x19, 0x38, 0x14, 0x19, 0x38, 0x19, 0x19, 0x38],
   'AF 0C 04 04 1E 19 38 14 19 38 19 19 38 91'],
];
for (const [name, payload, expected] of FRAMES) {
  const got = hex(T.inspBuildFrame(payload));
  check(name, got === expected, `got ${got}, want ${expected}`);
}
check('StartSendingData Dataset1 100 ms mode 4',
  hex(T.inspBuildFrame(T.inspStartSendingData(1, 100, 4))) === 'AF 06 00 01 00 64 04 C8');
check('StartSendingData Dataset0 1000 ms mode 4',
  hex(T.inspBuildFrame(T.inspStartSendingData(0, 1000, 4))) === 'AF 06 00 00 03 E8 04 46');

console.log('\n[2] Receive parser');
T.setRunning(true);
T.resetRx();
const seen = [];
const stopListening = T.inspOnFrame((f) => seen.push(f));
T.inspectionRx(bytes('11 22 AF 02 52 FF AF 08 0F 01 00 04 03 01 01 AE 33'));
check('two back-to-back frames are found between junk bytes', seen.length === 2, `got ${seen.length}`);
check('the power-on response is identified', seen[0] && seen[0].cmd === 0x52);
check('the settings response is identified', seen[1] && seen[1].cmd === 0x0F && seen[1].payload.length === 7);
check('the settings fields are read correctly',
  seen[1] && Array.from(seen[1].payload.slice(1)).join(',') === '1,0,4,3,1,1');
seen.length = 0;
T.inspectionRx(bytes('AF 02'));
check('an incomplete frame is not delivered yet', seen.length === 0);
T.inspectionRx(bytes('52 FF'));
check('a frame split across two chunks is assembled', seen.length === 1 && seen[0].cmd === 0x52);
seen.length = 0;
T.inspectionRx(bytes('AF 02 52 00 AF 02 52 FF'));
check('a bad checksum is dropped and the next frame is still found', seen.length === 1, `got ${seen.length}`);
// The serial number response reuses command 0x07 with the target echoed in the
// first payload byte: AF [len] 07 [type] [ASCII characters] [checksum].
seen.length = 0;
T.inspectionRx(bytes('AF 08 07 01 41 42 31 32 33 92'));
check('a serial number response is identified',
  seen.length === 1 && seen[0].cmd === 0x07 && seen[0].payload[1] === 0x01, `got ${seen.length}`);
check('the serial number decodes as ASCII', seen.length === 1 &&
  Array.from(seen[0].payload.slice(2)).map((b) => String.fromCharCode(b)).join('') === 'AB123');
stopListening();

console.log('\n[3] Data set parsing');
const ds0 = T.inspParseDs0(new Uint8Array([0x00, 4, 30, 25, 56, 20, 25, 56, 20, 25, 56]));
check('Dataset0 speed mode', ds0.mode === 4);
check('Dataset0 parameters', ds0.params.join(' ') === '30 25 56 20 25 56 20 25 56', ds0.params.join(' '));

const info = new Array(29).fill(0);
info[2] = 1;                          // DEVICE_LOCK
info[4] = 4;                          // MAX_SPEED_LEVEL
info[5] = 3;                          // SPEED_LEVEL
info[6] = 1;                          // AUTO_POWER_OFF
info[14] = 87;                        // BATTERY_POWER
info[21] = 0x01; info[22] = 0xF4;     // RIGHT_MOTOR_SPEED  500 -> 2.0 km/h
info[23] = 0xFE; info[24] = 0x0C;     // LEFT_MOTOR_SPEED  -500 -> -2.0 km/h
info[26] = 3;                         // SPEED_MODE_INDICATOR
const ds1 = T.inspParseDs1(new Uint8Array([0x01, ...info]));
check('Dataset1 DEVICE_LOCK', ds1.deviceLock === 1);
check('Dataset1 MAX_SPEED_LEVEL / SPEED_LEVEL', ds1.maxSpeedLevel === 4 && ds1.speedLevel === 3);
check('Dataset1 AUTO_POWER_OFF', ds1.autoPowerOff === 1);
check('Dataset1 battery level', ds1.battery === 87);
check('Dataset1 right motor speed (0.004 km/h units)', Math.abs(ds1.rightKmh - 2.0) < 1e-9, String(ds1.rightKmh));
check('Dataset1 left motor speed (signed 16 bit)', Math.abs(ds1.leftKmh + 2.0) < 1e-9, String(ds1.leftKmh));
check('Dataset1 ERROR / SPEED_MODE_INDICATOR', ds1.error === 0 && ds1.speedModeIndicator === 3);

console.log('\n[4] Body speed from the two motor speeds');
T.setRightSign(-1);                                   // right reads the opposite sign when driving forward
const opposite = { rightKmh: 2.0, leftKmh: -2.0 };
check('opposite signs: forward = (left - right) / 2', T.inspFwdKmh(opposite) === -2.0, String(T.inspFwdKmh(opposite)));
check('opposite signs: turn = left + right', T.inspTurnKmh(opposite) === 0, String(T.inspTurnKmh(opposite)));
T.setRightSign(1);
const same = { rightKmh: 2.0, leftKmh: 2.0 };
check('same signs: forward = (left + right) / 2', T.inspFwdKmh(same) === 2.0, String(T.inspFwdKmh(same)));
check('same signs: turn is zero', T.inspTurnKmh(same) === 0, String(T.inspTurnKmh(same)));
// In a pure turn both wheels counter-rotate at the same speed. The turn command is
// the difference between them, so 1.538 km/h per wheel is a 3.076 km/h turn -
// which is what a real chair reports for X=750 (3.0 km/h).
T.setRightSign(-1);
const turning = { rightKmh: 1.538, leftKmh: 1.538 };
check('pure turn: the turn speed is the difference, twice one wheel',
  Math.abs(T.inspTurnKmh(turning) - 3.076) < 1e-9, String(T.inspTurnKmh(turning)));
check('pure turn: the forward speed is zero', Math.abs(T.inspFwdKmh(turning)) < 1e-9, String(T.inspFwdKmh(turning)));
const measured = { rightKmh: 1.028, leftKmh: 1.028 };   // measured for SetJoystick LR=100, T_M1=20
const turnError = (Math.abs(T.inspTurnKmh(measured)) - 2.0) / 2.0;
check('a real SetJoystick LR=100 measurement lands inside 5%', Math.abs(turnError) <= 0.05,
  `error ${(turnError * 100).toFixed(1)}%`);

console.log('\n[5] Test values (below range / minimum / middle / maximum / above range)');
T.setLight(false);
const values = T.inspRangeValues(8, 60);
check('five values are produced', values.map((v) => v.v).join(',') === '7,8,34,60,61', values.map((v) => v.v).join(','));
check('the in-range flags are right', values.map((v) => v.inRange).join(',') === 'false,true,true,true,false');
check('speed level 1-4', T.inspRangeValues(1, 4).map((v) => v.v).join(',') === '0,1,3,4,5');
check('a lower bound of 0 can mark the below-range case as absent',
  T.inspRangeValues(0, 5, { lowOut: null })[0].v === null);
check('a full inspection uses all four boolean values',
  T.inspBooleanValues().join(',') === '0,1,2,255');

// A light inspection keeps one accepted and one rejected value per parameter.
T.setLight(true);
const light = T.inspRangeValues(8, 60);
check('a light inspection keeps two values', light.length === 2, String(light.length));
check('they are the middle and the above-range one',
  light.map((v) => v.label).join(' / ') === 'middle / above range',
  light.map((v) => v.label).join(' / '));
check('one is accepted and one is rejected',
  light.filter((v) => v.inRange).length === 1 && light.filter((v) => !v.inRange).length === 1);
check('a light inspection uses two boolean values',
  T.inspBooleanValues().join(',') === '1,0');
T.setLight(false);

console.log('\n[6] SetSpeedProfile parameters match the specification');
const SPEC_RANGES = [[8, 60], [10, 64], [40, 160], [8, 30], [10, 50], [40, 80], [8, 35], [10, 60], [40, 160]];
check('nine parameters', T.spParams.length === 9);
check('ranges match the specification',
  T.spParams.every((p, i) => p.min === SPEC_RANGES[i][0] && p.max === SPEC_RANGES[i][1]),
  JSON.stringify(T.spParams.map((p) => [p.min, p.max])));
check('the baseline is the mid-point of every range',
  T.spBaseline.every((v, i) => v === Math.round((SPEC_RANGES[i][0] + SPEC_RANGES[i][1]) / 2)),
  T.spBaseline.join(','));
check('the baseline is inside every range',
  T.spBaseline.every((v, i) => v >= SPEC_RANGES[i][0] && v <= SPEC_RANGES[i][1]));
check('the motor-test profile is inside every range',
  T.motorProfile.every((v, i) => v >= SPEC_RANGES[i][0] && v <= SPEC_RANGES[i][1]),
  T.motorProfile.join(','));

console.log('\n[7] Report export (CSV)');
T.setInfo({ 'Serial API Version': '1.1' });
T.setModules([
  { name: 'Service Module', firmware: '82.08', serial: 'SM2402000123' },
  { name: 'HMI', firmware: '81.06', serial: '-' },
]);
T.pushResults([
  { stage: '1. Preparation' },
  { no: 1, cmd: 'GetSettings (0x0F)', item: 'Read every setting', sent: '-', expect: 'a response', actual: 'Lock=0', result: 'PASS' },
  { no: 2, cmd: 'SetPower (0x02)', item: 'Power on', sent: 'P0=1', expect: 'POWER_ON=1', actual: 'POWER_ON=0', result: 'FAIL' },
  { no: 3, cmd: 'SoundHorn (0x0D)', item: 'a "quoted" value', sent: 'D0=1', expect: '-', actual: 'a,b', result: 'INFO' },
]);
const csv = T.inspBuildReportCsv();
check('starts with a BOM so Excel reads it as UTF-8', csv.charCodeAt(0) === 0xFEFF);
check('the device information is included', csv.includes('"Serial API Version","1.1"'));
check('the module table is included',
  csv.includes('"Module","Firmware","Serial number"') &&
  csv.includes('"Service Module","82.08","SM2402000123"') &&
  csv.includes('"HMI","81.06","-"'));
check('the overall verdict is included', csv.includes('"Overall","FAIL"'));
check('the counts are included', csv.includes('"1 / 1 / 1 / 0"'));
check('the stage column is filled in', csv.split('\r\n').some((l) => l.includes('"1. Preparation"')));
check('double quotes are escaped', csv.includes('""quoted""'));
check('a value containing a comma survives', csv.includes('"a,b"'));

console.log('\n[8] The S1 test value stays inside the per-mode limits');
// Profiles read from a real chair (SM 82.08 / MC 2.00).
const OBSERVED = {
  0: [10, 16, 56, 10, 16, 56, 10, 56, 72],
  3: [60, 56, 125, 20, 24, 56, 25, 56, 72],
  5: [20, 24, 72, 15, 24, 56, 15, 56, 72],
};
for (const mode of Object.keys(OBSERVED)) {
  const own = OBSERVED[mode];
  const sent = T.inspNudgeProfile(own);
  check(`mode ${mode}: exactly one parameter moves by one`,
    sent.filter((v, i) => v !== own[i]).length === 1 && Math.abs(sent[2] - own[2]) === 1,
    `${own[2]} -> ${sent[2]}`);
  check(`mode ${mode}: the value written is inside the Motor Controller limits`,
    sent.every((v, i) => v >= LOWER[i] && v <= UPPER[mode][i]),
    sent.map((v, i) => (v < LOWER[i] || v > UPPER[mode][i]) ? `index ${i} = ${v}` : null).filter(Boolean).join(', '));
  check(`mode ${mode}: the value written is inside the Service Module ranges`,
    sent.every((v, i) => v >= SM_RANGE[i][0] && v <= SM_RANGE[i][1]));
}
// Moving the value up instead would exceed the ceiling of the BLE profile, which
// already sits at its upper limit. That is the bug this direction guards against.
check('moving the value up would break mode 5', OBSERVED[5][2] + 1 > UPPER[5][2]);

(async () => {
  console.log('\n[9] Coast-down wait');
  T.setRunning(true);
  T.resetRx();
  const dataset1 = (rawSpeed) => {
    const fields = new Array(29).fill(0);
    fields[14] = 80;
    fields[21] = (rawSpeed >> 8) & 0xFF; fields[22] = rawSpeed & 0xFF;
    fields[23] = (rawSpeed >> 8) & 0xFF; fields[24] = rawSpeed & 0xFF;
    fields[25] = 1;
    const payload = [0x01, ...fields];
    const frame = [0xAF, payload.length + 1, ...payload];
    let cs = 0;
    for (const b of frame) cs ^= b;
    return new Uint8Array([...frame, cs]);
  };

  let moving = true;
  const feeder = setInterval(() => T.inspectionRx(dataset1(moving ? 500 : 0)), 20);
  setTimeout(() => { moving = false; }, 400);
  const startedAt = Date.now();
  await T.inspWaitUntilStopped(3000);
  const waited = Date.now() - startedAt;
  clearInterval(feeder);
  check('keeps waiting while the wheels turn, returns once they stop',
    waited >= 650 && waited <= 1300, `${waited} ms`);

  const spinner = setInterval(() => T.inspectionRx(dataset1(500)), 20);
  const cappedAt = Date.now();
  await T.inspWaitUntilStopped(600);
  const capped = Date.now() - cappedAt;
  clearInterval(spinner);
  check('gives up at the timeout if the wheels never stop', capped >= 550 && capped <= 900, `${capped} ms`);

  const silentAt = Date.now();
  await T.inspWaitUntilStopped(400);
  const silent = Date.now() - silentAt;
  check('gives up at the timeout when no Dataset1 arrives', silent >= 350 && silent <= 700, `${silent} ms`);

  console.log('\n[10] Cautions shown for the selected mode');
  const cautionsFor = (mode) => {
    ctx.document.selectedMode = mode;
    T.renderCautions();
    return T.cautionsHtml().split('</div>').filter(Boolean)
      .map((line) => line.replace(/<div>/, '').trim());
  };
  const full = cautionsFor('full');
  const light = cautionsFor('light');
  const legacy = cautionsFor('legacy');

  check('full lists the horn, the wheels and three minutes',
    full.length === 3 && /horn/.test(full[0]) && /6 km\/h/.test(full[1]) &&
    /about 3 minutes/.test(full[2]), full.join(' | '));
  check('light lists the horn, the wheels and one minute',
    light.length === 3 && /horn/.test(light[0]) && /6 km\/h/.test(light[1]) &&
    /about 1 minute/.test(light[2]), light.join(' | '));
  check('legacy has no horn line and says one minute',
    legacy.length === 2 && /6 km\/h/.test(legacy[0]) && /about 1 minute/.test(legacy[1]),
    legacy.join(' | '));
  check('only the first line carries the warning sign',
    [full, light, legacy].every((lines) =>
      lines[0].startsWith('\u26A0\uFE0F') && lines.slice(1).every((l) => !l.includes('\u26A0'))));
  ctx.document.selectedMode = 'light';

  console.log(`\n${passed} passed / ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
