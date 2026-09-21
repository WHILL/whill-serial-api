// A WHILL that behaves the way the specification says, as a fake serial port.
//
// It implements the accept / reject rules of every published command, streams
// Dataset0 / Dataset1, and models the drive well enough to exercise the motor
// checks: the right motor reads the opposite sign of the left when driving
// forward, and a turn command is split half to each wheel - both matching what
// a real Model CR2 does.
'use strict';

const LOWER = [8, 10, 40, 8, 10, 40, 8, 10, 40];

// Upper limits per speed mode, from Motor_Controller_Lark
// application/speed_profile.c (speed_profile_upper_limit).
const UPPER = [
  [20, 24, 80, 15, 30, 80, 15, 80, 100],    // S1=0  Speed Profile 1
  [45, 30, 100, 20, 30, 80, 20, 80, 100],   // S1=1  Speed Profile 2
  [65, 56, 160, 30, 30, 80, 30, 80, 100],   // S1=2  Speed Profile 3
  [85, 64, 160, 30, 30, 80, 35, 80, 100],   // S1=3  Speed Profile 4
  [85, 64, 160, 30, 50, 80, 35, 100, 160],  // S1=4  Speed Profile 5 (RS232C)
  [20, 24, 72, 15, 24, 64, 15, 56, 72],     // S1=5  Speed Profile Remote (BLE)
];

// Ranges enforced by the Service Module, from WHILL-OS_IoT-Module_v1_rx65n
// middleware/mrp_interface/src/private/mrp_control_command.c.
const SM_RANGE = [[8, 60], [10, 90], [40, 160], [8, 60], [10, 90], [40, 160], [8, 60], [10, 90], [40, 160]];

// The only commands an older chair has. Anything else is ignored, exactly as a
// chair that predates the current Serial API would ignore it.
const LEGACY_COMMANDS = [0x00, 0x01, 0x02, 0x03, 0x04, 0x08];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const s8 = (v) => (v > 127 ? v - 256 : v);
const s16 = (hi, lo) => (((hi << 8) | lo) << 16) >> 16;
const pack16 = (v) => [(v >> 8) & 0xFF, v & 0xFF];

function createSimulator(options) {
  const opts = options || {};
  const sim = {
    powerOn: 0, deviceLock: 0, joystickPause: 0,
    maxSpeedLevel: 2, speedLevel: 2, autoPowerOff: 1,
    battery: 87,
    errorCode: opts.errorCode === undefined ? 63 : opts.errorCode,
    profiles: [
      [10, 16, 56, 10, 16, 56, 10, 56, 72],
      [20, 24, 72, 15, 24, 56, 15, 56, 72],
      [40, 40, 96, 20, 24, 56, 20, 56, 72],
      [60, 56, 125, 20, 24, 56, 25, 56, 72],
      [60, 32, 96, 20, 24, 64, 35, 56, 72],
      [20, 24, 72, 15, 24, 56, 15, 56, 72],
    ],
    stream: null, timer: null,
    drive: { forward: 0, turn: 0, until: 0 },
    hornCount: 0,
    unsupported: [],        // command ids a legacy chair was asked for
    deliver: null,          // set by the caller to the add-on's receive function
  };

  const withChecksum = (bytes) => {
    let cs = 0;
    for (const b of bytes) cs ^= b;
    return new Uint8Array([...bytes, cs]);
  };
  const reply = (payload) => {
    const frame = withChecksum([0xAF, payload.length + 1, ...payload]);
    setTimeout(() => sim.deliver(frame), 1);
  };

  function tick() {
    if (!sim.stream || !sim.powerOn) return;
    if (sim.stream.dataSet === 0) {
      reply([0x00, sim.stream.mode, ...sim.profiles[sim.stream.mode]]);
      return;
    }
    const active = Date.now() < sim.drive.until;
    const forward = active ? sim.drive.forward : 0;
    const turn = active ? sim.drive.turn : 0;
    const right = Math.round((-forward + turn / 2) / 0.004);
    const left = Math.round((forward + turn / 2) / 0.004);
    const info = new Array(29).fill(0);
    info[2] = sim.deviceLock;
    info[3] = sim.joystickPause;
    info[4] = sim.maxSpeedLevel;
    info[5] = sim.speedLevel;
    info[6] = sim.autoPowerOff;
    info[14] = sim.battery;
    [info[21], info[22]] = pack16(right);
    [info[23], info[24]] = pack16(left);
    info[25] = 1;
    info[26] = 4;
    info[27] = sim.errorCode;
    reply([0x01, ...info]);
  }

  function startStream(dataSet, interval, mode) {
    sim.stream = { dataSet, interval, mode };
    if (sim.timer) clearInterval(sim.timer);
    sim.timer = setInterval(tick, interval);
  }
  function stopStream() {
    sim.stream = null;
    if (sim.timer) { clearInterval(sim.timer); sim.timer = null; }
  }

  function handle(payload) {
    if (opts.legacy && !LEGACY_COMMANDS.includes(payload[0])) {
      if (!sim.unsupported.includes(payload[0])) sim.unsupported.push(payload[0]);
      return;
    }
    const p = payload.slice(1);
    switch (payload[0]) {
      case 0x00: {                                       // StartSendingData
        const interval = (p[1] << 8) | p[2];
        if (p[0] > 1 || interval < 10 || p[3] > 5) return;   // out of range: discard it all
        startStream(p[0], interval, p[3]);
        return;
      }
      case 0x01: stopStream(); return;                   // StopSendingData
      case 0x02:                                         // SetPower
        if (p[0] === 1) {
          if (sim.deviceLock) return;                    // no power-on while locked
          sim.powerOn = 1;
          reply([0x52]);
        } else if (p[0] === 0) {
          sim.powerOn = 0;
        }
        return;                                          // other values: undefined, ignored
      case 0x03: {                                       // SetJoystick
        if (p[0] !== 0) return;
        if (sim.joystickPause) return;                   // no effect while paused
        const fb = clamp(s8(p[1]), -100, 100);
        const lr = clamp(s8(p[2]), -100, 100);
        const profile = sim.profiles[4];
        const max = (fb >= 0 ? profile[0] : profile[3]) * 0.1;
        sim.drive = {
          forward: (fb / 100) * max,
          turn: (lr / 100) * profile[6] * 0.1,
          until: Date.now() + 200,
        };
        return;
      }
      case 0x04: {                                       // SetSpeedProfile
        const mode = p[0];
        const params = Array.from(p.slice(1, 10));
        if (mode > 5) return;
        if (params.some((v, i) => v < SM_RANGE[i][0] || v > SM_RANGE[i][1])) return;   // SM check
        if (params.some((v, i) => v < LOWER[i] || v > UPPER[mode][i])) return;         // MC check
        sim.profiles[mode] = params;
        return;
      }
      case 0x07: {                                       // GetIdentification
        if (p[0] === 0) { reply([0x07, 0x00, 82, 8, 81, 6, 2, 0]); return; }   // firmware versions
        const serial = { 1: 'SM2402000123', 2: 'HMI24010045', 3: 'MC24010077' }[p[0]];
        if (serial === undefined) return;                // undefined target: no response
        reply([0x07, p[0], ...Array.from(serial, (c) => c.charCodeAt(0))]);
        return;
      }
      case 0x08: {                                       // SetVelocity
        if (p[0] !== 0) return;
        sim.drive = {
          forward: clamp(s16(p[1], p[2]), -500, 1500) * 0.004,
          turn: clamp(s16(p[3], p[4]), -750, 750) * 0.004,
          until: Date.now() + 200,
        };
        return;
      }
      case 0x09:                                         // SetDeviceLock
        sim.deviceLock = p[0] === 1 ? 1 : 0;
        if (sim.deviceLock) sim.powerOn = 0;             // locking cuts the power
        return;
      case 0x0A: sim.joystickPause = p[0] === 1 ? 1 : 0; return;
      case 0x0B: sim.maxSpeedLevel = clamp(p[0], 1, 4); return;
      case 0x0C:                                         // SetSpeedLevel
        if (sim.powerOn) return;                         // ignored while powered on
        if (p[0] < 1 || p[0] > 4) return;                // out of range: rejected
        sim.speedLevel = p[0];
        return;
      case 0x0D: if (p[0] === 1) sim.hornCount++; return;
      case 0x0E: sim.autoPowerOff = p[0] === 1 ? 1 : 0; return;
      case 0x0F: reply([0x0F, sim.deviceLock, sim.joystickPause, sim.maxSpeedLevel,
                        sim.speedLevel, sim.autoPowerOff, sim.powerOn]); return;
      case 0x10: reply([0x10, 0x01, 0x01, 0x1F, 0xFF, 0x01, 0, 0, 0, 0, 0,
                        0x7C, 0xFF, 0xFF, 0x1F]); return;
      default: return;
    }
  }

  let txBuffer = [];
  const port = {
    writable: {
      getWriter() {
        return {
          async write(bytes) {
            txBuffer.push(...bytes);
            while (txBuffer.length >= 2) {
              if (txBuffer[0] !== 0xAF) { txBuffer.shift(); continue; }
              const total = txBuffer[1] + 2;
              if (txBuffer.length < total) break;
              const frame = txBuffer.splice(0, total);
              handle(frame.slice(2, total - 1));
            }
          },
          releaseLock() {},
        };
      },
    },
    readable: {},
  };

  return { sim, port, stop: stopStream, LOWER, UPPER, SM_RANGE };
}

module.exports = { createSimulator, LOWER, UPPER, SM_RANGE, LEGACY_COMMANDS };
