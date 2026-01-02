/**
 * Compile MSF instrument programmatically
 */

import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { spawn } from "node:child_process";
import type { MSFInstrument } from "@msf/core";
import { extractInventoryFromMSF, extractIntentFromMSF } from "@msf/builder";
import { compile } from "@msf/compiler";

export interface CompileOptions {
  input: string;
  output?: string;
  preserveOriginal?: boolean;
  strict?: boolean;
  samplesBasePath?: string; // Base path for resolving sample files to read durations
}

/**
 * Read audio file duration using ffprobe
 */
async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);

    let stdout = "";
    let stderr = "";

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${stderr}`));
        return;
      }

      const duration = Number.parseFloat(stdout.trim());
      if (Number.isNaN(duration) || duration <= 0) {
        reject(new Error(`Invalid duration from ffprobe: ${stdout.trim()}`));
        return;
      }

      resolve(duration);
    });

    ffprobe.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("ffprobe not found. Please install ffmpeg to read audio file durations."));
      } else {
        reject(error);
      }
    });
  });
}

export async function compileMSF(options: CompileOptions): Promise<MSFInstrument> {
  const { input, output, preserveOriginal = false, strict = false, samplesBasePath } = options;

  // Read the source MSF file
  const inputPath = resolve(input);
  const sourceMSF: MSFInstrument = JSON.parse(
    await readFile(inputPath, "utf-8")
  );

  // If samplesBasePath is provided and samples have duration 0, read actual durations
  // Update sourceMSF directly so it gets picked up when extracting inventory
  if (samplesBasePath) {
    const basePath = resolve(samplesBasePath);
    const msfDir = dirname(inputPath);

    console.log(`[MSF CLI] Reading audio file durations...`);
    let updatedCount = 0;

    // Update sourceMSF sample metadata with actual durations
    for (const sampleSet of sourceMSF.sampleSets) {
      for (const sample of sampleSet.samples) {
        // Check if duration is 0 or missing
        if (!sample.metadata.duration || sample.metadata.duration === 0) {
          try {
            // Resolve sample path (relative to MSF file or base path)
            let samplePath = sample.path;
            if (!samplePath.startsWith("/")) {
              // Try relative to MSF file first, then base path
              const msfRelativePath = join(msfDir, samplePath);
              try {
                await readFile(msfRelativePath);
                samplePath = msfRelativePath;
              } catch {
                samplePath = join(basePath, samplePath);
              }
            }

            const duration = await getAudioDuration(samplePath);
            sample.metadata.duration = duration;
            updatedCount++;
            console.log(`[MSF CLI] ✅ ${sample.id}: ${duration.toFixed(3)}s`);
          } catch (error) {
            console.warn(`[MSF CLI] ⚠️  Could not read duration for ${sample.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }

    if (updatedCount > 0) {
      console.log(`[MSF CLI] Updated ${updatedCount} sample durations`);
    }
  }

  // Extract inventory and intent for recompilation (after updating durations)
  const inventory = extractInventoryFromMSF(sourceMSF);
  const intent = extractIntentFromMSF(sourceMSF);

  // Recompile to ensure all fields are present (especially baseDurationFrames)
  const { instrument: compiledMSF, report } = await compile(intent, inventory, {
    strict,
  });

  if (report.errors.length > 0) {
    throw new Error(
      `Compilation failed: ${report.errors.join(", ")}`
    );
  }

  if (report.warnings.length > 0 && !strict) {
    // Warnings are logged but don't fail compilation unless strict mode
    console.warn(`[MSF CLI] ⚠️  Compilation warnings:`);
    for (const warning of report.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  // Determine output path
  const outputPath = output ? resolve(output) : inputPath;

  // Ensure output directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  // Write the compiled MSF (with all required fields)
  await writeFile(outputPath, JSON.stringify(compiledMSF, null, 2));

  // Preserve original if requested
  if (preserveOriginal) {
    const originalPath = `${outputPath}.original`;
    await copyFile(inputPath, originalPath);
  }

  return compiledMSF;
}

