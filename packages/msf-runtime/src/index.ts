/**
 * MSF Runtime — Minimal Playback Engine
 *
 * Pure execution of pre-compiled MSF instruments.
 * No decisions, no calculations, just lookups and playback.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MSFInstrument, Sample, NotePlaybackData, MsfRegion } from "@msf/core";

/** Active voice - minimal state for playback */
interface Voice {
  note: number;
  audioBuffer: Float32Array;
  channels: number;
  position: number;
  gain: number;
  playback: NotePlaybackData;
  resampleRatio: number;
  totalSourceFrames: number;
  isReleasing: boolean;
  releasePosition: number;
  releaseFrames: number;
}

/** MSF Runtime - executes pre-compiled instruments */
export class MSFRuntime {
  private instrument: MSFInstrument;
  private sampleRate: number;
  private voices = new Map<number, Voice>();
  private audioCache = new Map<string, Float32Array>();
  private basePath: string;
  private sampleIndex = new Map<string, Sample>();

  constructor(instrument: MSFInstrument, sampleRate: number, basePath: string) {
    if (!instrument.regions?.length) {
      throw new Error("MSFRuntime: No regions. Recompile instrument.");
    }
    if (!basePath) {
      throw new Error("MSFRuntime: basePath is required.");
    }

    this.instrument = instrument;
    this.sampleRate = sampleRate;
    this.basePath = basePath;

    // Build sample index for O(1) lookup
    for (const set of instrument.sampleSets) {
      for (const sample of set.samples) {
        this.sampleIndex.set(sample.id, sample);
      }
    }
  }

  async noteOn(note: number, velocity: number): Promise<void> {
    // Use pre-computed lookup table for O(1) region selection
    const region = this.lookupRegion(note, velocity);
    if (!region) return;

    const playback = region.notePlayback?.[note];
    if (!playback) return;

    const sample = this.sampleIndex.get(region.sampleId);
    if (!sample) return;

    // Load audio (cached)
    let audio = this.audioCache.get(sample.path);
    if (!audio) {
      audio = await this.loadAudio(sample);
      if (!audio) return;
      this.audioCache.set(sample.path, audio);
    }

    const channels = sample.metadata.channels || 2;
    const sourceSampleRate = sample.metadata.sampleRate || this.sampleRate;

    // Combine velocity gain with pre-computed presence gain from compiled data
    const velocityGain = velocity / 127;
    const presenceGain = playback.gain ?? 1.0;
    const combinedGain = velocityGain * presenceGain;

    const resampleRatio = (sourceSampleRate / this.sampleRate) * playback.playbackRate;

    this.voices.set(note, {
      note,
      audioBuffer: audio,
      channels,
      position: 0,
      gain: combinedGain,
      playback,
      resampleRatio,
      totalSourceFrames: audio.length / channels,
      isReleasing: false,
      releasePosition: 0,
      releaseFrames: Math.floor(playback.fadeOutFrames * (this.sampleRate / 44100)),
    });
  }

  /** O(1) region lookup using pre-computed table */
  private lookupRegion(note: number, velocity: number): MsfRegion | null {
    const lookup = this.instrument.noteLookup;

    // Fallback to legacy search if no lookup table (backward compat)
    if (!lookup) {
      return this.legacyRegionSearch(note, velocity);
    }

    const layers = lookup.table[note];
    if (!layers || layers.length === 0) return null;

    // Find matching velocity layer (layers sorted by velocityMin ascending)
    // Pick the highest velocityMin that's <= velocity
    let match = layers[0]!;
    for (const layer of layers) {
      if (velocity >= layer.velocityMin) {
        match = layer;
      } else {
        break;
      }
    }

    return this.instrument.regions[match.regionIndex] ?? null;
  }

  /** Legacy fallback for instruments without lookup table */
  private legacyRegionSearch(note: number, velocity: number): MsfRegion | null {
    const candidates = this.instrument.regions.filter(
      (r) =>
        note >= r.loKey &&
        note <= r.hiKey &&
        (r.loVel == null || velocity >= r.loVel) &&
        (r.hiVel == null || velocity <= r.hiVel)
    );
    if (candidates.length === 0) return null;

    // Return closest pitch key center
    candidates.sort(
      (a, b) => Math.abs(note - a.pitchKeyCenter) - Math.abs(note - b.pitchKeyCenter)
    );
    return candidates[0] ?? null;
  }

  noteOff(note: number): void {
    const voice = this.voices.get(note);
    if (voice) {
      voice.isReleasing = true;
      voice.releasePosition = 0;
    }
  }

  render(frameCount: number): Float32Array {
    const output = new Float32Array(frameCount * 2);
    const scale = this.sampleRate / 44100;

    for (const voice of this.voices.values()) {
      const { audioBuffer, channels, resampleRatio, totalSourceFrames, playback, gain } = voice;
      const fadeIn = Math.floor(playback.fadeInFrames * scale);
      const fadeOut = Math.floor(playback.fadeOutFrames * scale);

      for (let i = 0; i < frameCount; i++) {
        const pos = voice.position + i;
        const srcPos = pos * resampleRatio;

        if (srcPos >= totalSourceFrames) continue;

        // Envelope: fade in, fade out at end, release fade
        let env = 1.0;

        if (pos < fadeIn) {
          env = 0.5 * (1 - Math.cos((pos / fadeIn) * Math.PI));
        }

        const remaining = (totalSourceFrames - srcPos) / resampleRatio;
        if (remaining < fadeOut) {
          env = Math.min(env, 0.5 * (1 + Math.cos((1 - remaining / fadeOut) * Math.PI)));
        }

        if (voice.isReleasing) {
          const rel = voice.releasePosition / voice.releaseFrames;
          env = Math.min(env, 0.5 * (1 + Math.cos(rel * Math.PI)));
          voice.releasePosition++;
        }

        // Interpolated sample read
        const frame = Math.floor(srcPos);
        const frac = srcPos - frame;
        const idx = frame * channels;

        if (channels === 2) {
          const l0 = audioBuffer[idx] ?? 0;
          const l1 = audioBuffer[idx + 2] ?? l0;
          const r0 = audioBuffer[idx + 1] ?? 0;
          const r1 = audioBuffer[idx + 3] ?? r0;
          output[i * 2] += (l0 + (l1 - l0) * frac) * gain * env;
          output[i * 2 + 1] += (r0 + (r1 - r0) * frac) * gain * env;
        } else {
          const m0 = audioBuffer[idx] ?? 0;
          const m1 = audioBuffer[idx + 1] ?? m0;
          const mono = (m0 + (m1 - m0) * frac) * gain * env;
          output[i * 2] += mono;
          output[i * 2 + 1] += mono;
        }
      }

      voice.position += frameCount;

      // Remove finished voices
      const done = voice.position * voice.resampleRatio >= totalSourceFrames;
      const releaseDone = voice.isReleasing && voice.releasePosition >= voice.releaseFrames;
      if (done || releaseDone) {
        this.voices.delete(voice.note);
      }
    }

    return output;
  }

  reset(): void {
    this.voices.clear();
  }

  private async loadAudio(sample: Sample): Promise<Float32Array | undefined> {
    const path = join(this.basePath, sample.path);
    const ext = sample.path.split(".").pop()?.toLowerCase();

    if (ext === "wav") {
      return this.decodeWAV(path, sample.metadata);
    }

    console.error(`Unsupported audio format: ${ext}. Convert to WAV at compile time.`);
    return undefined;
  }

  /**
   * Decode WAV file to Float32Array.
   * Supports 16-bit and 24-bit PCM.
   */
  private async decodeWAV(
    path: string,
    meta: { channels: number }
  ): Promise<Float32Array> {
    const buf = await readFile(path);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    // Parse WAV header
    // Skip RIFF header (12 bytes), find "fmt " and "data" chunks
    let offset = 12;
    let bitsPerSample = 16;
    let dataStart = 0;
    let dataSize = 0;

    while (offset < buf.byteLength - 8) {
      const chunkId = String.fromCharCode(
        buf[offset]!, buf[offset + 1]!, buf[offset + 2]!, buf[offset + 3]!
      );
      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === "fmt ") {
        bitsPerSample = view.getUint16(offset + 22, true);
      } else if (chunkId === "data") {
        dataStart = offset + 8;
        dataSize = chunkSize;
        break;
      }

      offset += 8 + chunkSize;
      // Word-align
      if (chunkSize % 2 !== 0) offset++;
    }

    if (dataStart === 0 || dataSize === 0) {
      throw new Error(`Invalid WAV file: ${path}`);
    }

    const bytesPerSample = bitsPerSample / 8;
    const sampleCount = Math.floor(dataSize / bytesPerSample);
    const samples = new Float32Array(sampleCount);

    if (bitsPerSample === 16) {
      for (let i = 0; i < sampleCount; i++) {
        const int16 = view.getInt16(dataStart + i * 2, true);
        samples[i] = int16 / 32768;
      }
    } else if (bitsPerSample === 24) {
      for (let i = 0; i < sampleCount; i++) {
        const idx = dataStart + i * 3;
        const b0 = buf[idx]!;
        const b1 = buf[idx + 1]!;
        const b2 = buf[idx + 2]!;
        // Sign-extend 24-bit to 32-bit
        let int24 = (b2 << 16) | (b1 << 8) | b0;
        if (int24 & 0x800000) int24 |= 0xff000000;
        samples[i] = int24 / 8388608;
      }
    } else if (bitsPerSample === 32) {
      // 32-bit float
      for (let i = 0; i < sampleCount; i++) {
        samples[i] = view.getFloat32(dataStart + i * 4, true);
      }
    } else {
      throw new Error(`Unsupported bit depth: ${bitsPerSample}`);
    }

    return samples;
  }
}

/** Render to WAV buffer */
export async function renderToWAVBuffer(
  runtime: MSFRuntime,
  duration: number,
  sampleRate: number
): Promise<Uint8Array> {
  const frames = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(frames * 2);

  let offset = 0;
  while (offset < frames) {
    const chunk = Math.min(4096, frames - offset);
    buffer.set(runtime.render(chunk), offset * 2);
    offset += chunk;
  }

  // Apply fade-out at the end of the rendered duration to prevent clicks
  const fadeOutFrames = Math.min(Math.floor(0.05 * sampleRate), frames); // 50ms fade
  for (let i = 0; i < fadeOutFrames; i++) {
    const fadeStart = frames - fadeOutFrames;
    const env = 0.5 * (1 + Math.cos((i / fadeOutFrames) * Math.PI));
    buffer[(fadeStart + i) * 2] *= env;
    buffer[(fadeStart + i) * 2 + 1] *= env;
  }

  return toWAV(buffer, sampleRate);
}

/** Render to WAV file */
export async function renderToWAV(
  runtime: MSFRuntime,
  duration: number,
  sampleRate: number,
  path: string
): Promise<void> {
  const wav = await renderToWAVBuffer(runtime, duration, sampleRate);
  if (typeof Bun !== "undefined") {
    await Bun.write(path, wav);
  }
}

/** Convert Float32 to WAV */
function toWAV(samples: Float32Array, sampleRate: number): Uint8Array {
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const dataSize = int16.length * 2;
  const wav = new Uint8Array(44 + dataSize);
  const view = new DataView(wav.buffer);

  // RIFF header
  view.setUint32(0, 0x46464952, true);  // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x45564157, true);  // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x20746d66, true); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 2, true);          // stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);

  // data chunk
  view.setUint32(36, 0x61746164, true); // "data"
  view.setUint32(40, dataSize, true);

  wav.set(new Uint8Array(int16.buffer), 44);
  return wav;
}

/** Calculate audio metrics */
export function calculateMetrics(samples: Float32Array): { loudness: number; peak: number } {
  let peak = 0, sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] ?? 0;
    peak = Math.max(peak, Math.abs(s));
    sum += s * s;
  }
  return {
    peak: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
    loudness: sum > 0 ? 20 * Math.log10(Math.sqrt(sum / samples.length)) - 23 : -Infinity
  };
}
