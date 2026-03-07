# Sonic Pi for VS Code — User Manual

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Editor Features](#editor-features)
4. [Connection](#connection)
5. [Commands Reference](#commands-reference)
6. [Configuration Reference](#configuration-reference)
7. [Tutorial Guide](#tutorial-guide)
8. [Examples Guide](#examples-guide)
9. [Recording](#recording)
10. [Language Reference](#language-reference)
11. [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites

- **VS Code** 1.85 or later
- **Sonic Pi** v4.x installed and running on your machine
  - Download from [sonic-pi.net](https://sonic-pi.net)
  - macOS, Windows, and Linux are supported

### Installing the Extension

1. Open VS Code
2. Go to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"Sonic Pi for VS Code"**
4. Click **Install**

Alternatively, install from the command line:

```bash
code --install-extension bamr87.vs-sonic-pi
```

---

## Quick Start

**Your first sound in 60 seconds:**

1. Make sure Sonic Pi is running (open the Sonic Pi application)
2. Create a new file called `hello.spi` in VS Code
3. Type:
   ```ruby
   play 60
   sleep 0.5
   play 64
   sleep 0.5
   play 67
   ```
4. Press **F5** to run — you'll hear a C major chord arpeggiated!
5. Press **Shift+F5** to stop all sounds

The extension auto-connects to Sonic Pi when you open a `.spi` file. If connection fails, check that Sonic Pi is running and see the [Troubleshooting](#troubleshooting) section.

---

## Editor Features

### Syntax Highlighting

Files with `.spi` or `.sonicpi` extensions get full syntax highlighting:

- **Keywords**: `live_loop`, `with_fx`, `in_thread`, `do`/`end`
- **Functions**: `play`, `sample`, `sleep`, `synth`, `use_synth`
- **Synth names**: `:prophet`, `:tb303`, `:blade`
- **Sample names**: `:ambi_choir`, `:drum_bass_hard`
- **FX names**: `:reverb`, `:distortion`, `:echo`
- **Numbers, strings, symbols, comments**

### IntelliSense (Autocompletion)

Context-aware completions appear as you type:

| Context | Trigger | What You Get |
|---------|---------|-------------|
| `use_synth :` | After `:` | All 43 synth names |
| `sample :` | After `:` | All 96 sample names with categories |
| `with_fx :` | After `:` | All 34 FX names |
| `scale :C, :` | After second `:` | 150 scale names |
| `chord :C, :` | After second `:` | 70 chord names |
| `play :` | After `:` | Note names (C0–B8) with MIDI numbers |
| After a comma | `,` | Synth/FX option names |
| Anywhere | Typing | 163 function names |

### Hover Documentation

Hover over any Sonic Pi element to see rich documentation:

- **Synths/FX**: Description, full options table with defaults and slidability
- **Samples**: Category information
- **Scales**: Interval pattern
- **Chords**: Interval pattern
- **Notes**: MIDI number
- **Functions**: Description, arguments, options, and code examples

### Snippets

31 built-in snippets for common patterns. Type the prefix and press Tab:

| Prefix | Expands To |
|--------|-----------|
| `ll` | `live_loop` block |
| `fx` | `with_fx` block |
| `pl` | `play` with note |
| `sa` | `sample` with name |
| `sl` | `sleep` |
| `it` | `in_thread` block |
| `sy` | `synth` with name |
| `lp` | `loop` block |

### Diagnostics

Runtime errors and syntax errors from Sonic Pi appear directly in VS Code:

- Inline squiggly underlines on the error line
- Entries in the **Problems** panel (`Ctrl+Shift+M`)
- Errors clear when you edit the file

---

## Connection

### Auto-Connect

By default, the extension automatically connects to Sonic Pi when you open a `.spi` file. This can be disabled in settings (`sonicpi.autoConnect`).

### Manual Connect

1. Click the **Sonic Pi** status bar item (bottom-left), or
2. Run **Sonic Pi: Connect** from the Command Palette (`Ctrl+Shift+P`)

### How Connection Works

The extension communicates with Sonic Pi over OSC (Open Sound Control) via UDP:

1. **Port Discovery**: The extension looks for Sonic Pi's daemon process and discovers its dynamically assigned ports
2. **Authentication**: A token is exchanged to authenticate the connection
3. **Heartbeat**: Keep-alive messages are sent every 2 seconds (configurable) to prevent Sonic Pi from shutting down the connection
4. **Ping/Ack**: An initial handshake verifies the connection is live

### Connection States

The status bar shows the current state:

| Icon | State | Meaning |
|------|-------|---------|
| `$(plug)` | Disconnected | Not connected — click to connect |
| `$(sync~spin)` | Connecting | Handshake in progress |
| `$(check)` | Connected | Ready to play! |

---

## Commands Reference

All commands are available from the Command Palette (`Ctrl+Shift+P`).

| Command | Keybinding | Description |
|---------|-----------|-------------|
| **Sonic Pi: Run** | `F5` | Run the current buffer |
| **Sonic Pi: Run Selection** | `Ctrl+F5` / `Cmd+F5` | Run only the selected code |
| **Sonic Pi: Stop** | `Shift+F5` | Stop all running jobs |
| **Sonic Pi: Connect** | — | Connect to Sonic Pi |
| **Sonic Pi: Disconnect** | — | Disconnect from Sonic Pi |
| **Sonic Pi: Open Examples** | — | Browse and open bundled examples |
| **Sonic Pi: Open Tutorial** | — | Open the built-in tutorial |
| **Sonic Pi: Beautify Buffer** | — | Auto-format the current buffer |
| **Sonic Pi: Start Recording** | — | Begin recording audio output |
| **Sonic Pi: Stop Recording** | — | Stop recording |
| **Sonic Pi: Save Recording** | — | Save the recording as a WAV file |

---

## Configuration Reference

All settings are under the `sonicpi.*` namespace.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sonicpi.osc.host` | string | `127.0.0.1` | IP address of the Sonic Pi server |
| `sonicpi.osc.sendPort` | number | `4557` | UDP port to send OSC commands |
| `sonicpi.osc.listenPort` | number | `4558` | UDP port to listen for responses |
| `sonicpi.osc.daemonPort` | number | `0` | Daemon port (0 = auto-discover) |
| `sonicpi.autoConnect` | boolean | `true` | Auto-connect when a .spi file opens |
| `sonicpi.heartbeatInterval` | number | `2000` | Milliseconds between heartbeats |
| `sonicpi.sonicPiPath` | string | `""` | Path to Sonic Pi (empty = auto-detect) |
| `sonicpi.logLevel` | string | `info` | Minimum log level: debug, info, warning, error |

### Example: Custom Sonic Pi Path

If Sonic Pi is installed in a non-standard location:

```json
{
  "sonicpi.sonicPiPath": "/opt/sonic-pi"
}
```

### Example: Verbose Logging

```json
{
  "sonicpi.logLevel": "debug"
}
```

---

## Tutorial Guide

The extension bundles the complete Sonic Pi tutorial — 85 chapters covering everything from your first beep to multichannel audio.

### Opening the Tutorial

- **Sidebar**: Click the Sonic Pi icon in the Activity Bar to see the tutorial tree
- **Command**: Run **Sonic Pi: Open Tutorial** from the Command Palette
- **Walkthrough**: Use **Help > Get Started** and select "Getting Started with Sonic Pi"

### Tutorial Sections

| Section | Topic | Chapters |
|---------|-------|----------|
| 01 | Welcome to Sonic Pi | Introduction and interface |
| 02 | Synths | Playing notes, parameters, envelopes |
| 03 | Samples | Playing and manipulating samples |
| 04 | Randomisation | Random values and seeds |
| 05 | Programming Structures | Loops, conditionals, threads |
| 06 | FX | Audio effects |
| 07 | Control | Controlling running synths |
| 08 | Data Structures | Rings, lists, maps |
| 09 | Live Coding | Live loops and performance |
| 10 | State | Shared state between threads |
| 11 | MIDI | MIDI input and output |
| 12 | OSC | Open Sound Control messages |
| 13 | Multichannel Audio | Multi-output audio |
| A | Articles | In-depth articles |
| B | Essential Knowledge | Music theory basics |

---

## Examples Guide

The extension includes 55 example files organized by difficulty:

### Browsing Examples

1. Run **Sonic Pi: Open Examples** from the Command Palette
2. Select an example from the quick pick menu
3. The file opens in the editor — press F5 to hear it!

### Example Categories

- **Apprentice**: Simple melodies, basic synths, first loops
- **Illusionist**: Intermediate patterns, FX chains, rhythms
- **Magician**: Advanced techniques, algorithmic composition
- **Wizard**: Complex live coding, generative music

---

## Recording

### Recording Workflow

1. Connect to Sonic Pi
2. Run **Sonic Pi: Start Recording**
3. Run your code (F5) — all audio output is captured
4. Run **Sonic Pi: Stop Recording** when done
5. Run **Sonic Pi: Save Recording** and choose a location
6. The recording is saved as a WAV file

---

## Language Reference

### Scales

150 scales are available, including Western, pentatonic, and Turkish makam scales:

```ruby
play_pattern_timed scale(:C4, :major), 0.25
play_pattern_timed scale(:C4, :minor_pentatonic), 0.25
play_pattern_timed scale(:C4, :blues_minor), 0.25
```

### Chords

70 chord types:

```ruby
play chord(:C4, :major)    # [60, 64, 67]
play chord(:C4, :minor7)   # [60, 63, 67, 70]
play chord(:C4, :dim7)     # [60, 63, 66, 69]
```

### Notes

Notes can be specified as symbols or MIDI numbers:

```ruby
play :C4     # MIDI 60 (middle C)
play :A4     # MIDI 69 (concert A)
play :Eb3    # MIDI 51
play 60      # Same as :C4
```

---

## Troubleshooting

### "Not connected to Sonic Pi"

- Make sure the Sonic Pi application is running
- Try **Sonic Pi: Connect** from the Command Palette
- Check that no other VS Code window is already connected

### Connection Fails Immediately

- Sonic Pi may be using different ports. Check the Sonic Pi log for port numbers
- Try setting `sonicpi.osc.sendPort` and `sonicpi.osc.listenPort` manually

### EADDRINUSE Error

Another process is using the listen port:

- Close other Sonic Pi-connected editors
- Change `sonicpi.osc.listenPort` to a different value

### No Sound After Running

- Check that Sonic Pi's audio is not muted
- Look at the **Sonic Pi Log** output channel for errors
- Verify your code is valid (check the Problems panel)

### Sonic Pi Path Not Found

If auto-detection fails:

- Set `sonicpi.sonicPiPath` to your Sonic Pi installation directory
- macOS default: `/Applications/Sonic Pi.app/Contents/Resources`
- Windows default: `C:\Program Files\Sonic Pi`
- Linux: depends on installation method

### Extension Not Activating

- Ensure the file has a `.spi` or `.sonicpi` extension
- Check the VS Code Developer Console (`Help > Toggle Developer Tools`) for errors
