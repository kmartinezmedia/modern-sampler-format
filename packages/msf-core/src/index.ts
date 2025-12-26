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
 */
export interface MSFInstrument {
  /** Instrument identity and scope */
  identity: InstrumentIdentity;

  /** Articulations as first-class behaviors */
  articulations: Articulation[];

  /** SampleSets with resolved audio */
  sampleSets: SampleSet[];

  /** Explicit key and velocity mapping */
  mapping: Mapping;

  /** Modulation as a signal graph */
  modulation: ModulationGraph;

  /** Event-driven performance rules */
  rules: PerformanceRule[];

  /** Deterministic configuration and provenance */
  metadata: InstrumentMetadata;
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

