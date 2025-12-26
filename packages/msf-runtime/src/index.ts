/**
 * MSF Runtime — MSF Instrument Playback Engine
 *
 * Processes MSF instruments and renders audio from MIDI events.
 * Provides deterministic playback behavior as specified by MSF.
 */

import type {
  MSFInstrument,
  Sample,
  SampleSet,
  PerformanceRule,
} from "@msf/core";

/**
 * Active voice state
 */
interface ActiveVoice {
  note: number;
  velocity: number;
  startTime: number;
  sample: Sample;
  sampleSet: SampleSet;
  position: number; // Current playback position in samples
  gain: number;
  articulationId?: string;
}

/**
 * Runtime state
 */
export class MSFRuntime {
  private instrument: MSFInstrument;
  private sampleRate: number;
  private activeVoices = new Map<number, ActiveVoice>();
  private roundRobinState = new Map<string, number>();

  constructor(instrument: MSFInstrument, sampleRate = 44100) {
    this.instrument = instrument;
    this.sampleRate = sampleRate;
  }

  /**
   * Process a note-on event
   */
  noteOn(note: number, velocity: number, _time = 0): void {
    // Find matching key and velocity zones
    const sampleSet = this.findSampleSet(note, velocity);

    if (!sampleSet) {
      return; // No matching sample set
    }

    // Select sample (with round-robin if configured)
    const sample = this.selectSample(sampleSet, note, velocity);

    if (!sample) {
      return; // No sample available
    }

    // Create active voice
    const voice: ActiveVoice = {
      note,
      velocity,
      startTime: _time,
      sample,
      sampleSet,
      position: 0,
      gain: velocity / 127, // Simple velocity to gain mapping
      articulationId: this.findArticulationId(sampleSet.id),
    };

    this.activeVoices.set(note, voice);
  }

  /**
   * Process a note-off event
   */
  noteOff(note: number, _time = 0): void {
    this.activeVoices.delete(note);
  }

  /**
   * Render audio samples
   *
   * @param frameCount Number of frames to render
   * @returns Float32Array of interleaved stereo samples [L, R, L, R, ...]
   */
  render(frameCount: number): Float32Array {
    const output = new Float32Array(frameCount * 2); // Stereo

    for (const voice of this.activeVoices.values()) {
      // Simple sample playback (would load actual audio in real implementation)
      // This is a placeholder that generates silence
      // In a real implementation, you would:
      // 1. Load the audio file from voice.sample.path
      // 2. Resample if needed
      // 3. Apply gain and any modulation
      // 4. Mix into output buffer

      const sampleFrames = Math.floor(
        voice.sample.metadata.duration * this.sampleRate
      );

      for (let i = 0; i < frameCount; i++) {
        const globalPos = voice.position + i;

        if (globalPos < sampleFrames) {
          // Placeholder: would read from actual audio buffer
          const sampleValue = 0; // Would be: audioBuffer[globalPos] * voice.gain
          const leftIdx = i * 2;
          const rightIdx = i * 2 + 1;
          if (leftIdx < output.length && output[leftIdx] !== undefined) {
            output[leftIdx] = (output[leftIdx] ?? 0) + sampleValue; // Left channel
          }
          if (rightIdx < output.length && output[rightIdx] !== undefined) {
            output[rightIdx] = (output[rightIdx] ?? 0) + sampleValue; // Right channel
          }
        }
      }

      voice.position += frameCount;

      // Remove voice if finished
      if (voice.position >= sampleFrames && voice.note !== undefined) {
        this.activeVoices.delete(voice.note);
      }
    }

    return output;
  }

  /**
   * Find sample set for given note and velocity
   */
  private findSampleSet(note: number, velocity: number): SampleSet | undefined {
    // Find matching key zone
    const keyZone = this.instrument.mapping.keyZones.find(
      (zone: { range: [number, number]; sampleSetId: string }) =>
        note >= zone.range[0] && note <= zone.range[1]
    );

    if (!keyZone) {
      return undefined;
    }

    // Find matching velocity zone (if any)
    const velocityZone = this.instrument.mapping.velocityZones.find(
      (zone: {
        range: [number, number];
        sampleSetId: string;
      }) =>
        velocity >= zone.range[0] &&
        velocity <= zone.range[1] &&
        zone.sampleSetId === keyZone.sampleSetId
    );

    const sampleSetId = velocityZone?.sampleSetId || keyZone.sampleSetId;

    return this.instrument.sampleSets.find(
      (set: { id: string }) => set.id === sampleSetId
    );
  }

  /**
   * Select sample from sample set (with round-robin)
   */
  private selectSample(
    sampleSet: SampleSet,
    note: number,
    velocity: number
  ): Sample | undefined {
    let candidates = sampleSet.samples;

    // Filter by note if specified
    if (candidates.length > 1) {
      const noteMatch = candidates.find((s: Sample) => s.note === note);
      if (noteMatch) {
        candidates = [noteMatch];
      }
    }

    // Filter by velocity if specified
    if (candidates.length > 1) {
      const velMatch = candidates.find(
        (s: Sample) => s.velocity === velocity
      );
      if (velMatch) {
        candidates = [velMatch];
      }
    }

    if (candidates.length === 0) {
      return undefined;
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    // Apply round-robin if configured
    if (sampleSet.roundRobin) {
      const stateKey = `${sampleSet.id}_${note}`;
      let index = this.roundRobinState.get(stateKey) || 0;

      if (sampleSet.roundRobin.strategy === "random") {
        // Seeded random for deterministic behavior
        const seed = (sampleSet.roundRobin.seed || 0) + index;
        index = Math.floor(
          (Math.sin(seed) * 10000) % 1 * candidates.length
        );
      } else {
        // Sequential
        index = index % candidates.length;
      }

      this.roundRobinState.set(stateKey, index + 1);
      return candidates[index];
    }

    // Default: return first matching sample
    return candidates[0];
  }

  /**
   * Find articulation ID for a sample set
   */
  private findArticulationId(sampleSetId: string): string | undefined {
    const keyZone = this.instrument.mapping.keyZones.find(
      (zone: { sampleSetId: string; articulationId?: string }) =>
        zone.sampleSetId === sampleSetId
    );
    return keyZone?.articulationId;
  }

  /**
   * Process performance rules
   */
  processRules(
    event: "noteOn" | "noteOff",
    note: number,
    velocity: number
  ): void {
    for (const rule of this.instrument.rules) {
      if (rule.trigger.type === event) {
        // Execute rule action
        this.executeRuleAction(rule, note, velocity);
      }
    }
  }

  /**
   * Execute a rule action
   */
  private executeRuleAction(
    rule: PerformanceRule,
    _note: number,
    _velocity: number
  ): void {
    switch (rule.action.type) {
      case "switchArticulation":
        // Would switch active articulation
        break;
      case "modulate":
        // Would apply modulation
        break;
      case "selectSample":
        // Would change sample selection
        break;
      default:
        // Custom action
        break;
    }
  }

  /**
   * Reset runtime state
   */
  reset(): void {
    this.activeVoices.clear();
    this.roundRobinState.clear();
  }
}

/**
 * Render audio to WAV file
 */
export async function renderToWAV(
  runtime: MSFRuntime,
  duration: number,
  sampleRate: number,
  outputPath: string
): Promise<void> {
  const totalFrames = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(totalFrames * 2); // Stereo

  // Render in chunks
  const chunkSize = 4096;
  let offset = 0;

  while (offset < totalFrames) {
    const framesToRender = Math.min(chunkSize, totalFrames - offset);
    const chunk = runtime.render(framesToRender);

    buffer.set(chunk, offset * 2);
    offset += framesToRender;
  }

  // Write WAV file
  await writeWAVFile(buffer, sampleRate, outputPath);
}

/**
 * Write Float32Array to WAV file
 */
async function writeWAVFile(
  samples: Float32Array,
  sampleRate: number,
  outputPath: string
): Promise<void> {
  // Convert float32 (-1 to 1) to int16
  const int16Samples = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    int16Samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  // WAV header
  const numChannels = 2; // Stereo
  const bitsPerSample = 16;
  const byteRate = (sampleRate ?? 44100) * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = int16Samples.length * 2;
  const fileSize = 36 + dataSize;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF header
  view.setUint32(0, 0x46464952, true); // "RIFF"
  view.setUint32(4, fileSize, true);
  view.setUint32(8, 0x45564157, true); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x20746d66, true); // "fmt "
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate ?? 44100, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  view.setUint32(36, 0x61746164, true); // "data"
  view.setUint32(40, dataSize, true);

  // Combine header and samples
  const wavBuffer = new Uint8Array(44 + dataSize);
  wavBuffer.set(new Uint8Array(header), 0);
  wavBuffer.set(
    new Uint8Array(int16Samples.buffer),
    44
  );

  // Write file using Bun's file API
  // Note: This requires Bun runtime
  if (typeof Bun !== "undefined") {
    await Bun.write(outputPath, wavBuffer);
  } else {
    // Fallback for non-Bun environments would use Node.js fs
    throw new Error("Bun runtime required for WAV file writing");
  }
}

/**
 * Calculate audio metrics
 */
export function calculateMetrics(samples: Float32Array): {
  loudness: number;
  peak: number;
} {
  // Simple peak calculation
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample !== undefined) {
      const abs = Math.abs(sample);
      if (abs > peak) {
        peak = abs;
      }
    }
  }

  // Convert peak to dB
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : Number.NEGATIVE_INFINITY;

  // Simplified LUFS calculation (would use ITU-R BS.1770 in real implementation)
  // This is a placeholder that estimates LUFS from RMS
  let rms = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample !== undefined) {
      rms += sample * sample;
    }
  }
  rms = Math.sqrt(rms / samples.length);
  const loudness =
    rms > 0 ? 20 * Math.log10(rms) - 23 : Number.NEGATIVE_INFINITY; // Rough LUFS estimate

  return {
    loudness,
    peak: peakDb,
  };
}

