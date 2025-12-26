/**
 * Inventory — Canonical Sample Inventory System
 *
 * A canonical inventory of available samples.
 * Acts as the only source of truth for audio assets.
 * Prevents hallucination and anchors MSF in reality.
 */

/**
 * Inventory Entry
 *
 * Represents a single sample in the inventory with normalized metadata.
 */
export interface InventoryEntry {
  /** Unique identifier for this sample */
  id: string;

  /** File system path to the audio file */
  path: string;

  /** Normalized filename (without extension) */
  normalizedName: string;

  /** Extracted metadata */
  metadata: SampleMetadata;

  /** Provenance information */
  provenance: {
    scannedAt: string;
    sourcePath: string;
    checksum?: string;
  };
}

export interface SampleMetadata {
  /** MIDI note number (if extractable from filename/metadata) */
  note?: number;

  /** MIDI velocity (if extractable) */
  velocity?: number;

  /** Round-robin index (if extractable) */
  roundRobin?: number;

  /** Articulation name (if extractable) */
  articulation?: string;

  /** Audio file metadata */
  audio: {
    duration: number;
    sampleRate: number;
    channels: number;
    format: string;
    bitDepth?: number;
  };
}

/**
 * Inventory
 *
 * The canonical inventory of all available samples.
 */
export class Inventory {
  private entries: Map<string, InventoryEntry> = new Map();

  /**
   * Add an entry to the inventory
   */
  add(entry: InventoryEntry): void {
    this.entries.set(entry.id, entry);
  }

  /**
   * Get an entry by ID
   */
  get(id: string): InventoryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * List all entries
   */
  list(): InventoryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Search entries by criteria
   */
  search(criteria: SearchCriteria): InventoryEntry[] {
    const results: InventoryEntry[] = [];

    for (const entry of this.entries.values()) {
      if (matchesCriteria(entry, criteria)) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Get inventory statistics
   */
  getStats(): InventoryStats {
    const entries = Array.from(this.entries.values());
    const articulations = new Set<string>();
    const notes = new Set<number>();

    for (const entry of entries) {
      if (entry.metadata.articulation) {
        articulations.add(entry.metadata.articulation);
      }
      if (entry.metadata.note !== undefined) {
        notes.add(entry.metadata.note);
      }
    }

    return {
      totalSamples: entries.length,
      uniqueArticulations: articulations.size,
      noteRange: notes.size > 0
        ? [Math.min(...notes), Math.max(...notes)]
        : undefined,
      formats: Array.from(
        new Set(entries.map((e) => e.metadata.audio.format))
      ),
    };
  }
}

export interface SearchCriteria {
  note?: number | [number, number];
  velocity?: number | [number, number];
  articulation?: string;
  roundRobin?: number;
}

export interface InventoryStats {
  totalSamples: number;
  uniqueArticulations: number;
  noteRange?: [number, number];
  formats: string[];
}

function matchesCriteria(
  entry: InventoryEntry,
  criteria: SearchCriteria
): boolean {
  if (criteria.note !== undefined) {
    const note = entry.metadata.note;
    if (note === undefined) return false;

    if (Array.isArray(criteria.note)) {
      const [min, max] = criteria.note;
      if (note < min || note > max) return false;
    } else if (note !== criteria.note) {
      return false;
    }
  }

  if (criteria.velocity !== undefined) {
    const velocity = entry.metadata.velocity;
    if (velocity === undefined) return false;

    if (Array.isArray(criteria.velocity)) {
      const [min, max] = criteria.velocity;
      if (velocity < min || velocity > max) return false;
    } else if (velocity !== criteria.velocity) {
      return false;
    }
  }

  if (criteria.articulation !== undefined) {
    if (entry.metadata.articulation !== criteria.articulation) {
      return false;
    }
  }

  if (criteria.roundRobin !== undefined) {
    if (entry.metadata.roundRobin !== criteria.roundRobin) {
      return false;
    }
  }

  return true;
}

/**
 * Scan a directory and build inventory
 */
export async function scanDirectory(
  directoryPath: string,
  options: ScanOptions = {}
): Promise<Inventory> {
  const inventory = new Inventory();
  const defaultExtensions = [".wav", ".aiff", ".mp3", ".flac", ".ogg"];
  const extensions = options.extensions || defaultExtensions;
  const maxDepth = options.maxDepth ?? Infinity;
  const ignoreHidden = options.ignoreHidden ?? true;

  async function scanRecursive(
    dir: string,
    depth: number
  ): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await Array.fromAsync(
        Bun.file(dir).stream().pipeThrough(new Bun.Transcoder())
      );

      for await (const entry of await Bun.file(dir).arrayBuffer()) {
        // Note: Bun's file system API is async iterator-based
        // This is a simplified implementation
        // Full implementation would use proper directory traversal
      }

      // Simplified: use Bun's glob or readdir
      const files = await Array.fromAsync(
        new Bun.Glob(`**/*{${extensions.join(",")}}`).scan({
          cwd: dir,
          onlyFiles: true,
        })
      );

      for (const file of files) {
        const fullPath = `${dir}/${file}`;
        if (ignoreHidden && file.includes("/.")) continue;

        try {
          const entry = await createInventoryEntry(fullPath, file);
          inventory.add(entry);
        } catch (error) {
          // Skip files that can't be processed
          console.warn(`Skipping ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      console.warn(`Error scanning ${dir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await scanRecursive(directoryPath, 0);
  return inventory;
}

async function createInventoryEntry(
  filePath: string,
  relativePath: string
): Promise<InventoryEntry> {
  const file = Bun.file(filePath);
  const stats = await file.stat();
  const normalizedName = relativePath.replace(/\.[^.]+$/, "");

  // Extract metadata from filename
  // Common patterns: note_velocity_articulation_rr.wav
  const metadata = extractMetadataFromFilename(normalizedName);

  // Generate unique ID from file path
  const id = generateId(filePath);

  // Read basic audio info (simplified - would need audio library for full metadata)
  const audioMetadata = {
    duration: 0, // Would require audio file parsing
    sampleRate: 44100, // Default, would read from file
    channels: 2, // Default, would read from file
    format: filePath.split(".").pop()?.toLowerCase() || "unknown",
  };

  return {
    id,
    path: filePath,
    normalizedName,
    metadata: {
      ...metadata,
      audio: audioMetadata,
    },
    provenance: {
      scannedAt: new Date().toISOString(),
      sourcePath: filePath,
      checksum: await calculateChecksum(filePath),
    },
  };
}

function extractMetadataFromFilename(filename: string): {
  note?: number;
  velocity?: number;
  roundRobin?: number;
  articulation?: string;
} {
  const parts = filename.split(/[_-]/);
  const metadata: {
    note?: number;
    velocity?: number;
    roundRobin?: number;
  } = {};

  for (const part of parts) {
    // Try to parse as MIDI note (0-127)
    const note = Number.parseInt(part, 10);
    if (!Number.isNaN(note) && note >= 0 && note <= 127) {
      if (metadata.note === undefined) {
        metadata.note = note;
      } else if (metadata.velocity === undefined) {
        metadata.velocity = note;
      } else if (metadata.roundRobin === undefined) {
        metadata.roundRobin = note;
      }
    }

    // Check for articulation keywords
    const articulationKeywords = [
      "legato",
      "staccato",
      "sustain",
      "tremolo",
      "vibrato",
      "pizzicato",
      "bowed",
    ];
    for (const keyword of articulationKeywords) {
      if (part.toLowerCase().includes(keyword)) {
        return { ...metadata, articulation: keyword };
      }
    }
  }

  return metadata;
}

function generateId(filePath: string): string {
  // Generate a deterministic ID from file path
  return `sample_${Buffer.from(filePath).toString("base64url").slice(0, 16)}`;
}

async function calculateChecksum(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  const hash = new Bun.CryptoHasher("sha256");
  const buffer = await file.arrayBuffer();
  hash.update(buffer);
  return hash.digest("hex");
}

export interface ScanOptions {
  /** File extensions to include (default: common audio formats) */
  extensions?: string[];

  /** Recursive depth limit */
  maxDepth?: number;

  /** Naming pattern for metadata extraction */
  namingPattern?: string;

  /** Ignore hidden files/directories */
  ignoreHidden?: boolean;
}

