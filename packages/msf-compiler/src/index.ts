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
  MsfRegion,
  MidiNote,
  NotePlaybackData,
  NoteLookup,
  NoteLookupEntry,
} from "@msf/core";
import {
  computeKeyRanges,
  calculateTransposition,
  isExcessiveTransposition,
  computePlaybackRate,
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

  // Resolve samples from inventory
  const sampleSets: MSFInstrument["sampleSets"] = [];
  const sampleSetMap = new Map<string, number>();
  const regions: MsfRegion[] = [];

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
    // Check inventory entries for round-robin metadata before converting to Sample
    // Note: inventory.getSample returns InventoryEntry which has metadata.roundRobin
    const inventoryEntries = articulation.samples
      .map((id) => inventory.getSample(id))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
    // Type assertion needed because compiler's Sample interface doesn't include roundRobin
    // but inventory's InventoryEntry does
    const roundRobinSamples = inventoryEntries.filter(
      (entry) => (entry.metadata as { roundRobin?: number }).roundRobin !== undefined
    );
    const hasRoundRobin = roundRobinSamples.length > 0;

    // Compute regions from sparse samples using deterministic algorithm
    // Extract root notes (pitch centers) from samples
    const rootNotes: MidiNote[] = samples
      .map((s) => s.metadata.note ?? 60)
      .filter((note, index, arr) => arr.indexOf(note) === index); // Unique notes

    // Determine instrument key range (default: A0 to C8, but can be refined)
    const instrumentLoKey: MidiNote = 21; // A0
    const instrumentHiKey: MidiNote = 108; // C8

    // Compute key ranges using midpoint algorithm
    const keyRanges = computeKeyRanges(rootNotes, instrumentLoKey, instrumentHiKey);

    // Compute velocity ranges for velocity-layered samples
    // Group samples by note to find velocity layers at each pitch
    const samplesByNote = new Map<number, Sample[]>();
    for (const sample of samples) {
      const note = sample.metadata.note ?? 60;
      const existing = samplesByNote.get(note) || [];
      existing.push(sample);
      samplesByNote.set(note, existing);
    }

    // For each note, compute velocity ranges using midpoint algorithm
    const velocityRanges = new Map<string, { loVel: number; hiVel: number }>();
    for (const [note, noteSamples] of samplesByNote) {
      const velocities = noteSamples
        .map((s) => s.metadata.velocity ?? 100)
        .sort((a, b) => a - b);

      // Use midpoint algorithm for velocity ranges
      for (let i = 0; i < velocities.length; i++) {
        const vel = velocities[i]!;
        const prevVel = i > 0 ? velocities[i - 1]! : 0;
        const nextVel = i < velocities.length - 1 ? velocities[i + 1]! : 127;

        const loVel = i === 0 ? 1 : Math.floor((prevVel + vel) / 2) + 1;
        const hiVel = i === velocities.length - 1 ? 127 : Math.floor((vel + nextVel) / 2);

        // Store by "note_velocity" key
        velocityRanges.set(`${note}_${vel}`, { loVel, hiVel });
      }
    }

    // Create regions for each sample
    const samplesWithRanges = samples.map((sample) => {
      const sampleNote = sample.metadata.note ?? 60;
      const range = keyRanges.find((r) => r.root === sampleNote);

      // If no exact match, find closest range (shouldn't happen, but defensive)
      const finalRange = range ?? keyRanges[0] ?? {
        root: sampleNote,
        loKey: instrumentLoKey,
        hiKey: instrumentHiKey,
      };

      // Check for excessive transposition at range boundaries
      const maxTransposition = Math.max(
        Math.abs(calculateTransposition(
          { pitchKeyCenter: finalRange.root } as MsfRegion,
          finalRange.loKey
        )),
        Math.abs(calculateTransposition(
          { pitchKeyCenter: finalRange.root } as MsfRegion,
          finalRange.hiKey
        ))
      );

      if (isExcessiveTransposition(maxTransposition, 7)) {
        warnings.push(
          `Sample ${sample.id} (note ${sampleNote}) has excessive transposition ` +
          `at range boundaries (${maxTransposition.toFixed(1)} semitones). ` +
          `Consider adding more samples to reduce pitch-shifting artifacts.`
        );
      }

      // Create region for this sample
      // Pre-compute base duration in output frames at pitchKeyCenter (playbackRate = 1.0)
      // Using standard output sample rate of 44100 Hz (runtime default)
      const outputSampleRate = 44100;
      const baseDurationFrames = Math.floor(
        sample.metadata.duration * outputSampleRate
      );

      // Pre-compute playback data for every note in this region's range
      // MSF RULE: All pitch and envelope calculations happen at compile time, not runtime
      const notePlayback: Record<MidiNote, NotePlaybackData> = {};

      // Extract all parameters from articulation (0.0 to 1.0 range)
      const params = articulation.parameters as Record<string, number> | undefined;
      const attackParam = params?.attack ?? 0.5;
      const releaseParam = params?.release ?? 0.5;
      const brightnessParam = params?.brightness ?? 0.5;
      const roomParam = params?.room ?? 0.5;
      const warmthParam = params?.warmth ?? 0.5;
      const presenceParam = params?.presence ?? 0.5;

      // === ATTACK: Fade-in duration ===
      // 0% = instant (1ms), 100% = slow (100ms)
      const fadeInSeconds = 0.001 + attackParam * 0.099;

      // === RELEASE: Fade-out duration ===
      // 0% = instant (1ms), 100% = long (200ms)
      const baseReleaseSeconds = 0.001 + releaseParam * 0.199;

      // === ROOM: Adds extra tail to release ===
      // 0% = no extra tail, 100% = +300ms tail
      const roomTailSeconds = roomParam * 0.300;
      const fadeOutSeconds = baseReleaseSeconds + roomTailSeconds;

      // === BRIGHTNESS: Pitch detune in cents ===
      // 0% = -15 cents (darker), 100% = +15 cents (brighter)
      // This shifts the entire instrument slightly sharp or flat
      const brightnessCents = (brightnessParam - 0.5) * 30; // -15 to +15 cents

      // === WARMTH: Pitch + attack modification ===
      // 0% = +8 cents, fast attack (cold/clinical)
      // 100% = -8 cents, slower attack (warm/round)
      const warmthCents = (0.5 - warmthParam) * 16; // +8 to -8 cents
      const warmthAttackMult = 1.0 + warmthParam * 0.5; // 1.0x to 1.5x attack time

      // Combined pitch adjustment from brightness + warmth
      const totalCentsAdjust = brightnessCents + warmthCents;

      // === PRESENCE: Gain/dynamics ===
      // 0% = -6dB (sits back), 100% = 0dB (full presence)
      // Using linear gain: 0.5 to 1.0
      const presenceGain = 0.5 + presenceParam * 0.5;

      const baseFadeInFrames = Math.floor(fadeInSeconds * outputSampleRate * warmthAttackMult);
      const baseFadeOutFrames = Math.floor(fadeOutSeconds * outputSampleRate);

      for (let note = finalRange.loKey; note <= finalRange.hiKey; note++) {
        // Apply brightness/warmth cents adjustment to playback rate
        const playbackRate = computePlaybackRate({
          note: note as MidiNote,
          pitchKeyCenter: finalRange.root,
          tuneCents: totalCentsAdjust,
        });
        const outputFrames = Math.floor(baseDurationFrames / playbackRate);

        // Scale fade frames by playback rate to maintain consistent fade TIME
        const fadeInFrames = Math.floor(baseFadeInFrames / playbackRate);
        const fadeOutFrames = Math.floor(baseFadeOutFrames / playbackRate);

        notePlayback[note] = {
          playbackRate,
          outputFrames,
          fadeInFrames,
          fadeOutFrames,
          gain: presenceGain,
        };
      }

      // Get velocity range for this sample
      const sampleVel = sample.metadata.velocity ?? 100;
      const velRange = velocityRanges.get(`${sampleNote}_${sampleVel}`) || { loVel: 1, hiVel: 127 };

      const region: MsfRegion = {
        id: `region_${sample.id}`,
        sampleId: sample.id,
        loKey: finalRange.loKey,
        hiKey: finalRange.hiKey,
        pitchKeyCenter: finalRange.root,
        loVel: velRange.loVel,
        hiVel: velRange.hiVel,
        articulationId: articulation.id,
        sampleSetId,
        baseDurationFrames, // Kept for backward compatibility during transition
        notePlayback,
      };

      regions.push(region);

      return {
        id: sample.id,
        path: sample.path,
        note: sample.metadata.note,
        velocity: sample.metadata.velocity,
        articulation: articulation.id,
        lokey: finalRange.loKey,
        hikey: finalRange.hiKey,
        pitch_keycenter: finalRange.root,
        metadata: {
          duration: sample.metadata.duration,
          sampleRate: sample.metadata.sampleRate,
          channels: sample.metadata.channels,
          format: sample.metadata.format,
        },
      };
    });

    decisions.push({
      type: "regionsComputed",
      reason: `Computed ${regions.length} regions for articulation ${articulation.id}`,
      context: {
        articulationId: articulation.id,
        regionCount: regions.length,
        rootNotes: rootNotes.length,
      },
    });

    sampleSets.push({
      id: sampleSetId,
      samples: samplesWithRanges,
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

      const sampleSet = sampleSets[sampleSetIdx];
      if (sampleSet) {
        keyZones.push({
          range: [0, 127], // Full range, can be refined based on sample metadata
          sampleSetId: sampleSet.id,
          articulationId: articulation.id,
        });
      }
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

  // Build pre-computed note lookup table for O(1) region selection
  const noteLookup = buildNoteLookup(regions, sampleSets);

  decisions.push({
    type: "noteLookupBuilt",
    reason: `Built note lookup table for 128 MIDI notes`,
    context: { notes: 128 },
  });

  const instrument: MSFInstrument = {
    identity: {
      id: `instrument_${intent.intent.name.toLowerCase().replace(/\s+/g, "_")}_${seed}`,
      name: intent.intent.name,
      version: "0.1.0",
      description: intent.intent.description,
    },
    articulations,
    sampleSets,
    regions,
    noteLookup,
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
 * Build a pre-computed note lookup table.
 * Maps every MIDI note (0-127) to its velocity layers and region indices.
 */
function buildNoteLookup(
  regions: MsfRegion[],
  sampleSets: MSFInstrument["sampleSets"]
): NoteLookup {
  // Build sample path index
  const samplePaths = new Map<string, string>();
  for (const set of sampleSets) {
    for (const sample of set.samples) {
      samplePaths.set(sample.id, sample.path);
    }
  }

  // Initialize table with 128 empty arrays (one per MIDI note)
  const table: NoteLookupEntry[][] = Array.from({ length: 128 }, () => []);

  // Populate table from regions
  for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
    const region = regions[regionIndex]!;
    const samplePath = samplePaths.get(region.sampleId) || "";

    // Add entry for each note this region covers
    for (let note = region.loKey; note <= region.hiKey; note++) {
      table[note]!.push({
        velocityMin: region.loVel ?? 1,
        regionIndex,
        samplePath,
      });
    }
  }

  // Sort each note's velocity layers by velocityMin (ascending)
  // This allows binary search or simple iteration at runtime
  for (const layers of table) {
    layers.sort((a, b) => a.velocityMin - b.velocityMin);
  }

  return { table };
}

/**
 * Inventory interface (to be defined by @msf/builder package)
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

/**
 * Extract an Inventory interface from a compiled MSF instrument.
 * Useful for recompilation workflows.
 */
export function extractInventoryFromMSF(msf: MSFInstrument): Inventory {
  const entries = new Map<string, Sample>();

  for (const sampleSet of msf.sampleSets) {
    for (const sample of sampleSet.samples) {
      entries.set(sample.id, {
        id: sample.id,
        path: sample.path,
        metadata: {
          note: sample.note,
          velocity: sample.velocity,
          articulation: sample.articulation,
          duration: sample.metadata.duration,
          sampleRate: sample.metadata.sampleRate,
          channels: sample.metadata.channels,
          format: sample.metadata.format,
        },
      });
    }
  }

  return {
    getSample: (id: string) => entries.get(id),
    listSamples: () => Array.from(entries.values()),
  };
}

/**
 * Extract an InstrumentIntent from a compiled MSF instrument.
 * Useful for recompilation with modified parameters.
 */
export function extractIntentFromMSF(
  msf: MSFInstrument,
  paramOverrides?: Record<string, number>
): InstrumentIntent {
  const inventoryReferences = msf.sampleSets.flatMap((set) =>
    set.samples.map((sample) => ({
      id: sample.id,
      role: "primary" as const,
      constraints: {
        noteRange: sample.note
          ? ([sample.note, sample.note] as [number, number])
          : undefined,
        velocityRange: sample.velocity
          ? ([sample.velocity, sample.velocity] as [number, number])
          : undefined,
      },
    }))
  );

  const articulations = msf.articulations.map((art) => ({
    id: art.id,
    name: art.name,
    type: art.type,
    samples: msf.sampleSets
      .filter((set) => set.samples.some((s) => s.articulation === art.id))
      .flatMap((set) => set.samples.map((s) => s.id)),
    parameters: { ...art.parameters, ...(paramOverrides || {}) },
  }));

  return {
    intent: {
      name: msf.identity.name,
      description: msf.identity.description,
      instrumentType: "piano",
      targetArticulations: msf.articulations.map((a) => a.name),
    },
    inventoryReferences,
    articulations,
    mapping: {
      strategy:
        msf.mapping.velocityZones.length > 0 ? "velocityLayered" : "chromatic",
      zones: msf.mapping.velocityZones.map((zone) => ({
        velocityRange: zone.range,
        sampleSetIds: [zone.sampleSetId],
      })),
    },
  };
}

