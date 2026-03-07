import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const SONIC_PI_ROOT =
  process.env.SONIC_PI_PATH || resolve(__dirname, "../../sonic-pi");

interface OptInfo {
  doc: string;
  default: string | number;
  constraints?: string;
  slidable?: boolean;
  dynamic?: boolean;
}

interface SynthEntry {
  key: string;
  name: string;
  doc: string;
  opts: Record<string, OptInfo>;
}

interface FxEntry {
  key: string;
  name: string;
  doc: string;
  opts: Record<string, OptInfo>;
}

interface SampleEntry {
  name: string;
}

interface ScaleEntry {
  name: string;
  intervals: number[];
}

interface ChordEntry {
  name: string;
  intervals: number[];
}

interface FunctionEntry {
  name: string;
  doc: string;
  category: string;
}

interface SonicPiData {
  synths: SynthEntry[];
  fx: FxEntry[];
  samples: Record<string, SampleEntry[]>;
  functions: FunctionEntry[];
  scales: ScaleEntry[];
  chords: ChordEntry[];
  notes: Record<string, number>;
}

function parseSynthsOrFx(content: string): (SynthEntry | FxEntry)[] {
  const entries: (SynthEntry | FxEntry)[] = [];
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0].trim();

    const keyMatch = section.match(/### Key:\s*\n\s*:(\w+)/);
    if (!keyMatch) continue;
    const key = keyMatch[1];

    const docMatch = section.match(/### Doc:\s*\n([\s\S]*?)(?=\n### Opts:|\n## )/);
    const doc = docMatch ? docMatch[1].trim() : "";

    const optsSection = section.match(/### Opts:\s*\n([\s\S]*?)(?=\n## |$)/);
    const opts: Record<string, OptInfo> = {};

    if (optsSection) {
      const optBlocks = optsSection[1].split(/^\s+\* (\w+):/m).slice(1);
      for (let i = 0; i < optBlocks.length; i += 2) {
        const optName = optBlocks[i];
        const optBody = optBlocks[i + 1] || "";

        const optDocMatch = optBody.match(/- doc:\s*(.*)/);
        const optDefaultMatch = optBody.match(/- default:\s*(.*)/);
        const optConstraintMatch = optBody.match(/- constraints:\s*(.*)/);
        const slidable = /Has slide parameters/.test(optBody);
        const dynamic = /May be changed whilst playing/.test(optBody);

        let defaultVal: string | number = optDefaultMatch
          ? optDefaultMatch[1].trim()
          : "";
        const numVal = Number(defaultVal);
        if (!isNaN(numVal) && defaultVal !== "") {
          defaultVal = numVal;
        }

        opts[optName] = {
          doc: optDocMatch ? optDocMatch[1].trim() : "",
          default: defaultVal,
          ...(optConstraintMatch
            ? { constraints: optConstraintMatch[1].trim() }
            : {}),
          ...(slidable ? { slidable: true } : {}),
          ...(dynamic ? { dynamic: true } : {}),
        };
      }
    }

    entries.push({ key, name, doc, opts });
  }

  return entries;
}

function parseSamples(content: string): Record<string, SampleEntry[]> {
  const groups: Record<string, SampleEntry[]> = {};
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const groupName = lines[0].trim();
    const samples: SampleEntry[] = [];

    for (const line of lines.slice(1)) {
      const match = line.match(/^\*\s+:(\w+)/);
      if (match) {
        samples.push({ name: match[1] });
      }
    }

    if (samples.length > 0) {
      groups[groupName] = samples;
    }
  }

  return groups;
}

const KNOWN_SCALES: Record<string, number[]> = {
  diatonic: [2, 2, 1, 2, 2, 2, 1],
  ionian: [2, 2, 1, 2, 2, 2, 1],
  major: [2, 2, 1, 2, 2, 2, 1],
  dorian: [2, 1, 2, 2, 2, 1, 2],
  phrygian: [1, 2, 2, 2, 1, 2, 2],
  lydian: [2, 2, 2, 1, 2, 2, 1],
  mixolydian: [2, 2, 1, 2, 2, 1, 2],
  aeolian: [2, 1, 2, 2, 1, 2, 2],
  minor: [2, 1, 2, 2, 1, 2, 2],
  locrian: [1, 2, 2, 1, 2, 2, 2],
  hex_major6: [2, 2, 1, 2, 2, 3],
  hex_dorian: [2, 1, 2, 2, 3, 2],
  hex_phrygian: [1, 2, 2, 3, 2, 2],
  hex_major7: [2, 2, 3, 2, 2, 1],
  hex_sus: [2, 3, 2, 2, 1, 2],
  hex_aeolian: [3, 2, 2, 1, 2, 2],
  minor_pentatonic: [3, 2, 2, 3, 2],
  yu: [3, 2, 2, 3, 2],
  major_pentatonic: [2, 2, 3, 2, 3],
  gong: [2, 2, 3, 2, 3],
  egyptian: [2, 3, 2, 3, 2],
  shang: [2, 3, 2, 3, 2],
  jiao: [3, 2, 3, 2, 2],
  zhi: [2, 3, 2, 2, 3],
  ritusen: [2, 3, 2, 2, 3],
  whole_tone: [2, 2, 2, 2, 2, 2],
  whole: [2, 2, 2, 2, 2, 2],
  chromatic: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  harmonic_minor: [2, 1, 2, 2, 1, 3, 1],
  melodic_minor_asc: [2, 1, 2, 2, 2, 2, 1],
  hungarian_minor: [2, 1, 3, 1, 1, 3, 1],
  octatonic: [2, 1, 2, 1, 2, 1, 2, 1],
  messiaen1: [2, 2, 2, 2, 2, 2],
  messiaen2: [1, 2, 1, 2, 1, 2, 1, 2],
  messiaen3: [2, 1, 1, 2, 1, 1, 2, 1, 1],
  messiaen4: [1, 1, 3, 1, 1, 1, 3, 1],
  messiaen5: [1, 4, 1, 1, 4, 1],
  messiaen6: [2, 2, 1, 1, 2, 2, 1, 1],
  messiaen7: [1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
  super_locrian: [1, 2, 1, 2, 2, 2, 2],
  hirajoshi: [2, 1, 4, 1, 4],
  kumoi: [2, 1, 4, 2, 3],
  neapolitan_major: [1, 2, 2, 2, 2, 2, 1],
  bartok: [2, 2, 1, 2, 1, 2, 2],
  bhairav: [1, 3, 1, 2, 1, 3, 1],
  locrian_major: [2, 2, 1, 1, 2, 2, 2],
  ahirbhairav: [1, 3, 1, 2, 2, 1, 2],
  enigmatic: [1, 3, 2, 2, 2, 1, 1],
  neapolitan_minor: [1, 2, 2, 2, 1, 3, 1],
  pelog: [1, 2, 4, 1, 4],
  augmented2: [1, 3, 1, 3, 1, 3],
  scriabin: [1, 3, 3, 2, 3],
  harmonic_major: [2, 2, 1, 2, 1, 3, 1],
  melodic_minor_desc: [2, 1, 2, 2, 1, 2, 2],
  romanian_minor: [2, 1, 3, 1, 2, 1, 2],
  hindu: [2, 2, 1, 2, 1, 2, 2],
  iwato: [1, 4, 1, 4, 2],
  melodic_minor: [2, 1, 2, 2, 2, 2, 1],
  diminished2: [2, 1, 2, 1, 2, 1, 2, 1],
  marva: [1, 3, 2, 1, 2, 2, 1],
  melodic_major: [2, 2, 1, 2, 1, 2, 2],
  indian: [4, 1, 2, 3, 2],
  spanish: [1, 3, 1, 2, 1, 2, 2],
  prometheus: [2, 2, 2, 5, 1],
  diminished: [1, 2, 1, 2, 1, 2, 1, 2],
  todi: [1, 2, 3, 1, 1, 3, 1],
  leading_whole: [2, 2, 2, 2, 2, 1, 1],
  augmented: [3, 1, 3, 1, 3, 1],
  purvi: [1, 3, 2, 1, 1, 3, 1],
  chinese: [4, 2, 1, 4, 1],
  lydian_minor: [2, 2, 2, 1, 1, 2, 2],
  blues_major: [2, 1, 1, 3, 2, 3],
  blues_minor: [3, 2, 1, 1, 3, 2],
};

const KNOWN_CHORDS: Record<string, number[]> = {
  "1": [0],
  "5": [0, 7],
  "+5": [0, 4, 8],
  "m+5": [0, 3, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  "7sus2": [0, 2, 7, 10],
  "7sus4": [0, 5, 7, 10],
  "7-5": [0, 4, 6, 10],
  halfdiminished: [0, 3, 6, 10],
  "7+5": [0, 4, 8, 10],
  "m7+5": [0, 3, 8, 10],
  "9": [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  "m7+9": [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  "9sus4": [0, 5, 7, 10, 14],
  "6*9": [0, 4, 7, 9, 14],
  "m6*9": [0, 3, 7, 9, 14],
  "7-9": [0, 4, 7, 10, 13],
  "m7-9": [0, 3, 7, 10, 13],
  "7-10": [0, 4, 7, 10, 15],
  "7-11": [0, 4, 7, 10, 16],
  "7-13": [0, 4, 7, 10, 20],
  "9+5": [0, 10, 13],
  "m9+5": [0, 10, 14],
  "7+5-9": [0, 4, 8, 10, 13],
  "m7+5-9": [0, 3, 8, 10, 13],
  "11": [0, 4, 7, 10, 14, 17],
  m11: [0, 3, 7, 10, 14, 17],
  maj11: [0, 4, 7, 11, 14, 17],
  "11+": [0, 4, 7, 10, 14, 18],
  "m11+": [0, 3, 7, 10, 14, 18],
  "13": [0, 4, 7, 10, 14, 17, 21],
  m13: [0, 3, 7, 10, 14, 17, 21],
  add2: [0, 2, 4, 7],
  add4: [0, 4, 5, 7],
  add9: [0, 4, 7, 14],
  add11: [0, 4, 7, 17],
  add13: [0, 4, 7, 21],
  madd2: [0, 2, 3, 7],
  madd4: [0, 3, 5, 7],
  madd9: [0, 3, 7, 14],
  madd11: [0, 3, 7, 17],
  madd13: [0, 3, 7, 21],
  major: [0, 4, 7],
  maj: [0, 4, 7],
  M: [0, 4, 7],
  minor: [0, 3, 7],
  min: [0, 3, 7],
  m: [0, 3, 7],
  major7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  "7": [0, 4, 7, 10],
  M7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  m7: [0, 3, 7, 10],
  augmented: [0, 4, 8],
  a: [0, 4, 8],
  diminished: [0, 3, 6],
  dim: [0, 3, 6],
  i: [0, 3, 6],
  diminished7: [0, 3, 6, 9],
  dim7: [0, 3, 6, 9],
  i7: [0, 3, 6, 9],
  halfdim: [0, 3, 6, 10],
  "m7b5": [0, 3, 6, 10],
  "m7-5": [0, 3, 6, 10],
};

function extractMakamNames(scaleRbPath: string): string[] {
  const content = readFileSync(scaleRbPath, "utf-8");
  const makamNames: string[] = [];
  const makamRegex = /^\s+(\w+):\s+.*(?:dortlusu|beslisi|mucenneb|tanini|bakiyye|koma|artik)/;
  const keyRegex = /^\s+(\w+):\s+/;

  const makamSection = content.indexOf("# Basic makams");
  if (makamSection === -1) return makamNames;

  const lines = content.slice(makamSection).split("\n");
  for (const line of lines) {
    if (line.includes("}")) break;
    const match = line.match(keyRegex);
    if (match) {
      makamNames.push(match[1]);
    }
  }
  return makamNames;
}

function parseScales(scaleRbPath: string): ScaleEntry[] {
  const scales = Object.entries(KNOWN_SCALES).map(([name, intervals]) => ({
    name,
    intervals,
  }));

  const makamNames = extractMakamNames(scaleRbPath);
  for (const name of makamNames) {
    if (!scales.find((s) => s.name === name)) {
      scales.push({ name, intervals: [] });
    }
  }

  return scales;
}

function parseChords(): ChordEntry[] {
  return Object.entries(KNOWN_CHORDS).map(([name, intervals]) => ({
    name,
    intervals,
  }));
}

function generateNotes(): Record<string, number> {
  const noteNames = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
  const flatNames: Record<string, string> = {
    Cs: "Db",
    Ds: "Eb",
    Fs: "Gb",
    Gs: "Ab",
    As: "Bb",
  };
  const notes: Record<string, number> = {};
  for (let octave = 0; octave <= 8; octave++) {
    for (let i = 0; i < 12; i++) {
      const midi = octave * 12 + i + 12; // C0 = MIDI 12
      const name = noteNames[i];
      notes[`${name}${octave}`] = midi;
      if (flatNames[name]) {
        notes[`${flatNames[name]}${octave}`] = midi;
      }
    }
  }
  return notes;
}

const coreFunctions: FunctionEntry[] = [
  { name: "play", doc: "Play a note with the current synth.", category: "sound" },
  { name: "play_pattern", doc: "Play a list of notes one after another.", category: "sound" },
  { name: "play_pattern_timed", doc: "Play a list of notes with specified durations.", category: "sound" },
  { name: "play_chord", doc: "Play multiple notes simultaneously.", category: "sound" },
  { name: "sample", doc: "Play a built-in or external audio sample.", category: "sound" },
  { name: "synth", doc: "Trigger a specific synth by name.", category: "sound" },
  { name: "control", doc: "Control a running synth node.", category: "sound" },
  { name: "kill", doc: "Kill a running synth node.", category: "sound" },
  { name: "sleep", doc: "Wait for a number of beats before continuing.", category: "core" },
  { name: "wait", doc: "Alias for sleep.", category: "core" },
  { name: "live_loop", doc: "Create a named loop that runs repeatedly.", category: "control" },
  { name: "in_thread", doc: "Execute code in a new thread.", category: "control" },
  { name: "with_fx", doc: "Wrap code in an audio effect.", category: "control" },
  { name: "with_synth", doc: "Set the synth for the duration of the block.", category: "control" },
  { name: "with_bpm", doc: "Set the BPM for the duration of the block.", category: "control" },
  { name: "with_bpm_mul", doc: "Multiply the BPM for the duration of the block.", category: "control" },
  { name: "with_sample_bpm", doc: "Set BPM based on sample duration.", category: "control" },
  { name: "with_random_seed", doc: "Set the random seed for the block.", category: "control" },
  { name: "with_random_source", doc: "Set the random source for the block.", category: "control" },
  { name: "with_synth_defaults", doc: "Set default synth opts for the block.", category: "control" },
  { name: "with_merged_synth_defaults", doc: "Merge synth opts for the block.", category: "control" },
  { name: "with_sample_defaults", doc: "Set default sample opts for the block.", category: "control" },
  { name: "with_merged_sample_defaults", doc: "Merge sample opts for the block.", category: "control" },
  { name: "with_cent_tuning", doc: "Shift tuning in cents for the block.", category: "control" },
  { name: "with_octave", doc: "Shift octave for the block.", category: "control" },
  { name: "with_swing", doc: "Add swing feel to the block.", category: "control" },
  { name: "with_debug", doc: "Set debug mode for the block.", category: "control" },
  { name: "with_arg_checks", doc: "Set argument checking for the block.", category: "control" },
  { name: "with_osc", doc: "Set OSC destination for the block.", category: "control" },
  { name: "with_osc_logging", doc: "Set OSC logging for the block.", category: "control" },
  { name: "with_cue_logging", doc: "Set cue logging for the block.", category: "control" },
  { name: "with_arg_bpm_scaling", doc: "Set BPM scaling for the block.", category: "control" },
  { name: "with_timing_guarantees", doc: "Set timing guarantees for the block.", category: "control" },
  { name: "with_timing_warnings", doc: "Set timing warnings for the block.", category: "control" },
  { name: "define", doc: "Define a named function.", category: "control" },
  { name: "defonce", doc: "Define a function that is only evaluated once.", category: "control" },
  { name: "comment", doc: "Comment out a block of code.", category: "control" },
  { name: "uncomment", doc: "Uncomment a block of code.", category: "control" },
  { name: "density", doc: "Multiply the density of events in the block.", category: "control" },
  { name: "at", doc: "Schedule code at specific beat offsets.", category: "control" },
  { name: "time_warp", doc: "Shift time for the block.", category: "control" },
  { name: "on", doc: "Conditionally execute a block.", category: "control" },
  { name: "use_synth", doc: "Set the current synth.", category: "sound" },
  { name: "use_bpm", doc: "Set the current BPM.", category: "core" },
  { name: "use_bpm_mul", doc: "Multiply the current BPM.", category: "core" },
  { name: "use_sample_bpm", doc: "Set BPM based on a sample duration.", category: "sound" },
  { name: "use_synth_defaults", doc: "Set default synth opts.", category: "sound" },
  { name: "use_merged_synth_defaults", doc: "Merge synth opts into defaults.", category: "sound" },
  { name: "use_sample_defaults", doc: "Set default sample opts.", category: "sound" },
  { name: "use_merged_sample_defaults", doc: "Merge sample opts into defaults.", category: "sound" },
  { name: "use_cent_tuning", doc: "Shift tuning in cents.", category: "sound" },
  { name: "use_octave", doc: "Shift octave.", category: "sound" },
  { name: "use_debug", doc: "Enable or disable debug mode.", category: "core" },
  { name: "use_arg_checks", doc: "Enable or disable argument checking.", category: "core" },
  { name: "use_osc", doc: "Set OSC destination host and port.", category: "core" },
  { name: "use_osc_logging", doc: "Enable or disable OSC logging.", category: "core" },
  { name: "use_random_seed", doc: "Set the random seed.", category: "core" },
  { name: "use_random_source", doc: "Set the random source.", category: "core" },
  { name: "use_cue_logging", doc: "Enable or disable cue logging.", category: "core" },
  { name: "use_arg_bpm_scaling", doc: "Enable or disable BPM scaling.", category: "core" },
  { name: "use_timing_guarantees", doc: "Enable or disable timing guarantees.", category: "core" },
  { name: "use_timing_warnings", doc: "Enable or disable timing warnings.", category: "core" },
  { name: "use_external_synths", doc: "Enable or disable external synths.", category: "sound" },
  { name: "cue", doc: "Send a cue event.", category: "core" },
  { name: "sync", doc: "Wait for a cue event.", category: "core" },
  { name: "sync_bpm", doc: "Wait for a cue and inherit its BPM.", category: "core" },
  { name: "set", doc: "Set a time-state value.", category: "core" },
  { name: "get", doc: "Get a time-state value.", category: "core" },
  { name: "tick", doc: "Advance and return the tick counter.", category: "core" },
  { name: "tick_set", doc: "Set the tick counter.", category: "core" },
  { name: "tick_reset", doc: "Reset a named tick counter.", category: "core" },
  { name: "tick_reset_all", doc: "Reset all tick counters.", category: "core" },
  { name: "look", doc: "Return the current tick value without advancing.", category: "core" },
  { name: "stop", doc: "Stop the current thread.", category: "core" },
  { name: "puts", doc: "Print a message to the log.", category: "core" },
  { name: "print", doc: "Print a message to the log.", category: "core" },
  { name: "reset", doc: "Reset all thread-local state.", category: "core" },
  { name: "clear", doc: "Clear all time-state.", category: "core" },
  { name: "vt", doc: "Return the current virtual time.", category: "core" },
  { name: "beat", doc: "Return the current beat.", category: "core" },
  { name: "rt", doc: "Convert real-time seconds to beats.", category: "core" },
  { name: "current_bpm", doc: "Return the current BPM.", category: "core" },
  { name: "osc", doc: "Send an OSC message.", category: "core" },
  { name: "osc_send", doc: "Send an OSC message to a specific host/port.", category: "core" },
  { name: "live_audio", doc: "Stream live audio input.", category: "sound" },
  { name: "live_state", doc: "Set a live state value.", category: "core" },
  { name: "note", doc: "Resolve a note to a MIDI number.", category: "theory" },
  { name: "note_info", doc: "Get detailed info about a note.", category: "theory" },
  { name: "note_range", doc: "Generate a range of notes.", category: "theory" },
  { name: "scale", doc: "Generate notes from a scale.", category: "theory" },
  { name: "chord", doc: "Generate notes from a chord.", category: "theory" },
  { name: "chord_degree", doc: "Generate a chord from a scale degree.", category: "theory" },
  { name: "chord_invert", doc: "Invert a chord.", category: "theory" },
  { name: "degree", doc: "Convert a scale degree to a note.", category: "theory" },
  { name: "midi_notes", doc: "Convert a list to MIDI note numbers.", category: "theory" },
  { name: "hz_to_midi", doc: "Convert Hz to MIDI note number.", category: "theory" },
  { name: "midi_to_hz", doc: "Convert MIDI note number to Hz.", category: "theory" },
  { name: "pitch_to_ratio", doc: "Convert a pitch shift in MIDI to a ratio.", category: "theory" },
  { name: "ratio_to_pitch", doc: "Convert a ratio to a pitch shift in MIDI.", category: "theory" },
  { name: "scale_names", doc: "List all available scale names.", category: "theory" },
  { name: "chord_names", doc: "List all available chord names.", category: "theory" },
  { name: "ring", doc: "Create a ring (circular) list.", category: "data" },
  { name: "vector", doc: "Create a vector.", category: "data" },
  { name: "bools", doc: "Create a ring of booleans.", category: "data" },
  { name: "stretch", doc: "Stretch values in a list.", category: "data" },
  { name: "knit", doc: "Knit values and counts together.", category: "data" },
  { name: "spread", doc: "Generate Euclidean rhythms.", category: "data" },
  { name: "range", doc: "Generate a range of numbers.", category: "data" },
  { name: "line", doc: "Generate a line of numbers.", category: "data" },
  { name: "halves", doc: "Generate a series of halved values.", category: "data" },
  { name: "doubles", doc: "Generate a series of doubled values.", category: "data" },
  { name: "choose", doc: "Choose a random element.", category: "data" },
  { name: "pick", doc: "Pick random elements.", category: "data" },
  { name: "ramp", doc: "Create a ramp list.", category: "data" },
  { name: "map", doc: "Create a map from key-value pairs.", category: "data" },
  { name: "tuplets", doc: "Create tuplet rhythms.", category: "data" },
  { name: "quantise", doc: "Quantise a value to a step.", category: "data" },
  { name: "factor?", doc: "Check if a value is a factor of another.", category: "data" },
  { name: "spark", doc: "Create a spark line visualization.", category: "data" },
  { name: "rand", doc: "Generate a random float.", category: "random" },
  { name: "rand_i", doc: "Generate a random integer.", category: "random" },
  { name: "rrand", doc: "Generate a random float in a range.", category: "random" },
  { name: "rrand_i", doc: "Generate a random integer in a range.", category: "random" },
  { name: "rdist", doc: "Generate a random value with distribution.", category: "random" },
  { name: "dice", doc: "Roll a die.", category: "random" },
  { name: "one_in", doc: "Return true one in N times.", category: "random" },
  { name: "rand_look", doc: "Look at the random value without consuming.", category: "random" },
  { name: "rand_i_look", doc: "Look at the random integer without consuming.", category: "random" },
  { name: "rand_back", doc: "Step back in the random stream.", category: "random" },
  { name: "rand_skip", doc: "Skip ahead in the random stream.", category: "random" },
  { name: "rand_reset", doc: "Reset the random stream.", category: "random" },
  { name: "set_volume!", doc: "Set the main volume.", category: "sound" },
  { name: "set_mixer_control!", doc: "Control the main mixer.", category: "sound" },
  { name: "reset_mixer!", doc: "Reset the main mixer.", category: "sound" },
  { name: "recording_start", doc: "Start recording audio.", category: "sound" },
  { name: "recording_stop", doc: "Stop recording audio.", category: "sound" },
  { name: "recording_save", doc: "Save the recording to a file.", category: "sound" },
  { name: "recording_delete", doc: "Delete the current recording.", category: "sound" },
  { name: "load_sample", doc: "Load a sample into memory.", category: "sound" },
  { name: "load_samples", doc: "Load multiple samples into memory.", category: "sound" },
  { name: "sample_loaded?", doc: "Check if a sample is loaded.", category: "sound" },
  { name: "sample_info", doc: "Get info about a sample.", category: "sound" },
  { name: "sample_duration", doc: "Get the duration of a sample.", category: "sound" },
  { name: "sample_names", doc: "List sample names in a group.", category: "sound" },
  { name: "sample_groups", doc: "List all sample groups.", category: "sound" },
  { name: "all_sample_names", doc: "List all sample names.", category: "sound" },
  { name: "synth_names", doc: "List all synth names.", category: "sound" },
  { name: "fx_names", doc: "List all FX names.", category: "sound" },
  { name: "current_synth", doc: "Return the current synth name.", category: "sound" },
  { name: "current_synth_defaults", doc: "Return the current synth defaults.", category: "sound" },
  { name: "current_sample_defaults", doc: "Return the current sample defaults.", category: "sound" },
  { name: "current_volume", doc: "Return the current volume.", category: "sound" },
  { name: "status", doc: "Return the server status.", category: "sound" },
  { name: "reboot", doc: "Reboot the audio server.", category: "sound" },
  { name: "run_file", doc: "Run a Sonic Pi file.", category: "core" },
  { name: "run_code", doc: "Run a string of Sonic Pi code.", category: "core" },
  { name: "load_buffer", doc: "Load a file into a buffer.", category: "core" },
  { name: "assert", doc: "Assert a condition is truthy.", category: "core" },
  { name: "assert_equal", doc: "Assert two values are equal.", category: "core" },
  { name: "assert_similar", doc: "Assert two values are similar.", category: "core" },
  { name: "assert_error", doc: "Assert a block raises an error.", category: "core" },
  { name: "block_duration", doc: "Return the duration of a block.", category: "core" },
  { name: "block_slept?", doc: "Check if a block slept.", category: "core" },
];

function main() {
  const synthsPath = resolve(SONIC_PI_ROOT, "etc/doc/cheatsheets/synths.md");
  const fxPath = resolve(SONIC_PI_ROOT, "etc/doc/cheatsheets/fx.md");
  const samplesPath = resolve(SONIC_PI_ROOT, "etc/doc/cheatsheets/samples.md");
  const scaleRbPath = resolve(
    SONIC_PI_ROOT,
    "app/server/ruby/lib/sonicpi/scale.rb"
  );

  console.log(`Reading cheatsheets from: ${SONIC_PI_ROOT}`);

  const synthsContent = readFileSync(synthsPath, "utf-8");
  const fxContent = readFileSync(fxPath, "utf-8");
  const samplesContent = readFileSync(samplesPath, "utf-8");

  const synths = parseSynthsOrFx(synthsContent) as SynthEntry[];
  const fx = parseSynthsOrFx(fxContent) as FxEntry[];
  const samples = parseSamples(samplesContent);
  const scales = parseScales(scaleRbPath);
  const chords = parseChords();
  const notes = generateNotes();

  const data: SonicPiData = {
    synths,
    fx,
    samples,
    functions: coreFunctions,
    scales,
    chords,
    notes,
  };

  const outPath = resolve(__dirname, "../src/data/sonic-pi-data.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(data, null, 2));

  console.log(
    `Extracted: ${synths.length} synths, ${fx.length} FX, ` +
      `${Object.values(samples).flat().length} samples in ${Object.keys(samples).length} groups, ` +
      `${coreFunctions.length} functions, ` +
      `${scales.length} scales, ${chords.length} chords, ${Object.keys(notes).length} notes`
  );
  console.log(`Written to: ${outPath}`);
}

main();
