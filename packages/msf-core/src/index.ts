/**
 * MSF Core — Modern Sampler Format
 *
 * Core type definitions and runtime model for MSF instruments.
 * MSF is the single source of truth for sampler playback behavior.
 */

/**
 * MSF Instrument Bundle
 *
 * A complete, deterministic declaration of sampler behavior.
 *
 * MSF RULE: No Backward Compatibility
 * ===================================
 * MSF is a compiled format. All decisions are made at compile time.
 * Runtime must never guess, infer, or fall back to legacy behavior.
 *
 * - Regions are REQUIRED (not optional)
 * - All mappings must be explicit
 * - No "closest sample" heuristics
 * - No runtime inference
 * - Fail fast if data is missing or incomplete
 *
 * If you need to support old formats, migrate them at compile time,
 * not at runtime. MSF is not a configuration language - it's a
 * fully-resolved runtime model.
 */
export interface MSFInstrument {
  /** Instrument identity and scope */
  identity: InstrumentIdentity;

  /** Articulations as first-class behaviors */
  articulations: Articulation[];

  /** SampleSets with resolved audio */
  sampleSets: SampleSet[];

  /** Regions: explicit sample coverage ranges (primary mapping unit)
   * REQUIRED: MSF requires regions. No backward compatibility.
   * Every sample must have at least one region covering its range.
   */
  regions: MsfRegion[];

  /** Pre-computed note lookup table for O(1) region selection.
   * Maps MIDI note (0-127) → velocity layer index → region index.
   * Eliminates runtime region filtering.
   */
  noteLookup?: NoteLookup;

  /** Explicit key and velocity mapping */
  mapping: Mapping;

  /** Modulation as a signal graph */
  modulation: ModulationGraph;

  /** Event-driven performance rules */
  rules: PerformanceRule[];

  /** Deterministic configuration and provenance */
  metadata: InstrumentMetadata;
}

/**
 * Pre-computed note lookup table.
 * Indexed by MIDI note number (0-127).
 * Each entry contains velocity layers sorted by velocity threshold.
 */
export interface NoteLookup {
  /** Array indexed by MIDI note (0-127). Each entry is an array of velocity layers. */
  table: NoteLookupEntry[][];
}

export interface NoteLookupEntry {
  /** Velocity threshold (inclusive). Use this region if velocity >= threshold. */
  velocityMin: number;
  /** Index into regions array */
  regionIndex: number;
  /** Direct reference to sample path for O(1) audio lookup */
  samplePath: string;
}

export interface InstrumentIdentity {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
}

export interface Articulation {
  id: string;
  name: string;
  type: ArticulationType;
  parameters: Record<string, unknown>;
}

export type ArticulationType =
  | "legato"
  | "staccato"
  | "sustain"
  | "tremolo"
  | "vibrato"
  | "pizzicato"
  | "bowed"
  | "custom";

export interface SampleSet {
  id: string;
  samples: Sample[];
  roundRobin?: RoundRobinConfig;
}

export interface Sample {
  id: string;
  path: string;
  note?: number;
  velocity?: number;
  articulation?: string;
  metadata: SampleMetadata;
  /** SFZ-style range extension: lowest MIDI note this sample covers */
  lokey?: number;
  /** SFZ-style range extension: highest MIDI note this sample covers */
  hikey?: number;
  /** SFZ-style range extension: original pitch of the sample (MIDI note number) */
  pitch_keycenter?: number;
}

export interface SampleMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  format: string;
}

export interface RoundRobinConfig {
  strategy: "sequential" | "random";
  seed?: number;
  count: number;
}

export interface Mapping {
  keyZones: KeyZone[];
  velocityZones: VelocityZone[];
}

export interface KeyZone {
  range: [number, number]; // [min, max] MIDI note numbers
  sampleSetId: string;
  articulationId?: string;
}

export interface VelocityZone {
  range: [number, number]; // [min, max] MIDI velocity
  sampleSetId: string;
  articulationId?: string;
}

export interface ModulationGraph {
  nodes: ModulationNode[];
  edges: ModulationEdge[];
}

export interface ModulationNode {
  id: string;
  type: ModulationNodeType;
  parameters: Record<string, unknown>;
}

export type ModulationNodeType =
  | "lfo"
  | "envelope"
  | "velocity"
  | "aftertouch"
  | "cc"
  | "math"
  | "constant";

export interface ModulationEdge {
  source: string;
  target: string;
  parameter: string;
  amount: number;
}

export interface PerformanceRule {
  id: string;
  trigger: RuleTrigger;
  action: RuleAction;
  condition?: RuleCondition;
}

export interface RuleTrigger {
  type: "noteOn" | "noteOff" | "cc" | "programChange" | "time";
  value?: number;
}

export interface RuleAction {
  type: "switchArticulation" | "modulate" | "selectSample" | "custom";
  parameters: Record<string, unknown>;
}

export interface RuleCondition {
  expression: string;
}

export interface InstrumentMetadata {
  compiledAt: string;
  compilerVersion: string;
  sourceIntent?: string;
  buildReport?: BuildReport;
}

export interface BuildReport {
  decisions: BuildDecision[];
  warnings: string[];
  errors: string[];
}

export interface BuildDecision {
  type: string;
  reason: string;
  context: Record<string, unknown>;
}

/**
 * MIDI Note type (0-127)
 */
export type MidiNote = number;

/**
 * Pre-computed playback data for a specific MIDI note
 * Computed at compile time to eliminate runtime pitch calculations
 */
export interface NotePlaybackData {
  /** Pre-computed playback rate: 2^((note - pitchKeyCenter + tuneCents/100) / 12) */
  playbackRate: number;

  /** Pre-computed output duration in frames: baseDurationFrames / playbackRate */
  outputFrames: number;

  /** Fade-in duration in output frames (prevents clicks at sample start) */
  fadeInFrames: number;

  /** Fade-out duration in output frames (prevents clicks at sample end) */
  fadeOutFrames: number;

  /** Pre-computed gain multiplier (0.0 to 1.0) - affects presence/dynamics */
  gain: number;
}

/**
 * MSF Region
 *
 * A region defines a sample's coverage range and pitch information.
 * This is the primary mapping unit for sparse multisampling.
 * Regions are computed at compile time and are fully resolved.
 *
 * MSF RULE: All playback calculations are pre-computed at compile time.
 * Runtime performs pure lookups - no pitch math, no duration calculations.
 */
export interface MsfRegion {
  id: string;

  /** Reference to the sample this region covers */
  sampleId: string;

  /** Lowest MIDI note this region covers (SFZ lokey) */
  loKey: MidiNote;

  /** Highest MIDI note this region covers (SFZ hikey) */
  hiKey: MidiNote;

  /** Root key / pitch center of the sample (SFZ pitch_keycenter) */
  pitchKeyCenter: MidiNote;

  /** Optional fine tuning in cents */
  tuneCents?: number;

  /** Optional velocity range (SFZ lovel/hivel) */
  loVel?: number; // 1..127
  hiVel?: number; // 1..127

  /** Optional articulation this region belongs to */
  articulationId?: string;

  /** Optional sample set this region belongs to */
  sampleSetId?: string;

  /**
   * Base duration in output frames at pitchKeyCenter (playbackRate = 1.0)
   * Pre-computed at compile time: duration * sampleRate (44100 Hz standard)
   * @deprecated Use notePlayback[note].outputFrames instead
   */
  baseDurationFrames: number;

  /**
   * Pre-computed playback data for each MIDI note in this region's range [loKey, hiKey]
   * Keyed by MIDI note number. Runtime does pure lookup - no calculations.
   *
   * MSF RULE: This is the authoritative source for playback parameters.
   * Runtime must NOT compute playbackRate or outputFrames - use these values directly.
   */
  notePlayback: Record<MidiNote, NotePlaybackData>;
}

/**
 * Utility functions for region computation and playback
 */

/**
 * Clamp a number to valid MIDI note range (0-127)
 */
export function clampMidi(n: number): MidiNote {
  return Math.max(0, Math.min(127, n)) as MidiNote;
}

/**
 * Compute playback rate for pitch shifting
 *
 * @param params - Pitch shifting parameters
 * @returns Playback rate multiplier (1.0 = no change, 2.0 = octave up, 0.5 = octave down)
 */
export function computePlaybackRate(params: {
  note: MidiNote;
  pitchKeyCenter: MidiNote;
  tuneCents?: number;
}): number {
  const semitones =
    (params.note - params.pitchKeyCenter) + (params.tuneCents ?? 0) / 100;
  return Math.pow(2, semitones / 12);
}

/**
 * Compute key ranges from sparse root notes
 *
 * Given a sorted list of root notes (e.g., every minor third),
 * computes coverage ranges using the midpoint algorithm.
 * This matches SFZ behavior and ensures no gaps or overlaps.
 *
 * @param roots - Array of root MIDI notes (will be sorted)
 * @param lo - Lower bound for first region (default: 0)
 * @param hi - Upper bound for last region (default: 127)
 * @returns Array of computed ranges with root, loKey, and hiKey
 */
export function computeKeyRanges(
  roots: MidiNote[],
  lo: MidiNote = 0,
  hi: MidiNote = 127
): Array<{ root: MidiNote; loKey: MidiNote; hiKey: MidiNote }> {
  const sorted = [...roots].sort((a, b) => a - b);
  const out: Array<{ root: MidiNote; loKey: MidiNote; hiKey: MidiNote }> = [];

  for (let i = 0; i < sorted.length; i++) {
    const root = sorted[i];
    if (root === undefined) continue; // Type guard

    const prev = i > 0 ? sorted[i - 1] : undefined;
    const next = i < sorted.length - 1 ? sorted[i + 1] : undefined;

    const loKey = i === 0 ? lo : (prev !== undefined ? Math.floor((prev + root) / 2) + 1 : lo);
    const hiKey = i === sorted.length - 1 ? hi : (next !== undefined ? Math.floor((root + next) / 2) : hi);

    out.push({ root, loKey: clampMidi(loKey), hiKey: clampMidi(hiKey) });
  }
  return out;
}

/**
 * Select the best region for a given note and velocity
 *
 * This implements deterministic region selection:
 * 1. Filter by key range coverage
 * 2. Filter by velocity range (if specified)
 * 3. If multiple candidates, choose closest pitchKeyCenter (least transposition)
 *
 * @param regions - Array of regions to search
 * @param note - MIDI note to play
 * @param velocity - MIDI velocity (1-127)
 * @returns Best matching region, or null if none found
 */
export function selectRegionForNote(
  regions: MsfRegion[],
  note: MidiNote,
  velocity: number
): MsfRegion | null {
  const candidates = regions.filter(
    (r) =>
      note >= r.loKey &&
      note <= r.hiKey &&
      (r.loVel == null || velocity >= r.loVel) &&
      (r.hiVel == null || velocity <= r.hiVel)
  );

  if (candidates.length === 0) return null;

  // If multiple candidates (future: crossfades/overlaps), choose best:
  // Prefer region with closest pitchKeyCenter (least transposition)
  candidates.sort(
    (a, b) =>
      Math.abs(note - a.pitchKeyCenter) - Math.abs(note - b.pitchKeyCenter)
  );

  const best = candidates[0];
  return best ?? null;
}

/**
 * Calculate semitones of transposition for a region
 *
 * @param region - The region
 * @param note - The requested MIDI note
 * @returns Semitones of transposition (positive = up, negative = down)
 */
export function calculateTransposition(region: MsfRegion, note: MidiNote): number {
  const semitones = (note - region.pitchKeyCenter) + (region.tuneCents ?? 0) / 100;
  return semitones;
}

/**
 * Check if transposition is excessive (warn threshold)
 *
 * @param semitones - Semitones of transposition
 * @param threshold - Warning threshold in semitones (default: 7)
 * @returns true if transposition exceeds threshold
 */
export function isExcessiveTransposition(semitones: number, threshold = 7): boolean {
  return Math.abs(semitones) > threshold;
}


