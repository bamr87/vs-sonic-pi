# Language Provider

**Modules:**  
- `syntaxes/sonicpi.tmLanguage.json` (TextMate grammar)  
- `src/language/CompletionProvider.ts`  
- `src/language/HoverProvider.ts`  
- `src/language/DiagnosticsProvider.ts`  
- `src/language/snippets.json`  
- `src/data/sonic-pi-data.json` (shared data source)  

**Phase:** 1 (grammar, snippets) / Phase 2 (completion, hover, diagnostics)  
**Dependencies:** `ConnectionManager` (diagnostics only), `sonic-pi-data.json`

---

## Purpose

The Language Provider gives the Sonic Pi DSL first-class editor support inside VS Code: syntax coloring, code completion, hover documentation, inline error reporting, and code snippets. Together these features make writing Sonic Pi code in VS Code feel as natural as writing it in the native app — but with the added power of a full-featured code editor.

---

## Sub-Components

```
Language Provider
├── TextMate Grammar        ← Phase 1: syntax highlighting (static, no code)
├── Snippets                ← Phase 1: common code patterns (static JSON)
├── CompletionProvider      ← Phase 2: IntelliSense for synths, samples, FX, opts
├── HoverProvider           ← Phase 2: documentation on hover
├── DiagnosticsProvider     ← Phase 2: server errors → Problems panel
└── LiveLoopLensProvider    ← Phase 3: "▶ Run loop" CodeLens per live_loop
```

### LiveLoopLensProvider (`src/language/LiveLoopLens.ts`)

`findLiveLoops(text)` locates every `live_loop :name do ... end` block by
tracking do/end nesting line-by-line (strings and comments are stripped
heuristically; unclosed loops extend to the last line). The provider places a
`▶ Run loop :name` CodeLens on each loop's first line, which invokes
`sonicpi.runLiveLoop` with the document URI and line range — sending only that
loop's code to the server via `/run-code`. This is the core live-coding
gesture: tweak one loop and re-send it without re-running the whole buffer.

---

## 1. TextMate Grammar

**File:** `syntaxes/sonicpi.tmLanguage.json`  
**Scope name:** `source.sonicpi`  
**Registered in:** `package.json` → `contributes.grammars`

The grammar extends standard Ruby syntax with Sonic Pi-specific scopes. It is a static JSON file — no TypeScript code runs for highlighting.

### Scope Map

| Scope | What it matches | Example tokens |
|-------|-----------------|----------------|
| `keyword.control.sonicpi` | Block-level constructs | `live_loop`, `in_thread`, `at`, `with_fx`, `with_synth`, `with_bpm`, `define` |
| `support.function.sonicpi` | DSL functions | `play`, `play_pattern`, `play_pattern_timed`, `play_chord`, `sample`, `sleep`, `use_synth`, `use_bpm`, `use_random_seed`, `cue`, `sync`, `stop`, `tick`, `look`, `tuplets`, `puts`, `print` |
| `constant.language.note.sonicpi` | Note name symbols | `:c`, `:d3`, `:cs4`, `:eb`, `:fs2` |
| `constant.language.synth.sonicpi` | Synth name symbols | `:sine`, `:saw`, `:pulse`, `:square`, `:tri`, `:prophet`, `:tb303`, `:piano`, `:pluck`, `:supersaw`, `:hoover`, `:dark_ambience`, `:growl`, `:hollow`, `:rhodey`, `:gabberkick`, `:sc808_bassdrum`, etc. |
| `constant.language.sample.sonicpi` | Sample name symbols | `:bd_haus`, `:bd_808`, `:ambi_choir`, `:loop_amen`, `:drum_heavy_kick`, `:elec_triangle`, `:bass_hit_c`, `:sn_dub`, `:hat_snap`, etc. |
| `constant.language.fx.sonicpi` | FX name symbols | `:reverb`, `:echo`, `:distortion`, `:lpf`, `:hpf`, `:flanger`, `:slicer`, `:wobble`, `:bitcrusher`, `:krush`, `:compressor`, etc. |
| `variable.parameter.opt.sonicpi` | Common option names | `amp:`, `pan:`, `attack:`, `release:`, `sustain:`, `decay:`, `cutoff:`, `rate:`, `beat_stretch:`, `mix:`, `room:`, `note:` |
| `comment.line.number-sign.sonicpi` | Comments | `# this is a comment` |
| `string.quoted.double.sonicpi` | Strings | `"hello"` |
| `constant.numeric.sonicpi` | Numbers | `60`, `0.5`, `130` |

### Grammar Structure (Simplified)

```jsonc
{
  "scopeName": "source.sonicpi",
  "patterns": [
    { "include": "#comments" },
    { "include": "#strings" },
    { "include": "#numbers" },
    { "include": "#keywords" },
    { "include": "#functions" },
    { "include": "#synths" },
    { "include": "#samples" },
    { "include": "#fx" },
    { "include": "#notes" },
    { "include": "#opts" },
    { "include": "#symbols" },
    { "include": "#ruby-base" }
  ],
  "repository": {
    "keywords": {
      "match": "\\b(live_loop|in_thread|at|with_fx|with_synth|with_bpm|define|do|end)\\b",
      "name": "keyword.control.sonicpi"
    },
    "functions": {
      "match": "\\b(play|sample|sleep|use_synth|use_bpm|cue|sync|stop|tick|look|puts|print|tuplets|play_pattern|play_pattern_timed|play_chord|use_random_seed)\\b",
      "name": "support.function.sonicpi"
    }
    // ... other repository entries
  }
}
```

### Language Configuration

**File:** `language-configuration.json`

Defines bracket pairs, auto-closing, comment toggling, and indentation rules:

```jsonc
{
  "comments": { "lineComment": "#" },
  "brackets": [["(", ")"], ["[", "]"], ["{", "}"]],
  "autoClosingPairs": [
    { "open": "(", "close": ")" },
    { "open": "[", "close": "]" },
    { "open": "{", "close": "}" },
    { "open": "\"", "close": "\"" },
    { "open": "'", "close": "'" },
    { "open": "do", "close": "\nend" }
  ],
  "indentationRules": {
    "increaseIndentPattern": "^\\s*(live_loop|in_thread|with_fx|with_synth|define|do|\\{).*$",
    "decreaseIndentPattern": "^\\s*(end|\\}).*$"
  },
  "folding": {
    "markers": {
      "start": "\\b(do)\\b",
      "end": "\\b(end)\\b"
    }
  }
}
```

---

## 2. Snippets

**File:** `src/language/snippets.json`  
**Registered in:** `package.json` → `contributes.snippets`

Snippets provide quick scaffolding for common patterns.

| Prefix | Name | Body |
|--------|------|------|
| `ll` | Live Loop | `live_loop :${1:name} do\n  ${2:play 60}\n  sleep ${3:1}\nend` |
| `it` | In Thread | `in_thread do\n  ${1:play 60}\n  sleep ${2:1}\nend` |
| `wfx` | With FX | `with_fx :${1:reverb} do\n  ${0}\nend` |
| `ws` | With Synth | `with_synth :${1:prophet} do\n  ${0}\nend` |
| `sa` | Sample | `sample :${1:bd_haus}${2:, rate: 1}` |
| `pl` | Play | `play ${1:60}${2:, release: 0.5}` |
| `ppt` | Play Pattern Timed | `play_pattern_timed [${1::c4, :e4, :g4}], [${2:0.5}]` |
| `sl` | Sleep | `sleep ${1:1}` |
| `us` | Use Synth | `use_synth :${1:saw}` |
| `ub` | Use BPM | `use_bpm ${1:120}` |
| `def` | Define | `define :${1:name} do\n  ${0}\nend` |
| `tup` | Tuplets | `tuplets [${1:60, 62, [64, 65], 67}] do |n|\n  play n\nend` |

---

## 3. CompletionProvider

**File:** `src/language/CompletionProvider.ts`  
**Phase:** 2  
**Trigger characters:** `:` (for symbols), ` ` (after function names)

### Data Source

All completion data comes from `src/data/sonic-pi-data.json`, loaded once at activation. The data file contains four arrays: `synths`, `samples`, `fx`, and `lang` (DSL functions). See [PRD Section 8.1](../PRD.md) for the full schema.

### Completion Contexts

The provider analyzes the cursor position and surrounding text to determine what to suggest:

| Context | Trigger | What to show | CompletionItemKind |
|---------|---------|--------------|-------------------|
| After `use_synth` or `with_synth` | `:` | All synth names | `Enum` |
| After `sample` | `:` | All sample names (grouped by category) | `Value` |
| After `with_fx` | `:` | All FX names | `Enum` |
| After `play`, `sample`, synth/FX name | `,` or space | Relevant opts (e.g., `amp:`, `release:`, `rate:`) | `Property` |
| Line start or general | typing | DSL function names | `Function` |
| After `play` | `:` | Note names (`:c4`, `:d3`, etc.) | `Constant` |

### Context Detection Logic

```
1. Get the text from the start of the current line to the cursor.
2. Match against patterns:
   a. /use_synth\s+:?\w*$/     → synth context
   b. /with_synth\s+:?\w*$/    → synth context
   c. /sample\s+:?\w*$/        → sample context
   d. /with_fx\s+:?\w*$/       → FX context
   e. /play\s+:?\w*$/          → note context
   f. /,\s*\w*$/               → opts context (look back to find the function)
   g. /^\s*\w*$/               → function context
3. Return the appropriate CompletionItem[] for the detected context.
```

### Completion Item Details

Each item includes:

- `label` — the name (e.g., `:prophet`)
- `kind` — the CompletionItemKind
- `detail` — short description (e.g., "Dark, detuned synth")
- `documentation` — MarkdownString with full docs and parameter list
- `insertText` — the text to insert (e.g., `:prophet`)
- `sortText` — for ordering (frequently used items first)

---

## 4. HoverProvider

**File:** `src/language/HoverProvider.ts`  
**Phase:** 2

### Behavior

When the user hovers over a recognized token, the provider shows a tooltip with documentation.

| Token type | Example | Hover content |
|------------|---------|---------------|
| DSL function | `play` | Signature, description, parameter list, link to docs |
| Synth name | `:prophet` | Description, available opts with types and defaults |
| Sample name | `:bd_haus` | Category, description |
| FX name | `:reverb` | Description, available opts with types and defaults |
| Note name | `:c4` | MIDI number equivalent (e.g., "MIDI note 60") |

### Implementation

```
1. Get the word at the hover position (vscode.TextDocument.getWordRangeAtPosition).
2. Strip leading ":" if present.
3. Look up the word in sonic-pi-data.json:
   a. Check synths[] by name
   b. Check samples[] by name
   c. Check fx[] by name
   d. Check lang[] by name
   e. Check note-to-MIDI mapping
4. If found, construct a vscode.Hover with MarkdownString content.
5. If not found, return null (no hover).
```

### Hover Format (Example)

For `:prophet`:

```markdown
**:prophet** — Synth

Dark, detuned synth with a thick, rich sound.

**Options:**
| Opt | Type | Default | Description |
|-----|------|---------|-------------|
| note | number | 52 | MIDI note |
| amp | number | 1 | Amplitude (0–1) |
| pan | number | 0 | Stereo position (-1 to 1) |
| attack | number | 0 | Attack time in beats |
| release | number | 1 | Release time in beats |
| cutoff | number | 110 | Low-pass filter cutoff |

[Full docs →](https://sonic-pi.net)
```

---

## 5. DiagnosticsProvider

**File:** `src/language/DiagnosticsProvider.ts`  
**Phase:** 2  
**Dependencies:** `ConnectionManager` (subscribes to `/error` messages via transport)

### Purpose

When the Sonic Pi server reports an error (syntax or runtime), the DiagnosticsProvider parses the error message, extracts the file and line number, and creates a `vscode.Diagnostic` entry. This surfaces errors in the VS Code Problems panel and shows inline squiggles in the editor.

### Error Message Format

Sonic Pi `/error` messages typically contain text like:

```
Runtime Error: [buffer workspace_0, line 5]
 undefined method 'plya' for #<SonicPi::...>
 Did you mean? play
```

Or for syntax errors:

```
Syntax Error: [buffer workspace_0, line 3]
 unexpected end-of-input, expecting end
```

### Parsing Logic

```
1. Receive /error message text from transport.
2. Extract line number using regex:
   /\[buffer\s+\w+,\s+line\s+(\d+)\]/
3. Extract error description (remaining text after the location line).
4. Determine severity:
   - "Syntax Error" → DiagnosticSeverity.Error
   - "Runtime Error" → DiagnosticSeverity.Error
   - "Warning" → DiagnosticSeverity.Warning
5. Map to the active editor's document URI.
6. Create vscode.Diagnostic at the extracted line.
7. Add to the DiagnosticCollection.
```

### Diagnostic Lifecycle

| Event | Action |
|-------|--------|
| `/error` received | Parse and add diagnostic to collection. |
| User runs code again (`sonicpi.run`) | Clear all existing diagnostics (new run = fresh state). |
| User edits the file | Clear diagnostics for that file (stale errors). |
| Extension disconnects | Clear all diagnostics. |

### DiagnosticCollection

```typescript
const diagnosticCollection = vscode.languages.createDiagnosticCollection('sonicpi');

// On error:
const diag = new vscode.Diagnostic(
  new vscode.Range(lineNumber - 1, 0, lineNumber - 1, Number.MAX_VALUE),
  errorMessage,
  vscode.DiagnosticSeverity.Error,
);
diag.source = 'Sonic Pi';
diagnosticCollection.set(documentUri, [diag]);
```

---

## Data Flow Summary

```
                    sonic-pi-data.json
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     CompletionProvider  HoverProvider  (grammar uses
     (runtime lookup)    (runtime       hardcoded names
                          lookup)       for highlighting)

     ┌─────────────────────────────────────────────┐
     │              DiagnosticsProvider             │
     │  (listens to /error from OscTransport)      │
     └─────────────────────────────────────────────┘
                           │
                           ▼
                    Problems Panel
                    + inline squiggles
```

---

## Testing

### Unit Tests

| Test | Description |
|------|-------------|
| **Grammar** | Snapshot test: tokenize sample code, verify scope assignments match expected scopes. |
| **CompletionProvider: synth context** | Cursor after `use_synth :`. Verify all synth names returned. |
| **CompletionProvider: sample context** | Cursor after `sample :`. Verify all sample names returned. |
| **CompletionProvider: FX context** | Cursor after `with_fx :`. Verify all FX names returned. |
| **CompletionProvider: opts context** | Cursor after `play 60, `. Verify opts like `amp:`, `release:` returned. |
| **CompletionProvider: function context** | Cursor at line start. Verify DSL functions returned. |
| **CompletionProvider: no completions** | Cursor inside a string. Verify empty result. |
| **HoverProvider: known synth** | Hover over `:prophet`. Verify hover contains description and opts table. |
| **HoverProvider: known function** | Hover over `play`. Verify hover contains signature and docs. |
| **HoverProvider: unknown word** | Hover over `foobar`. Verify null returned. |
| **DiagnosticsProvider: runtime error** | Simulate `/error` with line number. Verify diagnostic created at correct line. |
| **DiagnosticsProvider: syntax error** | Simulate syntax error message. Verify diagnostic severity is Error. |
| **DiagnosticsProvider: clear on run** | Run command invoked. Verify diagnostics cleared. |
| **DiagnosticsProvider: clear on edit** | Document edited. Verify diagnostics cleared for that file. |
