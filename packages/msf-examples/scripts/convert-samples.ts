#!/usr/bin/env bun
/**
 * Convert FLAC samples to WAV and extract durations.
 * Updates msf.json with correct sample durations.
 */

import { spawn } from "node:child_process";
import { readdir, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";

const srcDir = join(import.meta.dir, "..", "src", "upright-piano");
const distDir = join(import.meta.dir, "..", "dist", "upright-piano");
const samplesDir = join(srcDir, "samples");
const distSamplesDir = join(distDir, "samples");

async function convertFlacToWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-i", inputPath,
      "-acodec", "pcm_s16le",
      "-ar", "44100",
      "-y", outputPath
    ], { stdio: ["ignore", "ignore", "ignore"] });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed with code ${code} for ${inputPath}`));
      } else {
        resolve();
      }
    });

    proc.on("error", reject);
  });
}

/**
 * Get duration in seconds from a WAV file by reading its header
 */
async function getWavDuration(path: string): Promise<number> {
  const buf = await readFile(path);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // Parse WAV header to find sample rate, channels, and data size
  let offset = 12;
  let sampleRate = 44100;
  let channels = 2;
  let bitsPerSample = 16;
  let dataSize = 0;

  while (offset < buf.byteLength - 8) {
    const chunkId = String.fromCharCode(
      buf[offset]!, buf[offset + 1]!, buf[offset + 2]!, buf[offset + 3]!
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === "fmt ") {
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === "data") {
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++;
  }

  const bytesPerSample = (bitsPerSample / 8) * channels;
  const totalSamples = dataSize / bytesPerSample;
  return totalSamples / sampleRate;
}

async function main() {
  // Find FLAC files
  const files = await readdir(samplesDir);
  const flacFiles = files.filter(f => extname(f).toLowerCase() === ".flac");

  if (flacFiles.length === 0) {
    console.log("✅ No FLAC files to convert");
    return;
  }

  console.log(`🔄 Converting ${flacFiles.length} FLAC files to WAV...`);

  // Ensure output directory exists
  await mkdir(distSamplesDir, { recursive: true });

  // Track durations for each sample
  const durations = new Map<string, number>();

  // Convert FLAC files in parallel (batch of 8)
  const batchSize = 8;
  for (let i = 0; i < flacFiles.length; i += batchSize) {
    const batch = flacFiles.slice(i, i + batchSize);
    await Promise.all(batch.map(async (flac) => {
      const wavName = basename(flac, ".flac") + ".wav";
      const inputPath = join(samplesDir, flac);
      const outputPath = join(distSamplesDir, wavName);

      console.log(`   ${flac} → ${wavName}`);
      await convertFlacToWav(inputPath, outputPath);

      // Get duration from converted WAV
      const duration = await getWavDuration(outputPath);
      durations.set(wavName, duration);
    }));
  }

  console.log("✅ FLAC conversion complete!");

  // Update source msf.json with correct durations (so it gets bundled correctly)
  console.log("📝 Updating msf.json with sample durations...");

  const msfPath = join(srcDir, "msf.json");
  const msfContent = await readFile(msfPath, "utf-8");
  const msf = JSON.parse(msfContent);

  let updatedCount = 0;
  for (const sampleSet of msf.sampleSets || []) {
    for (const sample of sampleSet.samples || []) {
      // Extract filename from path (e.g., "samples/A0vL.wav" -> "A0vL.wav")
      const filename = sample.path.split("/").pop();
      const duration = durations.get(filename);

      if (duration !== undefined && sample.metadata) {
        sample.metadata.duration = duration;
        updatedCount++;
      }
    }
  }

  // Write back to source msf.json (gets bundled into index.mjs by tsdown)
  await writeFile(msfPath, JSON.stringify(msf, null, 2));

  console.log(`✅ Updated ${updatedCount} sample durations in msf.json`);
}

main().catch((err) => {
  console.error("❌ Conversion failed:", err);
  process.exit(1);
});
