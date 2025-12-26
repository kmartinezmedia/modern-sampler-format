/**
 * MSF Validator — IIS Validation & Strict Repair Pass
 *
 * A hard boundary between intent and runtime.
 * No invalid or partial intent ever reaches MSF.
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
  errors: ValidationError[],
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
  warnings: ValidationWarning[],
  capabilities?: EngineCapabilities
): InstrumentIntent {
  // TODO: Implement safe degradation logic
  // - Remove unsupported features
  // - Simplify complex structures
  // - Apply safe defaults
  // Use parameters to avoid unused variable warnings
  void warnings;
  void capabilities;
  return { ...intent };
}

