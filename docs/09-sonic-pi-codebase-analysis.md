# Sonic Pi Codebase Analysis — Libraries & Components for Extension Integration

**Source:** [bamr87/sonic-pi](https://github.com/bamr87/sonic-pi) (fork of [sonic-pi-net/sonic-pi](https://github.com/sonic-pi-net/sonic-pi))  
**Branch:** `dev`  
**Sonic Pi version:** v4.6.0 "Tuplet"

---

## Table of Contents

1. [Repository Overview](#1-repository-overview)
2. [Daemon & Boot Protocol](#2-daemon--boot-protocol)
3. [Spider Server — OSC API (Definitive)](#3-spider-server--osc-api-definitive)
4. [Ruby DSL — Function Definitions](#4-ruby-dsl--function-definitions)
5. [Synth, Sample & FX Metadata](#5-synth-sample--fx-metadata)
6. [Cheatsheets — Parseable Documentation](#6-cheatsheets--parseable-documentation)
7. [Snippets — Convertible to VS Code Format](#7-snippets--convertible-to-vs-code-format)
8. [Examples — Bundleable Content](#8-examples--bundleable-content)
9. [Tutorial — Bundleable Content](#9-tutorial--bundleable-content)
10. [GUI Internals — Protocol Reference](#10-gui-internals--protocol-reference)
11. [Tau (Erlang/BEAM) — Routing Layer](#11-tau-erlangbeam--routing-layer)
12. [Config Formats](#12-config-formats)
13. [Theme & i18n Data](#13-theme--i18n-data)
14. [Integration Matrix](#14-integration-matrix)
15. [Recommended Extraction Pipeline](#15-recommended-extraction-pipeline)

---

## 1. Repository Overview

```
sonic-pi/
├── app/
│   ├── api/              C++ API layer (OSC protocol, IAPIClient interface)
│   ├── gui/              Qt/C++ GUI (editor, log, widgets, themes, i18n)
│   ├── server/
│   │   ├── ruby/         Ruby server (daemon, spider, DSL runtime, synthinfo)
│   │   ├── beam/         Tau — Erlang/Elixir OSC router, Phoenix web UI
│   │   └── native/       Native C extensions
│   ├── config/           User config templates (init.rb, audio-settings.toml)
│   ├── external/         External libs (aubio, sp_link, sp_midi)
│   └── cmake/            Build system
├── etc/
│   ├── doc/              Cheatsheets (synths.md, fx.md, samples.md), tutorial, i18n
│   ├── examples/         34 example .rb files across 7 skill levels
│   ├── snippets/         12 .sps snippet files
│   ├── samples/          206 .flac audio files
│   ├── synthdefs/        SuperCollider .scd and Clojure .clj synth designs
│   ├── buffers/          Noise buffer .wav files
│   └── wavetables/       AKWF wavetable data
├── bin/                  Build scripts
├── prebuilt/             Prebuilt binaries
└── install/              Installer scripts
```

**Total:** ~36,400 files. The areas relevant to the extension are a small subset.

---

## 2. Daemon & Boot Protocol

**File:** `app/server/ruby/bin/daemon.rb` (1,574 lines)

This is the most critical file for understanding how to connect to Sonic Pi. The daemon is the entry point that boots all backend processes.

### What it does

1. Discovers free ports for all internal services.
2. Boots **scsynth** (SuperCollider audio engine).
3. Boots **Tau** (Erlang/BEAM OSC router).
4. Boots **Spider** (Ruby runtime server).
5. Prints port map and auth token to **STDOUT**.
6. Enters a keep-alive loop (zombie kill switch).

### STDOUT Output Format (Line 258)

The daemon prints a single line to STDOUT with space-separated values:

```
{daemon} {gui-listen-to-spider} {gui-send-to-spider} {scsynth} {osc-cues} {tau-api} {tau-phx} {token}
```

| Position | Name | Extension use |
|----------|------|---------------|
| 0 | `daemon` | Port for `/daemon/keep-alive` and `/daemon/exit` |
| 1 | `gui-listen-to-spider` | **Extension binds here** to receive logs/errors |
| 2 | `gui-send-to-spider` | **Extension sends here** for `/run-code`, `/stop-all-jobs`, etc. |
| 3 | `scsynth` | SuperCollider port (informational) |
| 4 | `osc-cues` | External OSC cue port (informational) |
| 5 | `tau-api` | Tau API port (informational) |
| 6 | `tau-phx` | Tau Phoenix HTTP port (informational) |
| 7 | `token` | **Auth token** — must be the first arg in every OSC message |

### Auth Token (Critical Discovery)

**Every OSC message sent to the Spider server must include the token as the first argument.** This was not documented in the wiki but is enforced in the source code. The token is a random 32-bit signed integer generated at boot.

```ruby
# daemon.rb line 144
@daemon_token = rand(-2147483647..2147483647)
```

```ruby
# spider-server.rb line 286-294
server.add_method("/run-code") do |args|
  incoming_token = args[0]
  if incoming_token == token
    code = args[1].force_encoding("utf-8")
    sp.__spider_eval code
  end
end
```

**Impact on extension:** The extension must capture the token from the daemon's STDOUT (if spawning) or from a token file (if connecting to an already-running instance). Without the correct token, all commands are silently ignored.

### Zombie Kill Switch

- Keep-alive messages must be sent to the **daemon port** (position 0), not the spider port.
- Path: `/daemon/keep-alive`
- First arg: the token
- Frequency: more often than every 3 seconds (daemon.rb line 71)
- Timeout: if no keep-alive received, daemon kills all child processes.

### Extension integration

| What | How |
|------|-----|
| **Spawn daemon** | `ruby app/server/ruby/bin/daemon.rb` |
| **Capture ports** | Parse single STDOUT line, split on spaces |
| **Capture token** | 8th value from STDOUT line |
| **Keep alive** | Send `/daemon/keep-alive` with `[token]` to daemon port every ~2s |
| **Graceful exit** | Send `/daemon/exit` with `[token]` to daemon port |

---

## 3. Spider Server — OSC API (Definitive)

**File:** `app/server/ruby/bin/spider-server.rb` (843 lines)

The `register_api` lambda (line 277–730) defines every OSC endpoint. This is the **canonical, authoritative** API reference — more accurate than the wiki.

### Inbound API (Extension → Spider)

Every message takes `token` as `args[0]`.

| OSC Path | Args (after token) | Purpose |
|----------|-------------------|---------|
| `/run-code` | `code` | Evaluate code in a new thread |
| `/save-and-run-buffer` | `buffer_id`, `code`, `workspace` | Save buffer to git, then evaluate |
| `/save-buffer` | `buffer_id`, `code` | Save buffer only (no eval) |
| `/load-buffer` | `workspace_id` | Load buffer from disk |
| `/stop-all-jobs` | *(none)* | Kill all running threads |
| `/exit` | *(none)* | Shut down the server |
| `/ping` | `id` | Liveness check; server replies `/ack` with `id` |
| `/buffer-newline-and-indent` | `id`, `buf`, `point_line`, `point_index`, `first_line` | Auto-indent on newline |
| `/buffer-section-complete-snippet-or-indent-selection` | `id`, `buf`, `start_line`, `finish_line`, `point_line`, `point_index` | Tab completion / indent |
| `/buffer-indent-selection` | `id`, `buf`, `start_line`, `finish_line`, `point_line`, `point_index` | Indent selection |
| `/buffer-section-toggle-comment` | `id`, `buf`, `start_line`, `finish_line`, `point_line`, `point_index` | Toggle comment |
| `/buffer-beautify` | `id`, `buf`, `line`, `index`, `first_line` | Beautify/align buffer |
| `/start-recording` | *(none)* | Start audio recording |
| `/stop-recording` | *(none)* | Stop audio recording |
| `/delete-recording` | *(none)* | Delete temp recording |
| `/save-recording` | `filename` | Save recording to path |
| `/mixer-invert-stereo` | *(none)* | Invert stereo channels |
| `/mixer-standard-stereo` | *(none)* | Standard stereo |
| `/mixer-stereo-mode` | *(none)* | Stereo mode |
| `/mixer-mono-mode` | *(none)* | Mono mode |
| `/mixer-hpf-enable` | `freq` | Enable high-pass filter |
| `/mixer-hpf-disable` | *(none)* | Disable HPF |
| `/mixer-lpf-enable` | `freq` | Enable low-pass filter |
| `/mixer-lpf-disable` | *(none)* | Disable LPF |
| `/enable-update-checking` | *(none)* | Allow version checks |
| `/disable-update-checking` | *(none)* | Disallow version checks |
| `/version` | *(none)* | Request version info |
| `/midi-start` | *(none)* | Start MIDI subsystem |
| `/midi-stop` | *(none)* | Stop MIDI subsystem |
| `/midi-reset` | *(none)* | Reset MIDI |
| `/cue-port-external` | `enabled` | Enable/disable external OSC cues |
| `/cue-port-internal` | `enabled` | Enable/disable internal cues |
| `/cue-port-network` | `enabled` | Enable/disable network cues |
| `/set-global-timewarp` | `val` | Set global time warp |

### Outbound API (Spider → Extension)

Sent via the `gui` object (an OSC client pointing at `gui-listen-to-spider` port). Defined in the `out_t` thread (lines 559–630):

| OSC Path | Args | Purpose |
|----------|------|---------|
| `/log/multi_message` | `job_id`, `thread_name`, `runtime`, `N`, `(type, msg)...` | Log entries (main feedback channel) |
| `/log/info` | `msg` | Informational message |
| `/error` | `job_id`, `desc`, `backtrace`, `line` | Runtime error |
| `/syntax_error` | `job_id`, `desc`, `error_line`, `line`, `line_s` | Syntax error |
| `/buffer/replace` | `buffer_id`, `content`, `line`, `index`, `first_line` | Replace buffer (beautify response) |
| `/buffer/replace-idx` | `buffer_id` | Replace buffer by index |
| `/buffer/replace-lines` | `buffer_id`, `content`, `start_line`, `finish_line`, `point_line`, `point_index` | Replace lines (indent response) |
| `/buffer/run-idx` | `buffer_id` | Indicate which buffer is running |
| `/ack` | `id` | Response to `/ping` |
| `/version` | `version`, `protocol_version`, `latest_version`, `latest_version_num`, `update_url`, `platform` | Version info |
| `/runs/all-completed` | *(none)* | All jobs finished |
| `/exited` | *(none)* | Server exiting normally |
| `/exited-with-boot-error` | `msg` | Server failed to boot |

### Key differences from wiki

| Wiki says | Source code says |
|-----------|-----------------|
| `/multi_message` | Actually `/log/multi_message` |
| `/info` | Actually `/log/info` |
| `/replace-buffer` | Actually `/buffer/replace` |
| `/replace-lines` | Actually `/buffer/replace-lines` |
| No token needed | **Token is required** as first arg on every inbound message |
| `/error` args: `msg` | `/error` args: `job_id`, `desc`, `backtrace`, `line` |
| No `/syntax_error` | Separate `/syntax_error` path exists |

---

## 4. Ruby DSL — Function Definitions

### Core language functions

**File:** `app/server/ruby/lib/sonicpi/lang/core.rb`

| Function | Description |
|----------|-------------|
| `live_loop` | Named loop running in its own thread, hot-swappable |
| `in_thread` | Run block in a new thread |
| `at` | Schedule block at specific beat times |
| `sleep` | Wait for N beats |
| `cue` | Send a named cue event |
| `sync` | Wait for a named cue event |
| `define` | Define a named function |
| `stop` | Stop the current thread |
| `tick` / `look` | Ring counter |
| `puts` / `print` | User output (→ `/log/multi_message` type 1) |
| `use_bpm` / `with_bpm` | Set/scope tempo |
| `use_random_seed` | Set random seed |
| `tuplets` | Tuplet timing (v4.6+) |

### Sound functions

**File:** `app/server/ruby/lib/sonicpi/lang/sound.rb`

| Function | Description |
|----------|-------------|
| `play` | Trigger a note with the current synth |
| `play_pattern` / `play_pattern_timed` | Play sequences |
| `play_chord` | Play multiple notes simultaneously |
| `sample` | Play a built-in or external sample |
| `synth` | Trigger a specific synth by name |
| `use_synth` / `with_synth` | Set/scope the current synth |
| `with_fx` | Apply an effect to a block |
| `control` | Modify a running synth node |
| `kill` | Kill a running synth node |
| `synth_names` | Returns array of all synth name symbols |
| `fx_names` | Returns array of all FX name symbols |
| `sample_names` | Returns array of all sample name symbols |
| `sample_groups` | Returns hash of sample categories |
| `use_sample_bpm` | Set BPM from a sample's duration |
| `sample_duration` | Get a sample's duration in beats |
| `recording_start` / `recording_stop` / `recording_save` | Audio recording |

### Documentation system

**File:** `app/server/ruby/lib/sonicpi/lang/support/docsystem.rb`

Every DSL function is annotated with a `doc` macro that registers:
- `:name` — function name
- `:summary` — one-line description
- `:doc` — full documentation string
- `:args` — argument names and types
- `:opts` — optional keyword arguments with defaults
- `:examples` — code examples
- `:introduced` — version introduced

This data is stored in `@@docs` and used by `doc.rb` and `qt-doc.rb` to generate the cheatsheets and help files.

**Extension use:** A script could `require` the Sonic Pi Ruby libs and dump `@@docs` to JSON. Alternatively, parse the generated cheatsheets (simpler).

---

## 5. Synth, Sample & FX Metadata

**File:** `app/server/ruby/lib/sonicpi/synths/synthinfo.rb` (10,031 lines)

This is the single largest file in the codebase and the **authoritative source** for all synth, sample, and FX metadata.

### Structure

```ruby
module SonicPi
  module Synths
    class BaseInfo
      # Class methods:
      #   all_synths      → [:beep, :sine, :saw, :pulse, ...]
      #   all_fx          → [:reverb, :echo, :distortion, ...]
      #   all_samples     → [:drum_heavy_kick, :elec_triangle, ...]
      #   grouped_samples → { drum: { samples: [...], desc: "..." }, ... }
      #   info_doc_markdown(name) → markdown string
    end

    # One class per synth:
    class BeepInfo < SonicPiSynth ... end
    class SineInfo < SonicPiSynth ... end
    class SawInfo < SonicPiSynth ... end
    # ...

    # One class per FX:
    class FXReverb < FXInfo ... end
    class FXEcho < FXInfo ... end
    # ...

    # @@synth_infos maps symbol → info class:
    @@synth_infos = {
      :beep => BeepInfo.new,
      :sine => SineInfo.new,
      # ...
      :fx_reverb => FXReverb.new,
      :fx_echo => FXEcho.new,
      # ...
    }
  end
end
```

### What each info class contains

| Method | Returns | Extension use |
|--------|---------|---------------|
| `name` | Symbol (e.g., `:sine`) | Completion label |
| `doc` | Description string | Hover docs |
| `arg_info` | Hash of `{ name: { default:, doc:, constraints:, modulatable:, ... } }` | Completion opts, hover parameter table |
| `introduced` | Version string | Informational |
| `synth_name` | Internal SuperCollider name | Informational |

### Sample groups (line ~9304)

```ruby
@@grouped_samples = {
  :drum => { desc: "Drum Sounds", prefix: "drum_", samples: [:drum_heavy_kick, :drum_tom_mid_soft, ...] },
  :elec => { desc: "Electric Sounds", prefix: "elec_", samples: [:elec_triangle, :elec_snare, ...] },
  :ambi => { desc: "Ambient Sounds", prefix: "ambi_", samples: [:ambi_soft_buzz, :ambi_swoosh, ...] },
  :bass => { desc: "Bass Sounds", prefix: "bass_", samples: [:bass_hit_c, :bass_hard_c, ...] },
  :loop => { desc: "Loops", prefix: "loop_", samples: [:loop_industrial, :loop_compus, ...] },
  # ... ~20 categories total
}
```

**Extension use:** This is the primary data source for `sonic-pi-data.json`. A Ruby extraction script can load `synthinfo.rb` and dump all synths, FX, samples, and their opts to JSON.

---

## 6. Cheatsheets — Parseable Documentation

**Directory:** `etc/doc/cheatsheets/`

| File | Lines | Content |
|------|-------|---------|
| `synths.md` | ~4,013 | Every synth with key, doc, and full opts table |
| `fx.md` | ~1,300 | Every FX with key, doc, and full opts table |
| `samples.md` | ~130 | All sample names grouped by category |

### Synths.md format (parseable)

```markdown
## Dull Bell

### Key:
  :dull_bell

### Doc:
  A simple dull discordant bell sound.

### Opts:
  * note:
    - doc: Note to play. Either a MIDI number or a symbol...
    - default: 52
    - constraints: must be zero or greater
    - May be changed whilst playing
    - Has slide parameters for shaping changes
  * amp:
    - doc: The amplitude of the sound...
    - default: 1
    ...
```

**Extension use:** Parse with regex to extract structured data. Each synth/FX block follows the same `## Name` / `### Key:` / `### Doc:` / `### Opts:` pattern. This is the **easiest path** to generating `sonic-pi-data.json` without running Ruby.

### Samples.md format

```markdown
## Drum Sounds
* :drum_heavy_kick
* :drum_tom_mid_soft
...

## Electric Sounds
* :elec_triangle
...
```

---

## 7. Snippets — Convertible to VS Code Format

**Directory:** `etc/snippets/` (12 files)

### Sonic Pi `.sps` format

```
# key: ll
# point_line: 0
# point_index: 11
# --
live_loop : do

end
```

### Conversion to VS Code snippet JSON

| `.sps` field | VS Code field | Mapping |
|-------------|---------------|---------|
| `key` | `prefix` | Direct (e.g., `"ll"`) |
| Body (after `--`) | `body` | Split into lines array |
| `point_line` + `point_index` | `$0` placeholder | Insert `$0` at the cursor position |

### All snippets to convert

| File | Prefix | Body |
|------|--------|------|
| `syntax/do.sps` | `do` | `do` / `end` block |
| `live_loop/ll.sps` | `ll` | `live_loop :name do` / `end` |
| `fx/fx.sps` | `fx` | `with_fx :name do` / `end` |
| `fx/reverb.sps` | `fx r` | `with_fx :reverb do` / `end` |
| `fx/echo.sps` | `fx e` | `with_fx :echo do` / `end` |
| `fx/distortion.sps` | `fx d` | `with_fx :distortion do` / `end` |
| `fx/bitcrusher.sps` | `fx b` | `with_fx :bitcrusher do` / `end` |
| `fx/compressor.sps` | `fx c` | `with_fx :compressor do` / `end` |
| `fx/flanger.sps` | `fx f` | `with_fx :flanger do` / `end` |
| `fx/krush.sps` | `fx k` | `with_fx :krush do` / `end` |
| `fx/slicer.sps` | `fx s` | `with_fx :slicer do` / `end` |
| `fx/wobble.sps` | `fx w` | `with_fx :wobble do` / `end` |

---

## 8. Examples — Bundleable Content

**Directory:** `etc/examples/` (34 `.rb` files across 7 skill levels)

| Level | Directory | Files |
|-------|-----------|-------|
| Apprentice | `apprentice/` | haunted.rb |
| Magician | `magician/` | acid.rb, ambient.rb, compus_beats.rb, echo_drama.rb, idm_breakbeat.rb, tron_bike.rb, wob_rhyth.rb |
| Illusionist | `illusionist/` | ambient_experiment.rb, chord_inversions.rb, filtered_dnb.rb, fm_noise.rb, jungle.rb, ocean.rb, reich_phase.rb |
| Sorcerer | `sorcerer/` | bach.rb, driving_pulse.rb, lorezzed.rb, monday_blues.rb, rerezzed.rb, square_skit.rb |
| Wizard | `wizard/` | blimp_zones.rb, blip_rhythm.rb, shufflit.rb, tilburg_2.rb, time_machine.rb |
| Algomancer | `algomancer/` | blockgame.rb, cloud_beat.rb, sonic_dreams.rb |
| Incubation | `incubation/` | crushed.rb, dark_neon.rb, mod_303_phade.rb, orchard_improv.rb, syncer.rb |

**Extension use:** Bundle as `.spi` files. Expose via "Sonic Pi: Open Examples" command with a Quick Pick grouped by skill level.

---

## 9. Tutorial — Bundleable Content

**Directory:** `etc/doc/tutorial/` (~90 markdown files)

### Sections

| Section | Files | Topics |
|---------|-------|--------|
| 01 | Welcome | Getting started |
| 02 | Synths | Playing notes, synth selection |
| 03 | Samples | Playing and manipulating samples |
| 04 | Randomisation | Random numbers, seeds |
| 05 | Programming Structures | Loops, conditionals, threads |
| 06 | FX | Effects and chaining |
| 07 | Control | Controlling running synths |
| 08 | Data Structures | Lists, rings, maps |
| 09 | Live Coding | live_loop, hot-swapping |
| 10 | Time State | Cue, sync, time state |
| 11 | MIDI | MIDI in/out |
| 12 | OSC | OSC communication |
| 13 | Multichannel Audio | Sound in/out |
| A | Tips & Tricks | Performance, creativity |
| B | Reference | Shortcuts, performing |

**Extension use:** Bundle markdown files. Expose via a "Sonic Pi: Tutorial" webview or tree view. Files are self-contained and well-structured.

---

## 10. GUI Internals — Protocol Reference

**Directory:** `app/gui/` and `app/api/`

### C++ API layer (`app/api/`)

| File | What it reveals |
|------|-----------------|
| `include/api/sonicpi_api.h` | Full `SonicPiAPI` class: `Init()`, `Boot()`, `RunCode()`, `StopAllJobs()`, `Shutdown()`, `AudioProcessor` |
| `include/api/osc/osc_handler.h` | `OscHandler` — receives and dispatches all incoming OSC messages |
| `src/sonicpi_api.cpp` | Boot sequence: spawns `daemon.rb`, parses STDOUT, stores ports and token |

The C++ API shows exactly how the native GUI boots the daemon and parses ports:

```cpp
// sonicpi_api.cpp (paraphrased)
// Reads STDOUT line: "daemon gui-listen gui-send scsynth osc-cues tau-api tau-phx token"
// Splits on spaces, assigns to m_ports struct
```

### GUI widgets (reference for feature parity)

| Widget | File | Extension equivalent |
|--------|------|---------------------|
| Code editor | `widgets/sonicpiscintilla.h` | VS Code editor (native) |
| Log panel | `widgets/sonicpilog.h` | Output channel |
| Context/help | `widgets/sonicpicontext.h` | Hover provider + webview |
| Settings | `widgets/settingswidget.h` | VS Code settings |
| Visualizer | `widgets/visualizer.h` | Webview (Phase 3 stretch) |
| BPM scrubber | `widgets/bpmscrubwidget.h` | Status bar item (future) |

### Lexer (syntax reference)

**File:** `app/gui/widgets/sonicpilexer.h`

The Scintilla lexer extends `QsciLexerRuby` with Sonic Pi keyword lists. These keyword lists can inform the TextMate grammar:

- Keywords: `live_loop`, `in_thread`, `with_fx`, `with_synth`, `define`, `do`, `end`
- Functions: `play`, `sample`, `sleep`, `use_synth`, `use_bpm`, `cue`, `sync`

---

## 11. Tau (Erlang/BEAM) — Routing Layer

**Directory:** `app/server/beam/tau/`

### What Tau does

Tau is the OSC message router sitting between the GUI/extension and the Spider server. It handles:

- **OSC routing** — forwards messages between GUI, Spider, and scsynth
- **Cue management** — receives external OSC cues and forwards to Spider
- **MIDI routing** — MIDI in/out via `tau_server_midi.erl`
- **Ableton Link** — tempo sync via `tau_server_link.erl`
- **Phoenix web UI** — internal web interface on `tau-phx` port

### Key Tau API endpoints

| Path | Purpose |
|------|---------|
| `/ping` | Liveness (responds with `/pong`) |
| `/send-pid-to-daemon` | Register with daemon |
| `/osc-in-udp-loopback-restricted` | Restrict OSC input |
| `/stop-start-cue-server` | Toggle cue server |
| `/stop-start-midi-cues` | Toggle MIDI cues |

### Extension relevance

For the MVP, the extension talks to **Spider** (via `gui-send-to-spider` port), not Tau directly. Tau is transparent — it routes messages internally. The extension only needs to know about Tau if it wants to:
- Send OSC cues directly
- Monitor Link peers/tempo
- Access the Phoenix web UI

---

## 12. Config Formats

**Directory:** `app/config/user-examples/`

| File | Format | Content | Extension use |
|------|--------|---------|---------------|
| `init.rb` | Ruby | User init code (evaluated at boot) | Could support user init in extension |
| `audio-settings.toml` | TOML | Sound card, sample rate, buffer size, scsynth options | Read for validation / display |
| `colour-theme.properties` | Java Properties | GUI color overrides (e.g., `windowColor=#FF000000`) | Map to VS Code theme tokens |

### audio-settings.toml structure

```toml
[scsynth]
# sound_card_name = ""
# input_sound_card_name = ""
# output_sound_card_name = ""
# num_inputs = 2
# num_outputs = 2
# block_size = 64
# sample_rate = 44100
```

---

## 13. Theme & i18n Data

### Theme

**Directory:** `app/gui/theme/`

| File | Content |
|------|---------|
| `app.qss` | Qt stylesheet with color variables |
| `dark/doc-styles.css` | Dark theme CSS for help panel |
| `light/doc-styles.css` | Light theme CSS |
| `high_contrast/doc-styles.css` | High contrast CSS |

Color tokens from `colour-theme.properties`:
`windowColor`, `paneColor`, `logForegroundColor`, `logBackgroundColor`, `selectionForegroundColor`, `selectionBackgroundColor`, `errorBackgroundColor`, `syntaxErrorBackgroundColor`

### i18n

**Directory:** `app/gui/lang/` (55 `.ts` Qt Linguist files)

Available locales: ar, bg, bs, ca, cs, da, de, el, en_AU, en_US, es, et, fi, fr, gl, he, hi, hr, hu, id, is, it, ja, ko, lv, nb, nl, pl, pt, pt_BR, ro, ru, si, sk, sl, sv, sw, tr, uk, zh-Hans, zh_HK, zh_TW

**Extension use:** Extract English strings for `package.nls.json`. Use locale codes for future i18n support.

---

## 14. Integration Matrix

Summary of every Sonic Pi component and its relationship to the extension.

| Component | Path | Action | Priority | Notes |
|-----------|------|--------|----------|-------|
| **daemon.rb** | `app/server/ruby/bin/daemon.rb` | **Integrate** | P1 | Spawn process, parse STDOUT for ports + token |
| **spider-server.rb** | `app/server/ruby/bin/spider-server.rb` | **Reference** | P1 | Definitive OSC API (inbound + outbound) |
| **synthinfo.rb** | `app/server/ruby/lib/sonicpi/synths/synthinfo.rb` | **Extract** | P1 | Generate `sonic-pi-data.json` (synths, FX, samples, opts) |
| **lang/core.rb** | `app/server/ruby/lib/sonicpi/lang/core.rb` | **Extract** | P2 | DSL function signatures and docs |
| **lang/sound.rb** | `app/server/ruby/lib/sonicpi/lang/sound.rb` | **Extract** | P2 | Sound function signatures and docs |
| **synths.md** | `etc/doc/cheatsheets/synths.md` | **Parse** | P1 | Easier alternative to synthinfo.rb for synth data |
| **fx.md** | `etc/doc/cheatsheets/fx.md` | **Parse** | P1 | FX data |
| **samples.md** | `etc/doc/cheatsheets/samples.md` | **Parse** | P1 | Sample names and categories |
| **snippets/** | `etc/snippets/**/*.sps` | **Convert** | P1 | 12 snippets → VS Code JSON format |
| **examples/** | `etc/examples/**/*.rb` | **Bundle** | P2 | 34 example files, rename to `.spi` |
| **tutorial/** | `etc/doc/tutorial/*.md` | **Bundle** | P3 | ~90 markdown tutorial files |
| **doc.rb** | `app/server/ruby/bin/doc.rb` | **Reference** | P2 | Shows how to generate docs from synthinfo |
| **sonicpi_api.h** | `app/api/include/api/sonicpi_api.h` | **Reference** | P1 | C++ boot sequence, port parsing, IAPIClient callbacks |
| **osc_handler.h** | `app/api/include/api/osc/osc_handler.h` | **Reference** | P1 | OSC message dispatch patterns |
| **sonicpilexer.h** | `app/gui/widgets/sonicpilexer.h` | **Reference** | P1 | Keyword lists for TextMate grammar |
| **version.rb** | `app/server/ruby/lib/sonicpi/version.rb` | **Reference** | P2 | Version format for compatibility checks |
| **colour-theme.properties** | `app/config/user-examples/colour-theme.properties` | **Reference** | P3 | Theme token names |
| **lang/*.ts** | `app/gui/lang/*.ts` | **Reference** | P3 | i18n strings and locale codes |
| **Tau** | `app/server/beam/tau/` | **Reference** | P3 | Cue routing, Link, MIDI (not needed for MVP) |
| **audio-settings.toml** | `app/config/user-examples/audio-settings.toml` | **Reference** | P3 | Audio config format |

---

## 15. Recommended Extraction Pipeline

### Step 1: Generate `sonic-pi-data.json` (P1)

Write a Node.js or Python script that parses the cheatsheets:

```
Input:  etc/doc/cheatsheets/synths.md
        etc/doc/cheatsheets/fx.md
        etc/doc/cheatsheets/samples.md
Output: src/data/sonic-pi-data.json
```

Parse each `## Name` block to extract `key`, `doc`, and `opts` (with `default`, `constraints`, `doc`).

### Step 2: Convert snippets (P1)

```
Input:  etc/snippets/**/*.sps
Output: src/language/snippets.json
```

Parse the YAML-like header (`key`, `point_line`, `point_index`) and body. Map `point_line`/`point_index` to a `$0` tab stop in the VS Code snippet body.

### Step 3: Bundle examples (P2)

```
Input:  etc/examples/**/*.rb
Output: examples/**/*.spi
```

Copy files, rename extension, add a manifest for the Quick Pick UI.

### Step 4: Bundle tutorial (P3)

```
Input:  etc/doc/tutorial/*.md
Output: tutorial/*.md (or embedded in webview)
```

### Step 5: Extract DSL function docs (P2)

Either parse `lang/core.rb` and `lang/sound.rb` for `doc name:` blocks, or run `doc.rb` to generate markdown and parse that.

---

*This analysis is based on the `dev` branch of sonic-pi-net/sonic-pi as of March 2025 (v4.6.0). File paths and line numbers may shift in future versions.*
