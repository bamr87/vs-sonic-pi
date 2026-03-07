# Sonic Pi for VS Code

**Code. Music. Live.** — Write and perform [Sonic Pi](https://sonic-pi.net) music directly from VS Code.

---

## Features

### Syntax Highlighting & IntelliSense

Full language support for `.spi` files with context-aware autocompletion for **43 synths**, **96 samples**, **34 FX**, **150 scales**, **70 chords**, and **163 functions**.

### Run & Stop with Keybindings

Press **F5** to run your code, **Shift+F5** to stop. Run just a selection with **Ctrl+F5** (Cmd+F5 on macOS).

### Rich Hover Documentation

Hover over any synth, sample, FX, scale, chord, note, or function to see detailed documentation with options tables and code examples.

### Built-in Tutorial

The complete **85-chapter Sonic Pi tutorial** is built right into the extension. Browse chapters in the sidebar tree view or read them in a styled webview panel.

### Live Connection to Sonic Pi

Connects to a running Sonic Pi instance over OSC with automatic port discovery, authentication, and heartbeat keep-alive. The status bar shows your connection state at a glance.

### Error Diagnostics

Sonic Pi runtime errors and syntax errors appear inline in the editor and in the Problems panel — no need to switch windows.

### 55 Bundled Examples

Browse and open examples organized by difficulty: Apprentice, Illusionist, Magician, and Wizard.

### Audio Recording

Start, stop, and save audio recordings as WAV files — all from within VS Code.

### Code Snippets

31 snippets for common patterns like `live_loop`, `with_fx`, `play`, `sample`, and more.

---

## Quick Start

1. **Install Sonic Pi** from [sonic-pi.net](https://sonic-pi.net)
2. **Open Sonic Pi** (the application must be running)
3. **Create a `.spi` file** in VS Code
4. **Write some code:**
   ```ruby
   live_loop :beat do
     sample :drum_bass_hard
     sleep 0.5
   end
   ```
5. **Press F5** to hear your music!

The extension auto-connects to Sonic Pi when you open a `.spi` file.

---

## Requirements

- **VS Code** 1.109+
- **Sonic Pi** v4.x running on the same machine

---

## Keybindings

| Keybinding | Command |
|-----------|---------|
| `F5` | Run buffer |
| `Shift+F5` | Stop all |
| `Ctrl+F5` / `Cmd+F5` | Run selection |

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `sonicpi.autoConnect` | `true` | Auto-connect on file open |
| `sonicpi.osc.host` | `127.0.0.1` | Sonic Pi server address |
| `sonicpi.osc.sendPort` | `4557` | OSC send port |
| `sonicpi.osc.listenPort` | `4558` | OSC listen port |
| `sonicpi.heartbeatInterval` | `2000` | Keep-alive interval (ms) |
| `sonicpi.sonicPiPath` | `""` | Custom Sonic Pi path |
| `sonicpi.logLevel` | `info` | Log verbosity |

See the full [User Manual](docs/user-manual.md) for detailed configuration examples.

---

## Commands

Open the Command Palette (`Ctrl+Shift+P`) and type "Sonic Pi" to see all available commands:

- **Run** / **Run Selection** / **Stop**
- **Connect** / **Disconnect**
- **Open Tutorial** / **Open Examples**
- **Beautify Buffer**
- **Start Recording** / **Stop Recording** / **Save Recording**

---

## Tutorial

The extension includes the complete Sonic Pi tutorial:

1. Click the **Sonic Pi** icon in the Activity Bar
2. Browse chapters in the tree view
3. Click a chapter to read it in a styled webview

Topics covered: synths, samples, FX, randomisation, programming structures, live coding, data structures, state, MIDI, OSC, multichannel audio, and more.

---

## Contributing

Contributions are welcome! Please open an issue or pull request on [GitHub](https://github.com/bamr87/vs-sonic-pi).

---

## License

This extension is licensed under the [MIT License](LICENSE).

Tutorial content is derived from the [Sonic Pi](https://sonic-pi.net) project by Sam Aaron, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

---

## Acknowledgments

- [Sonic Pi](https://sonic-pi.net) by Sam Aaron — the live coding music synthesizer that makes this extension possible
- The Sonic Pi community for the incredible documentation and examples
