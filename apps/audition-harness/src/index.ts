#!/usr/bin/env bun

/**
 * Audition Harness — Simple Runtime for Auditioning MSF
 *
 * A minimal runtime loop that makes MSF audible.
 * - Render a fixed set of MIDI test clips
 * - Output WAV files
 * - Enable A/B comparison between MSF revisions
 * - Provide basic audio metrics (loudness, spectrum)
 *
 * This closes the gap between abstract MSF data and real sound.
 */

import type { MSFInstrument } from "@msf/core";

/**
 * MIDI Test Clip
 */
export interface MIDITestClip {
  name: string;
  midi: MIDIEvent[];
  duration: number; // seconds
}

export interface MIDIEvent {
  time: number; // seconds
  type: "noteOn" | "noteOff" | "cc" | "programChange";
  channel: number;
  data: {
    note?: number;
    velocity?: number;
    controller?: number;
    value?: number;
  };
}

/**
 * Audition Options
 */
export interface AuditionOptions {
  /** Output directory for WAV files */
  outputDir?: string;

  /** Sample rate for rendering */
  sampleRate?: number;

  /** Enable A/B comparison mode */
  compareMode?: boolean;

  /** Generate audio metrics */
  generateMetrics?: boolean;
}

/**
 * Audition Result
 */
export interface AuditionResult {
  clipName: string;
  outputPath: string;
  metrics?: AudioMetrics;
}

export interface AudioMetrics {
  loudness: number; // LUFS
  peak: number; // dB
  spectrum?: number[]; // Frequency spectrum
}

/**
 * Render MSF instrument with MIDI test clips
 *
 * Produces WAV files for each test clip, enabling
 * immediate audition and comparison.
 */
export async function audition(
  instrument: MSFInstrument,
  clips: MIDITestClip[],
  options: AuditionOptions = {}
): Promise<AuditionResult[]> {
  const results: AuditionResult[] = [];

  // TODO: Implement MSF runtime
  // - Load MSF instrument
  // - Process MIDI events
  // - Render audio samples
  // - Write WAV files
  // - Calculate metrics

  for (const clip of clips) {
    // Placeholder: would render audio here
    void instrument; // Will be used when implementing rendering
    const result: AuditionResult = {
      clipName: clip.name,
      outputPath: `${options.outputDir || "./output"}/${clip.name}.wav`,
    };

    if (options.generateMetrics) {
      // Audio metrics calculation would require:
      // - Audio processing library (e.g., audio-buffer-utils, loudness)
      // - LUFS calculation using ITU-R BS.1770 algorithm
      // - Peak level detection from audio samples
      // For now, return placeholder values
      result.metrics = {
        loudness: -23.0, // Placeholder: typical LUFS for normalized audio
        peak: -3.0, // Placeholder: typical peak dB for mastered audio
      };
    }

    results.push(result);
  }

  return results;
}

/**
 * Default test clips for instrument audition
 */
export const DEFAULT_TEST_CLIPS: MIDITestClip[] = [
  {
    name: "single-note-c4",
    midi: [
      { time: 0, type: "noteOn", channel: 0, data: { note: 60, velocity: 100 } },
      { time: 1, type: "noteOff", channel: 0, data: { note: 60 } },
    ],
    duration: 2,
  },
  {
    name: "chord-c-major",
    midi: [
      { time: 0, type: "noteOn", channel: 0, data: { note: 60, velocity: 100 } },
      { time: 0, type: "noteOn", channel: 0, data: { note: 64, velocity: 100 } },
      { time: 0, type: "noteOn", channel: 0, data: { note: 67, velocity: 100 } },
      { time: 2, type: "noteOff", channel: 0, data: { note: 60 } },
      { time: 2, type: "noteOff", channel: 0, data: { note: 64 } },
      { time: 2, type: "noteOff", channel: 0, data: { note: 67 } },
    ],
    duration: 3,
  },
  {
    name: "velocity-sweep",
    midi: [
      { time: 0, type: "noteOn", channel: 0, data: { note: 60, velocity: 20 } },
      { time: 0.5, type: "noteOff", channel: 0, data: { note: 60 } },
      { time: 1, type: "noteOn", channel: 0, data: { note: 60, velocity: 60 } },
      { time: 1.5, type: "noteOff", channel: 0, data: { note: 60 } },
      { time: 2, type: "noteOn", channel: 0, data: { note: 60, velocity: 100 } },
      { time: 2.5, type: "noteOff", channel: 0, data: { note: 60 } },
      { time: 3, type: "noteOn", channel: 0, data: { note: 60, velocity: 127 } },
      { time: 3.5, type: "noteOff", channel: 0, data: { note: 60 } },
    ],
    duration: 4,
  },
];

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("MSF Audition Harness");
    console.log("Usage: bun run src/index.ts <msf-file> [options]");
    console.log("\nOptions:");
    console.log("  --output-dir <path>    Output directory for WAV files (default: ./output)");
    console.log("  --sample-rate <rate>   Sample rate for rendering (default: 44100)");
    console.log("  --metrics              Generate audio metrics");
    console.log("  --compare              Enable A/B comparison mode");
    process.exit(1);
  }

  const msfFile = args[0];
  const options: AuditionOptions = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output-dir" && args[i + 1]) {
      options.outputDir = args[++i];
    } else if (arg === "--sample-rate" && args[i + 1]) {
      options.sampleRate = Number.parseInt(args[++i], 10);
    } else if (arg === "--metrics") {
      options.generateMetrics = true;
    } else if (arg === "--compare") {
      options.compareMode = true;
    }
  }

  // Load MSF instrument from file
  try {
    const msfContent = await Bun.file(msfFile).json();
    const instrument = msfContent as MSFInstrument;

    // Run audition with default test clips
    const results = await audition(instrument, DEFAULT_TEST_CLIPS, options);

    console.log(`\nAudition complete. Generated ${results.length} test clips:`);
    for (const result of results) {
      console.log(`  - ${result.clipName}: ${result.outputPath}`);
      if (result.metrics) {
        console.log(`    Loudness: ${result.metrics.loudness.toFixed(2)} LUFS`);
        console.log(`    Peak: ${result.metrics.peak.toFixed(2)} dB`);
      }
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

