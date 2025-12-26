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

  // Initialize seeded RNG for deterministic round-robin
  const seed = options.seed ?? Date.now();
  let rngState = seed;
  function seededRandom(): number {
    rngState = (rngState * 9301 + 49297) % 233280;
    return rngState / 233280;
  }

  // Resolve samples from inventory
  const sampleSets: MSFInstrument["sampleSets"] = [];
  const sampleSetMap = new Map<string, number>();

  for (const articulation of intent.articulations) {
    const samples = articulation.samples
      .map((id) => inventory.getSample(id))
      .filter((sample): sample is Sample => sample !== undefined);

    if (samples.length === 0) {
      warnings.push(
        `Articulation ${articulation.id} has no valid samples in inventory`
      );
      continue;
    }

    const sampleSetId = `sampleset_${articulation.id}`;
    sampleSetMap.set(articulation.id, sampleSets.length);

    // Determine round-robin configuration
    const roundRobinSamples = samples.filter(
      (s) => s.metadata.roundRobin !== undefined
    );
    const hasRoundRobin = roundRobinSamples.length > 0;

    sampleSets.push({
      id: sampleSetId,
      samples: samples.map((sample) => ({
        id: sample.id,
        path: sample.path,
        note: sample.metadata.note,
        velocity: sample.metadata.velocity,
        articulation: articulation.id,
        metadata: {
          duration: sample.metadata.duration,
          sampleRate: sample.metadata.sampleRate,
          channels: sample.metadata.channels,
          format: sample.metadata.format,
        },
      })),
      roundRobin: hasRoundRobin
        ? {
            strategy: "random",
            seed,
            count: roundRobinSamples.length,
          }
        : undefined,
    });

    decisions.push({
      type: "sampleSetCreated",
      reason: `Created sample set for articulation ${articulation.id}`,
      context: { articulationId: articulation.id, sampleCount: samples.length },
    });
  }

  // Build explicit key and velocity zones
  const keyZones: MSFInstrument["mapping"]["keyZones"] = [];
  const velocityZones: MSFInstrument["mapping"]["velocityZones"] = [];

  if (intent.mapping.strategy === "chromatic") {
    // Create key zones for each articulation
    for (const articulation of intent.articulations) {
      const sampleSetIdx = sampleSetMap.get(articulation.id);
      if (sampleSetIdx === undefined) continue;

      keyZones.push({
        range: [0, 127], // Full range, can be refined based on sample metadata
        sampleSetId: sampleSets[sampleSetIdx]!.id,
        articulationId: articulation.id,
      });
    }
  } else if (intent.mapping.zones) {
    // Use explicit zones from intent
    for (const zone of intent.mapping.zones) {
      for (const sampleSetId of zone.sampleSetIds) {
        if (zone.keyRange) {
          keyZones.push({
            range: zone.keyRange,
            sampleSetId,
          });
        }
        if (zone.velocityRange) {
          velocityZones.push({
            range: zone.velocityRange,
            sampleSetId,
          });
        }
      }
    }
  }

  // Generate modulation graphs
  const modulationNodes: MSFInstrument["modulation"]["nodes"] = [];
  const modulationEdges: MSFInstrument["modulation"]["edges"] = [];

  if (intent.modulation) {
    for (const source of intent.modulation.sources) {
      modulationNodes.push({
        id: source.id,
        type: source.type as MSFInstrument["modulation"]["nodes"][number]["type"],
        parameters: source.parameters || {},
      });
    }

    for (const target of intent.modulation.targets) {
      modulationEdges.push({
        source: target.sourceId,
        target: target.parameter,
        parameter: target.parameter,
        amount: target.amount,
      });
    }
  }

  // Emit event rules for performance behavior
  const rules: MSFInstrument["rules"] = [];

  if (intent.performance) {
    for (const ruleIntent of intent.performance.rules) {
      rules.push({
        id: `rule_${rules.length}`,
        trigger: {
          type: ruleIntent.trigger as MSFInstrument["rules"][number]["trigger"]["type"],
        },
        action: {
          type: ruleIntent.action as MSFInstrument["rules"][number]["action"]["type"],
          parameters: ruleIntent.parameters || {},
        },
      });
    }
  }

  // Build articulations
  const articulations: MSFInstrument["articulations"] = intent.articulations.map(
    (a) => ({
      id: a.id,
      name: a.name,
      type: a.type as MSFInstrument["articulations"][number]["type"],
      parameters: a.parameters || {},
    })
  );

  const report: BuildReport = {
    decisions,
    warnings,
    errors,
  };

  const instrument: MSFInstrument = {
    identity: {
      id: `instrument_${intent.intent.name.toLowerCase().replace(/\s+/g, "_")}_${seed}`,
      name: intent.intent.name,
      version: "0.1.0",
      description: intent.intent.description,
    },
    articulations,
    sampleSets,
    mapping: {
      keyZones,
      velocityZones,
    },
    modulation: {
      nodes: modulationNodes,
      edges: modulationEdges,
    },
    rules,
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

