<p align="center">
  <img src="docs/images/whill_logo.svg" alt="WHILL" width="100">
</p>
<h1 align="center">
  WHILL Serial API
</h1>

<p align="center">
  The serial (RS232C) command and data interface of <b>WHILL</b> products, provided by WHILL, Inc.<br>
  Part of the <a href="https://whill-mrp.notion.site/WHILL-Mobile-Robot-Platform-97930066f5f64529bb83883aafef0c3b">WHILL Mobile Robot Platform (MRP)</a>.
</p>

<p align="center">
  <a href="https://whill.github.io/whill-serial-api/"><b>whill.github.io/whill-serial-api</b></a>
</p>

---

## Products

### [Model CR2](https://whill.github.io/whill-serial-api/cr2/)

Covers Model CR2, Wheeled Robot Base and Electrical System Kit. Two-wheel drive with a single RS232C interface and the full command set.

| | |
|---|---|
| [**Specification**](https://whill.github.io/whill-serial-api/cr2/spec/) | Frame format, control commands, state data, timing and connector pinout. Markdown source: [`docs/cr2/spec/`](docs/cr2/spec/WHILL_Serial_API_Specification.md) |
| [**Tester**](https://whill.github.io/whill-serial-api/cr2/tester/) | Send commands to a real WHILL and watch the returned state data live. |
| [**Emulator**](https://whill.github.io/whill-serial-api/cr2/emulator/) | Emulates a WHILL device — parses host commands and serves Dataset0 / Dataset1, so you can develop without hardware. |

### [Omni Platform](https://whill.github.io/whill-serial-api/omni/)

Two Model CR2 drive units mounted at 90° to each other, making the platform holonomic — it moves in any direction without changing the direction the wheels point. Controlled through two RS232C interfaces driven in sync, with a reduced command set.

| | |
|---|---|
| [**Specification**](https://whill.github.io/whill-serial-api/omni/spec/) | Companion document to the Model CR2 specification — the two interfaces, the motion model, the command set and the extended `SetVelocity` range. Markdown source: [`docs/omni/spec/`](docs/omni/spec/WHILL_Serial_API_Specification_Omni.md) |
| [**Tester**](https://whill.github.io/whill-serial-api/omni/tester/) | Drives both RS232C interfaces from one browser window — virtual joystick for translation, hold-to-rotate buttons, per-unit status and an interleaved two-unit log. |

## Requirements

| | |
|---|---|
| **Browser** | Chrome or Edge (Web Serial API — Safari and Firefox are not supported) |
| **Transport** | RS232C, 38400 bps, 8-N-2 |
| **Connector** | D-sub 9-pin |

The tester and emulator run entirely in the browser. No installation, no driver, no account.

> Wheeled Robot Base and Electrical System Kit share the software specification of Model CR2 — every "Model CR2" description applies to them.

## Offline use

Each tool is a **single self-contained HTML file** with no external dependency. Use the *Download* link on the [site](https://whill.github.io/whill-serial-api/) to save it with a version-stamped filename (e.g. `WHILL_Serial_API_Tester_CR2_v1.01.html`), then open it from a local disk — it works on an isolated network with no internet access.

Your data never leaves your machine: the tools communicate only between the browser and the WHILL over the serial port.

## Repository layout

```
docs/                       GitHub Pages root (Settings → Pages → main / docs)
├── index.html              Product selector
├── images/                 Shared assets (the WHILL logo)
├── cr2/
│   ├── index.html          Model CR2 landing page
│   ├── spec/               Markdown source + exported index.html
│   ├── tester/index.html   Single self-contained file
│   └── emulator/index.html Single self-contained file
└── omni/
    ├── index.html          Omni Platform landing page
    ├── spec/               Markdown source + exported index.html
    └── tester/index.html   Single self-contained file
```

Each product gets its own directory under `docs/`. A new product is added as a sibling of `cr2/` — **never as a branch**, because GitHub Pages publishes only one branch and a second branch would not be served at all.

`docs/cr2/spec/index.html` is exported from `WHILL_Serial_API_Specification.md`. When updating the specification, edit the Markdown, re-export, and commit both.

## Local preview

```bash
python -m http.server 8000 --directory docs
```

Then open <http://localhost:8000/>. `localhost` counts as a secure origin, so the Web Serial API works and the tools can be tested against real hardware before merging.

## License

Released under the MIT License. See [LICENSE](LICENSE).
