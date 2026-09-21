// Runs the whole inspection sequence against a simulated WHILL.
//
//   node tools/cr2-inspection/tests/dryrun.js            light inspection (the default)
//   node tools/cr2-inspection/tests/dryrun.js --full     full inspection
//   node tools/cr2-inspection/tests/dryrun.js --legacy   legacy inspection, against a
//                                                        chair that has only the six
//                                                        commands such a chair has
//
// The waits are shortened so a run takes about 90 s instead of three minutes.
// The order of the steps and every pass / fail rule are untouched, so this
// catches a broken sequence, a broken judgement, and a broken tester contract.
'use strict';

const { loadTester } = require('./load');
const { createSimulator } = require('./simulator');

// Only the waits. Never shorten INSP_DRIVE_PERIOD_MS or any threshold.
const SHRINK = {
  INSP_DRIVE_MS: 400,
  INSP_PLATEAU_MS: 200,
  INSP_COOLDOWN_MS: 60,
  INSP_GAP_MS: 2,
  INSP_POWER_WAIT_MS: 100,
  INSP_DS1_INTERVAL_MS: 20,
  INSP_PROFILE_SETTLE_MS: 60,
};

// Expected number of report rows, so a silently shortened sequence is caught.
const EXPECTED_ROWS = { full: 128, light: 39, legacy: 21 };

const mode = process.argv.includes('--full') ? 'full'
           : process.argv.includes('--legacy') ? 'legacy' : 'light';
const popups = [];
const { sim, port, stop } = createSimulator({ legacy: mode === 'legacy' });
const { T, ctx } = loadTester({
  shrink: SHRINK,
  context: { alert: (message) => popups.push(message) },
});

sim.deliver = (frame) => T.inspectionRx(frame);
T.setPort(port);
T.setConnected(true);
ctx.document.getElementById('insp-jackup-check').checked = true;   // the operator's confirmation
ctx.document.selectedMode = mode;                                  // the Full / Light radio

const startedAt = Date.now();

T.run().then(() => new Promise((r) => setTimeout(r, 200))).then(() => {
  const rows = T.results().filter((r) => !r.stage);
  const stages = T.results().filter((r) => r.stage).map((r) => r.stage);
  const count = (v) => rows.filter((r) => r.result === v).length;
  const fails = rows.filter((r) => r.result === 'FAIL');

  console.log('\n===== Stages =====');
  stages.forEach((s) => console.log('  ' + s));

  console.log('\n===== Totals =====');
  console.log(`  ${mode} inspection`);
  console.log(`  ${rows.length} rows / PASS ${count('PASS')} / FAIL ${fails.length} ` +
              `/ INFO ${count('INFO')} / SKIP ${count('SKIP')}`);
  console.log(`  status: ${T.status()}`);
  console.log(`  took ${((Date.now() - startedAt) / 1000).toFixed(1)} s (with the waits shortened)`);

  if (fails.length) {
    console.log('\n===== Failures =====');
    fails.forEach((r) => console.log(`  #${r.no} ${r.cmd} / ${r.item}` +
                                     `\n      expected: ${r.expect}\n      measured: ${r.actual}`));
  }

  console.log('\n===== Rows per command =====');
  const perCommand = {};
  rows.forEach((r) => { perCommand[r.cmd] = (perCommand[r.cmd] || 0) + 1; });
  Object.entries(perCommand).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log('\n===== Device information =====');
  T.modules().forEach((m) => console.log(
    `  ${m.name.padEnd(17)} FW ${m.firmware.padEnd(6)} S/N ${m.serial}`));

  console.log('\n===== Simulated chair, final state =====');
  console.log(`  power=${sim.powerOn} lock=${sim.deviceLock} pause=${sim.joystickPause} ` +
              `maxLv=${sim.maxSpeedLevel} lv=${sim.speedLevel} autoOff=${sim.autoPowerOff}`);
  console.log(`  horn sounded ${sim.hornCount} time(s)`);
  sim.profiles.forEach((p, i) => console.log(`  profile ${i}: ${p.join(' ')}`));

  console.log('\n===== Completion pop-up =====');
  const last = popups.length ? popups[popups.length - 1] : null;
  console.log(last ? last.split('\n').map((l) => '  ' + l).join('\n') : '  (none was shown)');

  stop();

  // The 10 ms interval check measures Node's timer, not a serial line, so it is
  // expected to miss here - it passes on real hardware (9.9 ms measured).
  const realFailures = fails.filter((r) => !/send interval 10 ms/.test(r.item));
  const hex = (id) => '0x' + id.toString(16).toUpperCase().padStart(2, '0');
  if (mode === 'legacy') {
    console.log('\n===== Commands a legacy chair does not have =====');
    console.log(sim.unsupported.length
      ? '  SENT ANYWAY: ' + sim.unsupported.map(hex).join(', ')
      : '  none were sent');
  }

  const ok = realFailures.length === 0 && rows.length === EXPECTED_ROWS[mode] && !!last &&
             (mode !== 'legacy' || sim.unsupported.length === 0);
  if (rows.length !== EXPECTED_ROWS[mode]) {
    console.log(`\nExpected ${EXPECTED_ROWS[mode]} rows, got ${rows.length}`);
  }
  console.log(ok ? '\nDry run OK' : '\nDry run FAILED');
  process.exit(ok ? 0 : 1);
}).catch((e) => {
  console.error('Dry run error:', e);
  stop();
  process.exit(2);
});
