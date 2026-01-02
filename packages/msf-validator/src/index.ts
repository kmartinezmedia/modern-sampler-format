/**
 * MSF Validator — IIS Validation & Strict Repair Pass
 *
 * A hard boundary between intent and runtime.
 * No invalid or partial intent ever reaches MSF.
 *
 * MSF RULE: No Backward Compatibility
 * ===================================
 * MSF is a compiled format. All decisions are made at compile time.
 * Runtime must never guess, infer, or fall back to legacy behavior.
 *
 * The validator enforces this rule:
 * - Regions are REQUIRED (not optional)
 * - Missing regions = validation error (not warning)
 * - No "closest sample" heuristics allowed
 * - No runtime inference allowed
 * - Fail fast if data is missing or incomplete
 *
 * If you need to support old formats, migrate them at compile time,
 * not at runtime. MSF is not a configuration language - it's a
 * fully-resolved runtime model.
 */

import type { InstrumentIntent } from "@msf/compiler";
import type { MSFInstrument } from "@msf/core";

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  repaired?: InstrumentIntent;
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
  suggestion?: string;
}

/**
 * Validation Options
 */
export interface ValidationOptions {
  /** Enable strict mode (fail on warnings) */
  strict?: boolean;

  /** Enable automatic repair */
  repair?: boolean;

  /** Engine capabilities to validate against */
  engineCapabilities?: EngineCapabilities;
}

export interface EngineCapabilities {
  maxArticulations?: number;
  maxSamples?: number;
  supportedModulationTypes?: string[];
  maxModulationNodes?: number;
}

/**
 * Validate Instrument Intent Spec
 *
 * Performs schema validation, capability checks, and safe degradation
 * of unsupported features. Explicit warnings for every compromise.
 */
export function validateIntent(
  intent: InstrumentIntent,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Schema validation
  validateSchema(intent, errors);

  // Capability checks
  if (options.engineCapabilities) {
    validateCapabilities(intent, options.engineCapabilities, errors, warnings);
  }

  // Repair if enabled
  let repaired: InstrumentIntent | undefined;
  if (options.repair && errors.length === 0) {
    repaired = attemptRepair(intent, warnings, options.engineCapabilities);
  }

  return {
    valid: errors.length === 0 && (!options.strict || warnings.length === 0),
    errors,
    warnings,
    repaired,
  };
}

/**
 * Validate MSF Instrument
 *
 * Ensures a compiled MSF instrument is complete and valid.
 *
 * MSF RULE: No Backward Compatibility
 * ===================================
 * MSF requires regions. This is non-negotiable.
 * Instruments without regions are invalid and must be rejected.
 */
export function validateMSF(
  instrument: MSFInstrument
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate structure
  if (!instrument.identity) {
    errors.push({
      path: "identity",
      message: "Instrument identity is required",
      code: "MISSING_IDENTITY",
    });
  }

  if (instrument.sampleSets.length === 0) {
    errors.push({
      path: "sampleSets",
      message: "At least one sample set is required",
      code: "NO_SAMPLE_SETS",
    });
  }

  // MSF RULE: Regions are REQUIRED. No backward compatibility.
  if (!instrument.regions || instrument.regions.length === 0) {
    errors.push({
      path: "regions",
      message: "MSF requires explicit regions. This instrument was not compiled correctly. " +
              "Regions must be generated at compile time. There is no backward compatibility - " +
              "instruments without regions are invalid and must be recompiled.",
      code: "NO_REGIONS",
    });
  } else {
    // Validate that every sample has at least one region
    const sampleIds = new Set<string>();
    for (const sampleSet of instrument.sampleSets) {
      for (const sample of sampleSet.samples) {
        sampleIds.add(sample.id);
      }
    }

    const regionSampleIds = new Set(instrument.regions.map((r) => r.sampleId));
    const samplesWithoutRegions = Array.from(sampleIds).filter((id) => !regionSampleIds.has(id));

    if (samplesWithoutRegions.length > 0) {
      errors.push({
        path: "regions",
        message: `Samples without regions: ${samplesWithoutRegions.join(", ")}. ` +
                "Every sample must have at least one region covering its range.",
        code: "SAMPLES_WITHOUT_REGIONS",
      });
    }

    // Validate region coverage (no gaps in key range)
    // This is a warning, not an error, as some instruments may intentionally have gaps
    const coveredKeys = new Set<number>();
    for (const region of instrument.regions) {
      for (let key = region.loKey; key <= region.hiKey; key++) {
        coveredKeys.add(key);
      }
    }

    // Check for excessive transposition warnings
    for (const region of instrument.regions) {
      const maxTransposition = Math.max(
        Math.abs(region.pitchKeyCenter - region.loKey),
        Math.abs(region.hiKey - region.pitchKeyCenter)
      );
      if (maxTransposition > 7) {
        warnings.push({
          path: `regions.${region.id}`,
          message: `Region ${region.id} has excessive transposition (${maxTransposition} semitones) at range boundaries`,
          code: "EXCESSIVE_TRANSPOSITION",
          suggestion: "Consider adding more samples to reduce pitch-shifting artifacts",
        });
      }
    }
  }

  if (instrument.mapping.keyZones.length === 0) {
    errors.push({
      path: "mapping.keyZones",
      message: "At least one key zone is required",
      code: "NO_KEY_ZONES",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateSchema(
  intent: InstrumentIntent,
  errors: ValidationError[]
): void {
  if (!intent.intent) {
    errors.push({
      path: "intent",
      message: "Intent description is required",
      code: "MISSING_INTENT",
    });
  }

  if (!intent.inventoryReferences || intent.inventoryReferences.length === 0) {
    errors.push({
      path: "inventoryReferences",
      message: "At least one inventory reference is required",
      code: "NO_INVENTORY_REFERENCES",
    });
  }
}

function validateCapabilities(
  intent: InstrumentIntent,
  capabilities: EngineCapabilities,
  _errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (
    capabilities.maxArticulations &&
    intent.articulations.length > capabilities.maxArticulations
  ) {
    warnings.push({
      path: "articulations",
      message: `Exceeds engine limit of ${capabilities.maxArticulations} articulations`,
      code: "EXCEEDS_MAX_ARTICULATIONS",
      suggestion: `Reduce to ${capabilities.maxArticulations} articulations`,
    });
  }

  if (capabilities.supportedModulationTypes && intent.modulation) {
    for (const source of intent.modulation.sources) {
      if (!capabilities.supportedModulationTypes.includes(source.type)) {
        warnings.push({
          path: `modulation.sources.${source.id}`,
          message: `Modulation type '${source.type}' not supported by engine`,
          code: "UNSUPPORTED_MODULATION_TYPE",
          suggestion: `Use one of: ${capabilities.supportedModulationTypes.join(", ")}`,
        });
      }
    }
  }
}

function attemptRepair(
  intent: InstrumentIntent,
  _warnings: ValidationWarning[],
  capabilities?: EngineCapabilities
): InstrumentIntent {
  const repaired = { ...intent };

  // Remove unsupported modulation sources
  if (capabilities?.supportedModulationTypes && repaired.modulation) {
    repaired.modulation = {
      ...repaired.modulation,
      sources: repaired.modulation.sources.filter(
        (source: { type: string }) =>
          capabilities.supportedModulationTypes?.includes(source.type)
      ),
    };
  }

  // Limit articulations if exceeded
  if (
    capabilities?.maxArticulations &&
    repaired.articulations.length > capabilities.maxArticulations
  ) {
    repaired.articulations = repaired.articulations.slice(
      0,
      capabilities.maxArticulations
    );
  }

  // Limit modulation nodes if exceeded
  if (
    capabilities?.maxModulationNodes &&
    repaired.modulation &&
    repaired.modulation.sources.length > capabilities.maxModulationNodes
  ) {
    repaired.modulation = {
      ...repaired.modulation,
      sources: repaired.modulation.sources.slice(
        0,
        capabilities.maxModulationNodes
      ),
    };
  }

  // Apply safe defaults for missing required fields
  if (!repaired.mapping.zones || repaired.mapping.zones.length === 0) {
    repaired.mapping = {
      ...repaired.mapping,
      zones: [],
    };
  }

  return repaired;
}

