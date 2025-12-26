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
import { MSFRuntime, renderToWAV, calculateMetrics } from "@msf/runtime";

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
  const sampleRate = options.sampleRate || 44100;
  const outputDir = options.outputDir || "./output";

  // Ensure output directory exists
  try {
    if (typeof Bun !== "undefined") {
      const { $ } = await import("bun");
      await $`mkdir -p ${outputDir}`.quiet();
    }
  } catch {
    // Directory might already exist
  }

  for (const clip of clips) {
    // Create runtime instance
    const runtime = new MSFRuntime(instrument, sampleRate);

    // Process MIDI events
    const sortedEvents = [...clip.midi].sort((a, b) => a.time - b.time);
    let currentTime = 0;
    const audioBuffer: Float32Array[] = [];

    for (const event of sortedEvents) {
      // Render audio up to this event
      const framesUntilEvent = Math.floor(
        (event.time - currentTime) * sampleRate
      );
      if (framesUntilEvent > 0) {
        const chunk = runtime.render(framesUntilEvent);
        audioBuffer.push(chunk);
      }

      // Process event
      if (event.type === "noteOn" && event.data.note !== undefined) {
        runtime.noteOn(
          event.data.note,
          event.data.velocity || 100,
          event.time
        );
        runtime.processRules("noteOn", event.data.note, event.data.velocity || 100);
      } else if (event.type === "noteOff" && event.data.note !== undefined) {
        runtime.noteOff(event.data.note, event.time);
        runtime.processRules("noteOff", event.data.note, 0);
      }

      currentTime = event.time;
    }

    // Render remaining audio
    const remainingFrames = Math.floor(
      (clip.duration - currentTime) * sampleRate
    );
    if (remainingFrames > 0) {
      const chunk = runtime.render(remainingFrames);
      audioBuffer.push(chunk);
    }

    // Combine audio buffers
    const totalFrames = audioBuffer.reduce((sum, buf) => sum + buf.length / 2, 0);
    const combinedBuffer = new Float32Array(totalFrames * 2);
    let offset = 0;
    for (const buf of audioBuffer) {
      combinedBuffer.set(buf, offset);
      offset += buf.length;
    }

    // Write WAV file
    const outputPath = `${outputDir}/${clip.name}.wav`;
    if (outputPath) {
      await renderToWAV(runtime, clip.duration, sampleRate, outputPath);
    }

    const result: AuditionResult = {
      clipName: clip.name,
      outputPath,
    };

    // Calculate metrics if requested
    if (options.generateMetrics) {
      result.metrics = calculateMetrics(combinedBuffer);
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
      const dir = args[++i];
      if (dir) {
        options.outputDir = dir;
      }
    } else if (arg === "--sample-rate" && args[i + 1]) {
      const rate = args[++i];
      if (rate) {
        options.sampleRate = Number.parseInt(rate, 10);
      }
    } else if (arg === "--metrics") {
      options.generateMetrics = true;
    } else if (arg === "--compare") {
      options.compareMode = true;
    }
  }

  // Load MSF instrument from file
  if (!msfFile) {
    console.error("Error: MSF file path is required");
    process.exit(1);
  }

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

