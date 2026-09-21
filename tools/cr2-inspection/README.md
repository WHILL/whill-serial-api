# Model CR2 Tester — Inspection add-on

An automatic conformance check for every published command of the Model CR2 Serial API.
It drives a real chair and produces a report you can save as CSV. There are three modes:

| | Report | Time | Use it for |
|---|--:|--:|---|
| **Light** (the default) | 39 rows | about 1 min | the routine check - every command once, accepted and rejected |
| **Full** | 128 rows | about 3.5 min | before shipping - every parameter across its whole range |
| **Legacy** | 21 rows | about 1 min | a chair that predates the current Serial API and has only six commands |

This is an **internal tool**. It is not linked from the published site and an ordinary
user of the tester never sees it: [`docs/cr2/tester/index.html`](../../docs/cr2/tester/index.html)
loads [`inspection.js`](../../docs/cr2/tester/inspection.js) only when the page is opened
with `?addon=inspection`.

---

## Part 1 — Running an inspection

### Before you start

| | |
|---|---|
| **The chair must be jacked up** | Both wheels clear of the floor. The chair drives at up to 6 km/h during the run. |
| **Battery 20 % or above** | The inspection stops itself below 20 %. |
| **The area must be clear** | The wheels turn and, outside a legacy inspection, the horn sounds. The tab lists the cautions that apply to the selected mode. |
| **Browser** | Chrome or Edge (Web Serial API). |

### Opening it

```
https://whill.github.io/whill-serial-api/cr2/tester/?addon=inspection
```

A fourth tab, **Inspection**, appears next to Custom Command.

Offline, keep `index.html` **and** `inspection.js` in the same folder and open the HTML
with `?addon=inspection` appended. The published tester on its own is still a single
self-contained file; the add-on is the one thing that needs a second file next to it.

### What happens

1. Connect to the chair, open the Inspection tab, tick **the chair is jacked up**, choose
   **Full**, **Light** or **Legacy**, press **Start**. The mode is read when Start is pressed,
   so changing it during a run has no effect.
2. The horn is tested first, so the confirmation dialogs come up while you are still there
   (two in a full inspection, one in a light one). Answer them and the rest runs unattended.
3. A pop-up reports the result when it finishes. Press **Download Report (CSV)** to save it.

Press **End** at any time to stop. The settings and speed profiles the chair had before the
run are restored either way.

### Reading the report

Every row is one check. The verdict column is one of:

| | |
|---|---|
| `PASS` / `FAIL` | Judged. The overall verdict is FAIL if any row failed. |
| `INFO` | Recorded, not judged — firmware versions, battery level, setup and cleanup steps. |
| `SKIP` | Not applicable, with the reason in the Measured column (for example, a boolean parameter has no range to test). |

The report header carries a table of the three modules — Service Module, HMI and Motor
Controller — with the firmware version and the serial number of each, followed by the Serial
API version, the battery level, the settings found before the run, and the duration. A serial
number the chair cannot supply is shown as `-`; the HMI and Motor Controller numbers come over
the internal bus, so they are requested up to three times before being given up on.

### Full, Light and Legacy

A light inspection asks "does every command work", a full one asks "does every command handle
every value". Light keeps, per parameter, **the middle value and the first out-of-range value**,
so an accepted and a rejected value are still exercised, and it leaves out:

- the minimum, maximum and below-range values of every parameter
- eight of the nine `SetSpeedProfile` parameters (`F_M1` stands in for the rest)
- the 10 ms and 1000 ms send intervals
- the motor cases other than forward maximum, reverse maximum and turn maximum
- the second horn check (that values other than 1 stay silent)
- the check that `SetJoystick` is really blocked while paused - it costs two drives
- the out-of-range `SetPower` values and the `2` / `255` unlock variants
- the "not applicable" SKIP notes, which explain the shape of a full report

Everything else is identical, including the pass / fail rules and the restore afterwards.

**Legacy** is for a chair that predates this Serial API and has only these six commands:

| | |
|---|---|
| `0x00` StartSendingData | `0x03` SetJoystick |
| `0x01` StopSendingData | `0x04` SetSpeedProfile |
| `0x02` SetPower | `0x08` SetVelocity |

It uses the same case set as light, but **nothing outside those six is ever sent** - no
`GetIdentification`, `GetSettings` or `GetCapability`, so there is no firmware / serial number
table and no settings to save and restore. The power state is judged the only way such a chair
allows: `SetPower` ON must return the power-on response `0x52` **and** Dataset1 must start
flowing, and after `SetPower` OFF the stream must stop, because state data is sent only while
the power is on. The stage numbers follow the full sequence, so the gaps in them show what a
legacy chair cannot be checked for.

### What is checked

| Command | Checked with |
|---|---|
| `0x00` StartSendingData | Measured frame rate at 10 / 100 / 1000 ms, data set selection, three out-of-range values |
| `0x01` StopSendingData | No frame arrives for 1200 ms |
| `0x02` SetPower | Power-on response `0x52`, `GetSettings` |
| `0x03` SetJoystick | Peak motor speed against the speed profile |
| `0x04` SetSpeedProfile | Read back with Dataset0 — 9 parameters × 5 values, plus the speed mode field |
| `0x08` SetVelocity | Peak motor speed against the commanded velocity |
| `0x09` SetDeviceLock | `GetSettings`; also that locking cuts the power and blocks SetPower ON |
| `0x0A` SetJoystickPause | `GetSettings`; also that SetJoystick stops driving while paused |
| `0x0B` SetMaxSpeedLevel | `GetSettings` (clamped into 1–4) |
| `0x0C` SetSpeedLevel | `GetSettings`, with the power off |
| `0x0D` SoundHorn | By ear — the only check that needs a person |
| `0x0E` SetAutoPowerOff | `GetSettings` |
| `0x0F` GetSettings | The response itself, and every field inside its documented range |
| `0x10` GetCapability | Version and both bitmaps against Serial API 1.1 |

`GetIdentification` (`0x07`) is not a published command, so it is used to record the module
firmware versions (`D0=0`) and serial numbers (`D0=1` Service Module, `2` HMI, `3` Motor
Controller) but is not judged. A serial number response reuses command `0x07` and echoes the
target in the first payload byte: `AF [len] 07 [type] [ASCII characters] [checksum]`, with no
terminator, and a length of zero when the number is unavailable.

---

## Part 2 — Maintaining it

### Files

```
docs/cr2/tester/
├── index.html                 The published tester. Carries the add-on hooks and the loader.
└── inspection.js              This add-on. Everything else lives here.

tools/cr2-inspection/
├── README.md                  This file.
└── tests/
    ├── load.js                Loads both files into a Node vm on a DOM stub
    ├── simulator.js           A WHILL that follows the specification
    ├── run.js                 Unit tests
    └── dryrun.js              The whole sequence against the simulator
```

### How the add-on attaches to the tester

The tester defines one extension point and a loader. Nothing else in it knows the
inspection exists:

```js
const testerAddons = {
  onReceive: [],                 // called with every received chunk
  onConnectionChange: [],        // called with true on connect, false on disconnect
  suppressRawLog: () => false,   // an add-on can silence the per-chunk receive log
};

const TESTER_ADDONS = { inspection: 'inspection.js' };
```

`inspection.js` is a plain script, so it shares the tester's top-level scope. It injects its
own stylesheet, tab button and tab, then registers with the hooks above. Every name it
defines is prefixed `insp` / `INSP_`.

**The contract** — the add-on depends on these names from the tester. They are listed in
`INSP_TESTER_CONTRACT` at the top of `inspection.js` and checked when it installs; if one is
missing it logs an error and adds nothing to the page.

| | |
|---|---|
| `testerAddons` | The extension point above |
| `port`, `isConnected` | The Web Serial port and the connection flag |
| `appendLog`, `formatHexBytes` | Logging |
| `getJapanTimeString`, `getJapanTimeStringForFilename` | Timestamps |
| `switchTab` | Tab switching — it must keep resolving a tab by `<name>-tab` and by its `onclick` attribute |
| `stopJoystickContinuousSending`, `stopVelocityContinuousSending`, `stopJoystickInterval` | Stopped before a run so manual controls cannot fight it |
| `.tab-buttons`, `.shell-content` | The two elements the add-on injects into |

### After changing the tester, run the tests

```bash
node tools/cr2-inspection/tests/run.js               # about 2 s
node tools/cr2-inspection/tests/dryrun.js            # light inspection, about 35 s
node tools/cr2-inspection/tests/dryrun.js --full     # full inspection, about 85 s
node tools/cr2-inspection/tests/dryrun.js --legacy   # legacy inspection, about 25 s
```

Both read `docs/cr2/tester/index.html` and `inspection.js` directly, so they always test what
is actually published. Expected output:

- `run.js` → `82 passed / 0 failed`
- `dryrun.js` → `39 rows / PASS 30 / FAIL 0 / INFO 9 / SKIP 0` and `Dry run OK`
- `dryrun.js --full` → `128 rows / PASS 107 / FAIL 1 / INFO 11 / SKIP 9` and `Dry run OK`
- `dryrun.js --legacy` → `21 rows / PASS 15 / FAIL 0 / INFO 6 / SKIP 0` and `Dry run OK`

Run all three after a change: the expected row count is asserted, so a sequence that quietly
stops short is caught. The legacy run additionally simulates a chair that **ignores** every
command outside its six, and fails if the inspection sent one.

The one failure in the full dry run is expected: the 10 ms interval check measures Node's timer
granularity rather than a serial line. On real hardware it measures 9.9 ms and passes.
`dryrun.js` ignores that row and exits non-zero for anything else. A light inspection does not
test that interval, so it comes back clean.

If the contract breaks, `dryrun.js` fails immediately with the missing names.

### Tuning constants

All at the top of `inspection.js`. These are the ones worth touching:

| Constant | Value | Meaning |
|---|---|---|
| `INSP_DRIVE_MS` | 4000 | How long each motor command is driven |
| `INSP_DRIVE_PERIOD_MS` | 60 | How often it is repeated |
| `INSP_PLATEAU_MS` | 2000 | Tail window the peak speed is taken from |
| `INSP_SPEED_TOL` | 0.05 | Tolerance against the target speed |
| `INSP_COOLDOWN_MS` | 2500 | Upper bound on the coast-down wait between cases |
| `INSP_STOP_KMH` / `INSP_STOP_HOLD_MS` | 0.05 / 300 | When the wheels count as stopped |
| `INSP_PROFILE_SETTLE_MS` | 300 | Wait before reading a speed profile back |
| `INSP_MIN_BATTERY` | 20 | Abort below this battery level |
| `INSP_IGNORED_ERRORS` | `[7, 63]` | Dataset1 error codes that must not abort the run |

A run took 4 min 24 s with a 6 s drive time and a fixed 2.5 s coast-down wait; it takes about
3 min 15 s with the values above. Shorten `INSP_DRIVE_MS` further only with care — the slowest
cases to settle are the turns, and the peak speed has to be reached inside the tail window.

### How the judgements work

A full inspection exercises every parameter with five values: **below range / minimum / middle /
maximum / above range**; a light one keeps the middle and the above-range value. Two cases fall
away by nature and are reported as SKIP (a light report leaves these notes out):

- A boolean parameter (`1` acts, anything else does not) has no range. Those commands are
  checked with `0 / 1 / 2 / 255` instead.
- A parameter whose lower bound is 0 has no representable below-range value.

The motor commands are the exception: they are driven for `INSP_DRIVE_MS` and pass when the
**peak** speed over the last `INSP_PLATEAU_MS` is within 5 % of the target. Forward speed is the
average of the two wheels; a turn command expresses the *difference* between them, so the
observed turn speed is that difference, not half of it. Which way a positive left/right input
turns the chair is not specified, so a turn is judged on magnitude and the direction is checked
separately from a left/right pair.

The sign convention of the two motor speeds is measured at the start of the motor stage, because
the right motor reads the opposite sign of the left when driving forward on this firmware.

### Known differences between the specification and the firmware

**`T_A1` (turn acceleration) accepts values above the documented 60.** The specification says
10–60. The Service Module allows 10–90
(`IoT_Module/app/middleware/mrp_interface/src/private/mrp_control_command.c`,
`OnSetSpeedProfileCommand`, in the Service Module repository) and the Motor Controller allows
10–100 (`application/speed_profile.c`, `speed_profile_upper_limit`, in the Motor Controller
repository), so the effective limit is 90 and `T_A1=61` is accepted. The
above-range case is recorded as SKIP rather than judged, via `skipHighOut` on that parameter.
Remove it once the specification and the firmware are aligned.

**Error codes 7 and 63 are ignored.** 7 is "calibration incomplete"; 63 is
`ERR_CODE_MC_SPEED_PROFILE_ERROR`, which the inspection raises deliberately every time it sends
an out-of-range profile. Any other non-zero error code aborts the run.

**The speed profile upper limits are per speed mode.** The Motor Controller holds a table
indexed by speed mode, and some modes already sit at their ceiling — the BLE profile's
`20 24 72 …` *is* its upper limit. The speed mode test therefore writes each mode its own
current values with one parameter moved **down** by one; the lower limits are common to every
mode, so that is in range whatever the mode. Moving it up would be rejected on the BLE profile.
