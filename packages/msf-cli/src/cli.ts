/**
 * MSF CLI - Command-line tool for compiling MSF instruments
 *
 * Usage:
 *   msf compile <input-msf.json> [options]
 *   msf compile <input-msf.json> --output <output-msf.json> [--preserve-original]
 */

import { resolve, dirname } from "node:path";
import { compileMSF, type CompileOptions } from "./compile.js";

const COMMANDS = {
  compile: "compile",
} as const;

type Command = (typeof COMMANDS)[keyof typeof COMMANDS];

async function runCompile(options: CompileOptions): Promise<void> {
  const { input, output, preserveOriginal } = options;

  console.log(`[MSF CLI] Compiling ${input}...`);

  try {
    const compiledMSF = await compileMSF(options);

    console.log(`[MSF CLI] ✅ Compilation complete`);
    console.log(`[MSF CLI]   - Regions: ${compiledMSF.regions.length}`);
    console.log(`[MSF CLI]   - Sample sets: ${compiledMSF.sampleSets.length}`);
    console.log(`[MSF CLI]   - Articulations: ${compiledMSF.articulations.length}`);

    const outputPath = output ? resolve(output) : resolve(input);
    console.log(`[MSF CLI] ✅ Compiled instrument written to ${outputPath}`);

    if (preserveOriginal) {
      const originalPath = `${outputPath}.original`;
      console.log(`[MSF CLI] ✅ Original preserved at ${originalPath}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Compilation failed")) {
      console.error(`[MSF CLI] ❌ ${error.message}`);
    } else {
      throw error;
    }
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
MSF CLI - Command-line tool for compiling MSF instruments

Usage:
  msf compile <input-msf.json> [options]

Commands:
  compile    Compile an MSF instrument, ensuring all required fields are present

Options:
  --output <path>              Output path for compiled MSF (default: overwrites input)
  --preserve-original          Preserve original file as <output>.original
  --strict                     Enable strict compilation mode (fail on warnings)

Examples:
  # Compile and overwrite the input file
  msf compile instrument.msf.json

  # Compile to a new file
  msf compile instrument.msf.json --output compiled.msf.json

  # Compile and preserve original
  msf compile instrument.msf.json --preserve-original

  # Compile with strict mode
  msf compile instrument.msf.json --strict
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const command = args[0] as Command;

  if (command !== COMMANDS.compile) {
    console.error(`[MSF CLI] ❌ Unknown command: ${command}`);
    console.error(`[MSF CLI] Run 'msf --help' for usage information`);
    process.exit(1);
  }

  if (args.length < 2 || !args[1]) {
    console.error(`[MSF CLI] ❌ Missing input file`);
    console.error(`[MSF CLI] Usage: msf compile <input-msf.json> [options]`);
    process.exit(1);
  }

  const input = args[1]!; // We know it exists from the check above
  const options: CompileOptions = {
    input,
  };

  // Parse options
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output" && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === "--preserve-original") {
      options.preserveOriginal = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--samples-base" && args[i + 1]) {
      options.samplesBasePath = args[++i];
    } else {
      console.error(`[MSF CLI] ❌ Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  // Auto-detect samples base path if not provided
  // Assume samples are relative to the MSF file directory
  if (!options.samplesBasePath) {
    options.samplesBasePath = dirname(resolve(input));
  }

  try {
    await runCompile(options);
  } catch (error) {
    console.error(`[MSF CLI] ❌ Error:`, error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.main) {
  main();
}

