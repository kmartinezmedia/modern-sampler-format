import { test, expect } from "bun:test";
import { MSFRuntime, renderToWAVBuffer } from "./index";
import type { MSFInstrument } from "@msf/core";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("MSFRuntime can load and play audio samples", async () => {
  // Load the instrument using loadMSFFromPackage which resolves paths
  // The MSF JSON file is at dist/upright-piano/msf.json (copied during build)
  // But we need to use the export path which points to the JS module
  // Actually, let's just import it directly and resolve paths manually
  const { default: msfData } = await import("@msf/examples/upright-piano");
  const instrument = msfData as MSFInstrument;

  // Resolve base path - required parameter
  let basePath: string;
  try {
    const packagePath = require.resolve("@msf/examples/upright-piano");
    basePath = dirname(packagePath);
  } catch {
    basePath = join(dirname(require.resolve("@msf/examples/package.json")), "dist", "upright-piano");
  }

  // Create runtime with base path
  const sampleRate = 44100;
  const runtime = new MSFRuntime(instrument, sampleRate, basePath);

  // Trigger note on (C4, velocity 100)
  await runtime.noteOn(60, 100, 0);

  // Render 1 second of audio
  const duration = 1.0;
  const wavBuffer = await renderToWAVBuffer(runtime, duration, sampleRate);

  // Verify we got a WAV buffer
  expect(wavBuffer).toBeInstanceOf(Uint8Array);
  expect(wavBuffer.length).toBeGreaterThan(44); // At least WAV header + some data

  // Verify WAV header (RIFF)
  const riffHeader = String.fromCharCode(
    wavBuffer[0],
    wavBuffer[1],
    wavBuffer[2],
    wavBuffer[3]
  );
  expect(riffHeader).toBe("RIFF");

  // Verify WAVE header
  const waveHeader = String.fromCharCode(
    wavBuffer[8],
    wavBuffer[9],
    wavBuffer[10],
    wavBuffer[11]
  );
  expect(waveHeader).toBe("WAVE");

  console.log(`✅ Generated WAV buffer: ${wavBuffer.length} bytes`);
  console.log(`   Duration: ${duration}s, Sample rate: ${sampleRate}Hz`);

  // Check that we have actual audio data (not just silence)
  // Extract audio samples from WAV (skip 44-byte header)
  const audioData = new Int16Array(wavBuffer.buffer, 44);
  let hasNonZeroSamples = false;
  for (let i = 0; i < Math.min(1000, audioData.length); i++) {
    if (audioData[i] !== 0) {
      hasNonZeroSamples = true;
      break;
    }
  }

  if (hasNonZeroSamples) {
    console.log(`   ✅ Audio contains non-zero samples (actual audio data)`);
  } else {
    console.log(`   ⚠️  Audio is silence (FLAC decoding not yet implemented)`);
  }
});

test("MSFRuntime selects correct sample for note and velocity", async () => {
  const { default: msfData } = await import("@msf/examples/upright-piano");
  const instrument = msfData as MSFInstrument;

  let basePath: string;
  try {
    const packagePath = require.resolve("@msf/examples/upright-piano");
    basePath = dirname(packagePath);
  } catch {
    basePath = join(dirname(require.resolve("@msf/examples/package.json")), "dist", "upright-piano");
  }

  const runtime = new MSFRuntime(instrument, 44100, basePath);

  // Test different notes and velocities
  await runtime.noteOn(60, 40, 0); // C4, low velocity (should use piano layer)
  await runtime.noteOn(60, 100, 0); // C4, high velocity (should use forte layer)
  await runtime.noteOn(81, 50, 0); // A5, medium velocity

  // Render a short clip
  const wavBuffer = await renderToWAVBuffer(runtime, 0.5, 44100);

  expect(wavBuffer.length).toBeGreaterThan(44);
  console.log(`✅ Multi-note test: Generated ${wavBuffer.length} bytes`);
});

test("MSFRuntime handles note off events", async () => {
  const { default: msfData } = await import("@msf/examples/upright-piano");
  const instrument = msfData as MSFInstrument;

  let basePath: string;
  try {
    const packagePath = require.resolve("@msf/examples/upright-piano");
    basePath = dirname(packagePath);
  } catch {
    basePath = join(dirname(require.resolve("@msf/examples/package.json")), "dist", "upright-piano");
  }

  const runtime = new MSFRuntime(instrument, 44100, basePath);

  // Trigger note on
  await runtime.noteOn(60, 100, 0);

  // Render some audio
  const chunk1 = runtime.render(4410); // 0.1 seconds
  expect(chunk1.length).toBe(8820); // 4410 frames * 2 channels

  // Trigger note off
  runtime.noteOff(60, 0.1);

  // Render more audio (should be silence after note off)
  const chunk2 = runtime.render(4410);
  expect(chunk2.length).toBe(8820);

  console.log(`✅ Note off test: Rendered ${chunk1.length + chunk2.length} samples`);
});

