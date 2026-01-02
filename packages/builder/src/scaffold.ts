/**
 * MSF Package Scaffold Helper
 *
 * Makes it easy for consumers to create MSF packages from their samples.
 * This helper generates the package structure and converts paths to relative.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { MSFInstrument, SampleSet } from "@msf/core";

export interface ScaffoldOptions {
  /** Output directory for the MSF package */
  outputDir: string;
  /** Instrument name (e.g., "piano", "guitar") */
  instrumentName: string;
  /** Path to the compiled MSF JSON file */
  msfPath: string;
}

/**
 * Scaffold an MSF package from a compiled MSF instrument
 *
 * Creates the recommended package structure:
 * ```
 * package-name/
 *   instrument-name/
 *     instrument-name.msf.json  (with relative paths)
 *     samples/
 *       *.flac
 * ```
 *
 * @param options - Scaffold configuration
 *
 * @example
 * ```typescript
 * await scaffoldMSFPackage({
 *   outputDir: "./my-msf-package",
 *   instrumentName: "piano",
 *   msfPath: "./compiled/piano.msf.json"
 * });
 * ```
 */
export async function scaffoldMSFPackage(options: ScaffoldOptions): Promise<void> {
  const { outputDir, instrumentName, msfPath } = options;

  // Read the MSF file
  const msfData = JSON.parse(await readFile(msfPath, "utf-8")) as MSFInstrument;

  // Create directory structure
  const instrumentDir = join(outputDir, instrumentName);
  const samplesDir = join(instrumentDir, "samples");

  if (!existsSync(instrumentDir)) {
    await mkdir(instrumentDir, { recursive: true });
  }
  if (!existsSync(samplesDir)) {
    await mkdir(samplesDir, { recursive: true });
  }

  // Convert absolute paths to relative paths
  const updatedMSF: MSFInstrument = {
    ...msfData,
    sampleSets: (msfData.sampleSets as SampleSet[]).map((set: SampleSet) => ({
      ...set,
      samples: set.samples.map((sample) => {
        let samplePath = sample.path;

        // If path is absolute, convert to relative
        if (samplePath.startsWith("/")) {
          // Extract filename and use relative path to samples directory
          const fileName = samplePath.split("/").pop() || "";
          samplePath = `samples/${fileName}`;
        } else if (!samplePath.startsWith("samples/")) {
          // Ensure relative paths point to samples directory
          const fileName = samplePath.split("/").pop() || "";
          samplePath = `samples/${fileName}`;
        }

        return {
          ...sample,
          path: samplePath,
        };
      }),
    })),
  };

  // Write the MSF file with relative paths
  const outputMSFPath = join(instrumentDir, `${instrumentName}.msf.json`);
  await writeFile(outputMSFPath, JSON.stringify(updatedMSF, null, 2));

  console.log("✅ MSF package scaffolded:");
  console.log(`   Output: ${outputMSFPath}`);
  console.log(`   Samples directory: ${samplesDir}`);
  console.log("   All paths converted to relative");
  console.log("\n⚠️  Note: You still need to copy your sample files to the samples/ directory");
}

/**
 * Convert absolute paths in an MSF file to relative paths
 *
 * Useful for making MSF packages portable.
 *
 * @param msfPath - Path to the MSF JSON file
 * @param outputPath - Optional output path (defaults to overwriting input)
 */
export async function convertPathsToRelative(
  msfPath: string,
  outputPath?: string
): Promise<void> {
  const msfData = JSON.parse(await readFile(msfPath, "utf-8")) as MSFInstrument;
  const targetPath = outputPath || msfPath;

  const updatedMSF: MSFInstrument = {
    ...msfData,
    sampleSets: (msfData.sampleSets as SampleSet[]).map((set: SampleSet) => ({
      ...set,
      samples: set.samples.map((sample) => {
        let samplePath = sample.path;

        // Convert absolute paths to relative
        if (samplePath.startsWith("/")) {
          // Extract filename and use relative path to samples directory
          const fileName = samplePath.split("/").pop() || "";
          samplePath = `samples/${fileName}`;
        } else if (!samplePath.startsWith("samples/")) {
          // Ensure relative paths point to samples directory
          const fileName = samplePath.split("/").pop() || "";
          samplePath = `samples/${fileName}`;
        }

        return {
          ...sample,
          path: samplePath,
        };
      }),
    })),
  };

  await writeFile(targetPath, JSON.stringify(updatedMSF, null, 2));
  console.log(`✅ Converted paths to relative in: ${targetPath}`);
}
