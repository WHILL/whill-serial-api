# Changelog

Version history of the specifications and tools published in this repository.
Each specification also carries its own revision table in its final section.

## v1.0.0 — 2026-09-01

### Model CR2 — Specification
- Rev 1 (2026-09-01) — initial release, covering Serial API 1.1.

### Model CR2 — Tester / Emulator
- v1.01 — first public release.
- Favicon is now embedded in the file, so the tools have no external dependency and render correctly offline.

### Omni Platform — Specification
- Rev 1 (2026-09-01) — initial public release, covering Serial API 1.1 on the Omni Platform. Written as a companion to the Model CR2 specification, and derived from the internal document *WHILL Control System Protocol Specification for Omni Platform* Rev 6.
- `SetJoystick` (`0x03`), `SetSpeedProfile` (`0x04`), `SetMaxSpeedLevel` (`0x0B`) and `SetSpeedLevel` (`0x0C`) are documented as not supported: their acceleration profile is tuned for a rider being carried and is unsuitable for coordinated translation.
- `SetVelocity` (`0x08`) is documented with the Omni parameter range of −1500 … 1500 on both axes, widened from the Model CR2 so that the platform moves sideways and rotates as fast as it moves forward.


### Omni Platform — Tester
- v1.01 — first release. Drives both interfaces on one 100 ms cycle, all writes issued to the two ports in parallel: virtual joystick for translation, hold-to-rotate buttons, and a Swap A/B button that re-assigns the two ports without reconnecting.
- Translation and rotation are exclusive. The speed sliders default to 50 / 50 and cap at 150, matching the scale of the hardware-verified reference tool; the drag starts on the knob so a stray click cannot command near-full deflection.
- `SetPower` ON is sent in sets of two frames 100 ms apart, repeated for one second, so a sleeping unit's discarded wake-up frame does not lose the command.
- Stops on release, on Space, on loss of window focus, and when either interface fails.
- Status is shown per unit with a platform-level summary that takes the lower battery and flags any power / error / device-lock mismatch between the two units.
- One interleaved log tagged per unit, with filters and periodic-frame suppression; CSV export gains a `Unit` column.

### Repository
- Everything is served from `docs/` via GitHub Pages.
- The site is laid out per product (`docs/cr2/`, `docs/omni/`) with a product selector at the root. A further product is added as a sibling directory on the same branch.
