/**
 * Auto-Generate MSF from Samples Directory
 *
 * Automatically creates an MSF instrument by scanning a samples directory
 * and extracting metadata from filenames and audio files.
 */

import { readdir, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { Inventory, scanDirectory } from "./index.js";
import { compile } from "@msf/compiler";
import type { InstrumentIntent } from "@msf/compiler";
import type { MSFInstrument } from "@msf/core";

/**
 * Convert note name to MIDI note number
 * Supports formats like: A0, C#4, Db3, D#4
 */
function noteNameToMidi(noteName: string): number {
  // Remove velocity suffix (vH, vL) and other suffixes
  const cleanName = noteName.replace(/v[HL]$/, "").replace(/_[^_]*$/, "");

  // Match: Letter + optional #/b + Octave
  const match = cleanName.match(/^([A-G])([#b]?)(\d+)$/);
  if (!match || !match[1] || !match[3]) {
    throw new Error(`Invalid note name format: ${noteName}`);
  }

  const letter = match[1];
  const accidental = match[2] || "";
  const octave = Number.parseInt(match[3], 10);

  const noteValues: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  let noteValue = noteValues[letter] ?? 0;
  if (accidental === "#") {
    noteValue += 1;
  } else if (accidental === "b") {
    noteValue -= 1;
  }

  // MIDI note = (octave + 1) * 12 + noteValue
  return (octave + 1) * 12 + noteValue;
}

/**
 * Extract velocity from filename
 * Supports: vH (high ~100), vL (low ~40), or explicit velocity numbers
 */
function extractVelocity(filename: string): number | undefined {
  if (!filename) return undefined;
  if (filename.includes("vH")) {
    return 100;
  }
  if (filename.includes("vL")) {
    return 40;
  }
  // Try to find velocity number (e.g., v80, vel100)
  const velMatch = filename.match(/[vV](?:el(?:ocity)?)?(\d+)/);
  if (velMatch?.[1]) {
    return Number.parseInt(velMatch[1], 10);
  }
  return undefined;
}

/**
 * Extract articulation from filename
 */
function extractArticulation(filename: string): string {
  const articulations = ["sustain", "staccato", "legato", "tremolo", "vibrato", "pizzicato", "bowed"];
  const lower = filename.toLowerCase();
  for (const art of articulations) {
    if (lower.includes(art)) {
      return art;
    }
  }
  return "sustain"; // Default
}

/**
 * Auto-generate an MSF instrument from a samples directory
 *
 * Scans the directory, extracts metadata from filenames, and automatically
 * creates an MSF instrument with appropriate mapping.
 *
 * @param samplesDir - Directory containing sample files
 * @param instrumentName - Name for the instrument
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * const instrument = await autoGenerateMSF(
 *   "./samples/piano",
 *   "Upright Piano",
 *   { groupByVelocity: true }
 * );
 * ```
 */
export async function autoGenerateMSF(
  samplesDir: string,
  instrumentName: string,
  options: {
    /** Group samples by velocity into separate articulations */
    groupByVelocity?: boolean;
    /** Default velocity threshold for grouping (default: 70) */
    velocityThreshold?: number;
    /** Instrument type */
    instrumentType?: string;
  } = {}
): Promise<MSFInstrument> {
  const { groupByVelocity = true, velocityThreshold = 70, instrumentType = "piano" } = options;

  // Scan directory to build inventory
  const inventory = await scanDirectory(samplesDir);

  // Group samples by velocity if requested
  const entries = inventory.list();
  let articulations: InstrumentIntent["articulations"];

  if (groupByVelocity) {
    const lowVelocitySamples = entries.filter(
      (e) => (e.metadata.velocity ?? 0) < velocityThreshold
    );
    const highVelocitySamples = entries.filter(
      (e) => (e.metadata.velocity ?? 0) >= velocityThreshold
    );

    articulations = [];

    if (lowVelocitySamples.length > 0) {
      articulations.push({
        id: "art_piano",
        name: "piano",
        type: "velocity-layer",
        samples: lowVelocitySamples.map((e) => e.id),
        parameters: {
          attack: 0.01,
          release: 0.3,
          brightness: 0.5,
          room: 0.2,
          warmth: 0.5,
          presence: 0.5,
        },
      });
    }

    if (highVelocitySamples.length > 0) {
      articulations.push({
        id: "art_forte",
        name: "forte",
        type: "velocity-layer",
        samples: highVelocitySamples.map((e) => e.id),
        parameters: {
          attack: 0.01,
          release: 0.3,
          brightness: 0.5,
          room: 0.2,
          warmth: 0.5,
          presence: 0.5,
        },
      });
    }
  } else {
    // Single articulation with all samples
    articulations = [
      {
        id: "art_default",
        name: "default",
        type: "default",
        samples: entries.map((e) => e.id),
        parameters: {
          attack: 0.01,
          release: 0.3,
          brightness: 0.5,
          room: 0.2,
          warmth: 0.5,
          presence: 0.5,
        },
      },
    ];
  }

  // Create intent
  const intent: InstrumentIntent = {
    intent: {
      name: instrumentName,
      description: `Auto-generated ${instrumentType} from ${samplesDir}`,
      instrumentType,
      targetArticulations: articulations.map((a) => a.name),
    },
    inventoryReferences: entries.map((e) => ({
      id: e.id,
      role: "primary" as const,
      constraints: {
        noteRange: e.metadata.note ? [e.metadata.note, e.metadata.note] as [number, number] : undefined,
        velocityRange: e.metadata.velocity ? [e.metadata.velocity, e.metadata.velocity] as [number, number] : undefined,
      },
    })),
    articulations,
    mapping: {
      strategy: groupByVelocity ? "velocityLayered" : "chromatic",
      zones: groupByVelocity
        ? [
            {
              velocityRange: [0, velocityThreshold - 1] as [number, number],
              sampleSetIds: (() => {
                const piano = articulations.find((a) => a.name === "piano");
                return piano ? [piano.id] : [];
              })(),
            },
            {
              velocityRange: [velocityThreshold, 127] as [number, number],
              sampleSetIds: (() => {
                const forte = articulations.find((a) => a.name === "forte");
                return forte ? [forte.id] : [];
              })(),
            },
          ].filter((z) => z.sampleSetIds.length > 0)
        : undefined,
    },
  };

  // Compile to MSF
  const { instrument } = await compile(intent, inventory, {
    strict: false,
  });

  return instrument;
}

/**
 * Enhance inventory with metadata extracted from filenames
 *
 * This improves the metadata extraction from the basic scanDirectory
 * by parsing note names and velocities from filenames.
 */
export async function enhanceInventoryFromFilenames(
  inventory: Inventory,
  samplesDir: string
): Promise<Inventory> {
  const files = await readdir(samplesDir);
  const audioFiles = files.filter((f) =>
    [".wav", ".aiff", ".mp3", ".flac", ".ogg"].includes(extname(f).toLowerCase())
  );

  const enhancedInventory = new Inventory();

  for (const filename of audioFiles) {
    if (!filename) continue;
    const filePath = join(samplesDir, filename);
    const normalizedName = basename(filename, extname(filename));

    try {
      // Try to extract note and velocity from filename
      const note = noteNameToMidi(normalizedName);
      const velocity = extractVelocity(normalizedName);
      const articulation = extractArticulation(normalizedName);

      // Find existing entry or create new one
      const existing = inventory.list().find((e) => e.path === filePath);
      if (existing) {
        enhancedInventory.add({
          ...existing,
          metadata: {
            ...existing.metadata,
            note: existing.metadata.note ?? note,
            velocity: existing.metadata.velocity ?? velocity,
            articulation: existing.metadata.articulation ?? articulation,
          },
        });
      } else {
        // Create new entry
        await stat(filePath); // Verify file exists
        enhancedInventory.add({
          id: `sample_${normalizedName}`,
          path: filePath,
          normalizedName,
          metadata: {
            note,
            velocity,
            articulation,
            audio: {
              duration: 0, // Would need audio library to read actual duration
              sampleRate: 44100, // Default, would read from file
              channels: 2, // Default, would read from file
              format: extname(filename).slice(1).toLowerCase(),
            },
          },
          provenance: {
            scannedAt: new Date().toISOString(),
            sourcePath: filePath,
            checksum: `auto_${normalizedName}`,
          },
        });
      }
    } catch (error) {
      // Skip files that can't be parsed
      console.warn(`Skipping ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return enhancedInventory;
}

