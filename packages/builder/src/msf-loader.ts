/**
 * MSF Package Loader
 *
 * Utilities for loading MSF instruments from npm packages.
 * Makes it easy for consumers to download and use MSF packages.
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import type { MSFInstrument } from "@msf/core";
import { Inventory } from "./index.js";
import type { InventoryEntry } from "./index.js";
import type { InstrumentIntent } from "@msf/compiler";
import type { SampleSet, Articulation, VelocityZone } from "@msf/core";

// Create require for ESM compatibility
const require = createRequire(import.meta.url);

/**
 * Load an MSF instrument from an npm package
 *
 * @param packageName - The npm package name (e.g., "@msf/examples")
 * @param instrumentPath - Path to the MSF JSON file within the package (e.g., "piano/msf")
 * @returns The loaded and resolved MSF instrument
 *
 * @example
 * ```typescript
 * const instrument = await loadMSFFromPackage("@msf/examples", "piano/msf");
 * ```
 */
export async function loadMSFFromPackage(
  packageName: string,
  instrumentPath: string
): Promise<MSFInstrument> {
  // Use require.resolve to get the absolute path
  const msfPath = require.resolve(`${packageName}/${instrumentPath}`);
  const msfData = JSON.parse(await readFile(msfPath, "utf-8"));

  // Resolve relative paths in samples to absolute paths
  // Paths in MSF are relative to the MSF file location
  const msfDir = dirname(msfPath);
  const resolvedMSF: MSFInstrument = {
    ...msfData,
    sampleSets: msfData.sampleSets.map((set: { samples: Array<{ path: string }> }) => ({
      ...set,
      samples: set.samples.map((sample: { path: string }) => ({
        ...sample,
        path: sample.path.startsWith("/")
          ? sample.path
          : join(msfDir, sample.path), // Resolve relative paths
      })),
    })),
  };

  return resolvedMSF;
}

/**
 * Extract inventory from a compiled MSF instrument
 *
 * Converts the MSF instrument's sample sets back into an Inventory
 * for recompilation or modification purposes.
 *
 * @param msf - The compiled MSF instrument
 * @returns An Inventory containing all samples from the MSF
 *
 * @example
 * ```typescript
 * const msf = await loadMSFFromPackage("@msf/examples", "piano/msf");
 * const inventory = extractInventoryFromMSF(msf);
 * ```
 */
export function extractInventoryFromMSF(msf: MSFInstrument): Inventory {
  const inventory = new Inventory();

  for (const sampleSet of msf.sampleSets as SampleSet[]) {
    for (const sample of sampleSet.samples) {
      const entry: InventoryEntry = {
        id: sample.id,
        path: sample.path,
        normalizedName: sample.id.replace(/^[^_]+_/, ""), // Remove instrument prefix
        metadata: {
          note: sample.note,
          velocity: sample.velocity,
          articulation: sample.articulation,
          audio: {
            duration: sample.metadata.duration,
            sampleRate: sample.metadata.sampleRate,
            channels: sample.metadata.channels,
            format: sample.metadata.format,
          },
        },
        provenance: {
          scannedAt: new Date().toISOString(),
          sourcePath: sample.path,
          checksum: `msf_${sample.id}`,
        },
      };

      inventory.add(entry);
    }
  }

  return inventory;
}

/**
 * Extract intent from a compiled MSF instrument with optional parameter overrides
 *
 * Reconstructs the Instrument Intent Spec from the compiled MSF.
 * Useful for recompiling with modified parameters.
 *
 * @param msf - The compiled MSF instrument
 * @param parameterOverrides - Optional parameter overrides to apply to all articulations
 * @returns The reconstructed Instrument Intent Spec
 *
 * @example
 * ```typescript
 * const msf = await loadMSFFromPackage("@msf/examples", "piano/msf");
 * const intent = extractIntentFromMSF(msf, {
 *   attack: 0.02,
 *   release: 0.4,
 * });
 * ```
 */
export function extractIntentFromMSF(
  msf: MSFInstrument,
  parameterOverrides?: {
    attack?: number;
    release?: number;
    brightness?: number;
    room?: number;
    warmth?: number;
    presence?: number;
    [key: string]: unknown;
  }
): InstrumentIntent {
  const inventoryReferences = (msf.sampleSets as SampleSet[]).flatMap((set: SampleSet) =>
    set.samples.map((sample: { id: string; note?: number; velocity?: number }) => ({
      id: sample.id,
      role: "primary" as const,
      constraints: {
        noteRange: sample.note ? [sample.note, sample.note] as [number, number] : undefined,
        velocityRange: sample.velocity ? [sample.velocity, sample.velocity] as [number, number] : undefined,
      },
    }))
  );

  const articulations = (msf.articulations as Articulation[]).map((art) => ({
    id: art.id,
    name: art.name,
    type: art.type,
    samples: (msf.sampleSets as SampleSet[])
      .filter((set: SampleSet) => set.samples.some((s: { articulation?: string }) => s.articulation === art.id))
      .flatMap((set: SampleSet) => set.samples.map((s: { id: string }) => s.id)),
    parameters: {
      ...art.parameters,
      ...(parameterOverrides || {}),
    },
  }));

  const intent: InstrumentIntent = {
    intent: {
      name: msf.identity.name,
      description: msf.identity.description,
      instrumentType: msf.identity.name.toLowerCase().includes("piano") ? "piano" : "unknown",
      targetArticulations: (msf.articulations as Articulation[]).map((a: Articulation) => a.name),
    },
    inventoryReferences,
    articulations,
    mapping: {
      strategy: msf.mapping.velocityZones.length > 0 ? "velocityLayered" : "chromatic",
      zones: (msf.mapping.velocityZones as VelocityZone[]).map((zone: VelocityZone) => ({
        velocityRange: zone.range,
        sampleSetIds: [zone.sampleSetId],
      })),
    },
  };

  return intent;
}

