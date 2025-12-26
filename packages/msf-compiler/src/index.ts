/**
 * MSF Compiler — Deterministic IIS → MSF Compiler
 *
 * The compiler is the intelligence center of the system.
 * It transforms Instrument Intent Spec (IIS) into complete MSF instruments.
 */

import type {
  MSFInstrument,
  BuildReport,
  BuildDecision,
} from "@msf/core";

/**
 * Instrument Intent Spec (IIS)
 *
 * A typed, declarative specification that describes musical goals,
 * not wiring. References inventory by ID, never by filename.
 */
export interface InstrumentIntent {
  /** Musical goals and intent */
  intent: IntentDescription;

  /** References to inventory samples by ID */
  inventoryReferences: InventoryReference[];

  /** Articulation strategy */
  articulations: ArticulationIntent[];

  /** Mapping strategy */
  mapping: MappingIntent;

  /** Modulation intent */
  modulation?: ModulationIntent;

  /** Performance behavior */
  performance?: PerformanceIntent;
}

export interface IntentDescription {
  name: string;
  description?: string;
  instrumentType: string;
  targetArticulations: string[];
}

export interface InventoryReference {
  id: string;
  role: "primary" | "secondary" | "roundRobin";
  constraints?: {
    noteRange?: [number, number];
    velocityRange?: [number, number];
    articulation?: string;
  };
}

export interface ArticulationIntent {
  id: string;
  name: string;
  type: string;
  samples: string[]; // Inventory IDs
  parameters?: Record<string, unknown>;
}

export interface MappingIntent {
  strategy: "chromatic" | "velocityLayered" | "keySplit" | "hybrid";
  zones?: MappingZone[];
}

export interface MappingZone {
  keyRange?: [number, number];
  velocityRange?: [number, number];
  sampleSetIds: string[];
}

export interface ModulationIntent {
  sources: ModulationSource[];
  targets: ModulationTarget[];
}

export interface ModulationSource {
  type: string;
  id: string;
  parameters?: Record<string, unknown>;
}

export interface ModulationTarget {
  parameter: string;
  sourceId: string;
  amount: number;
}

export interface PerformanceIntent {
  rules: PerformanceRuleIntent[];
}

export interface PerformanceRuleIntent {
  trigger: string;
  action: string;
  parameters?: Record<string, unknown>;
}

/**
 * Compiler Options
 */
export interface CompilerOptions {
  /** Seed for deterministic random operations (round-robin, etc.) */
  seed?: number;

  /** Enable verbose build reporting */
  verbose?: boolean;

  /** Strict mode: fail on warnings */
  strict?: boolean;
}

/**
 * Compile IIS to MSF
 *
 * This is the core transformation that produces a complete,
 * deterministic MSF instrument from intent.
 */
export async function compile(
  intent: InstrumentIntent,
  inventory: Inventory,
  options: CompilerOptions = {}
): Promise<{
  instrument: MSFInstrument;
  report: BuildReport;
}> {
  const decisions: BuildDecision[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // TODO: Implement compiler logic
  // - Resolve samples from inventory
  // - Build explicit key and velocity zones
  // - Assign round-robin behavior using seeded RNG
  // - Generate modulation graphs
  // - Emit event rules for performance behavior

  const report: BuildReport = {
    decisions,
    warnings,
    errors,
  };

  // Placeholder instrument
  const instrument: MSFInstrument = {
    identity: {
      id: `instrument-${Date.now()}`,
      name: intent.intent.name,
      version: "0.1.0",
    },
    articulations: [],
    sampleSets: [],
    mapping: {
      keyZones: [],
      velocityZones: [],
    },
    modulation: {
      nodes: [],
      edges: [],
    },
    rules: [],
    metadata: {
      compiledAt: new Date().toISOString(),
      compilerVersion: "0.1.0",
      sourceIntent: JSON.stringify(intent),
      buildReport: report,
    },
  };

  return { instrument, report };
}

/**
 * Inventory interface (to be defined by @msf/inventory package)
 */
export interface Inventory {
  getSample(id: string): Sample | undefined;
  listSamples(): Sample[];
}

export interface Sample {
  id: string;
  path: string;
  metadata: {
    note?: number;
    velocity?: number;
    articulation?: string;
    duration: number;
    sampleRate: number;
    channels: number;
    format: string;
  };
}

