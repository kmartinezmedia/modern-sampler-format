import { test, expect } from "bun:test";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { MSFInstrument } from "@msf/core";

let testDir: string;

test.beforeAll(async () => {
  testDir = join(tmpdir(), `msf-cli-cli-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

test.afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

function runCLI(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    // Use bun to run the CLI script
    const cliPath = join(import.meta.dir, "cli.ts");
    const proc = spawn("bun", [cliPath, ...args], {
      cwd: testDir,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        code: code ?? 0,
        stdout,
        stderr,
      });
    });
  });
}

test("CLI shows usage when no arguments provided", async () => {
  const result = await runCLI([]);

  expect(result.code).toBe(0);
  expect(result.stdout).toContain("Usage:");
  expect(result.stdout).toContain("msf compile");
});

test("CLI shows usage with --help", async () => {
  const result = await runCLI(["--help"]);

  expect(result.code).toBe(0);
  expect(result.stdout).toContain("Usage:");
});

test("CLI errors on missing input file", async () => {
  const result = await runCLI(["compile"]);

  expect(result.code).toBe(1);
  expect(result.stderr).toContain("Missing input file");
});

test("CLI errors on unknown command", async () => {
  const result = await runCLI(["unknown-command"]);

  expect(result.code).toBe(1);
  expect(result.stderr).toContain("Unknown command");
});

test("CLI compiles MSF file successfully", async () => {
  // Create a test MSF file
  const testMSF: MSFInstrument = {
    identity: {
      id: "test-cli",
      name: "Test CLI",
      version: "0.1.0",
    },
    articulations: [
      {
        id: "art_test",
        name: "test",
        type: "sustain",
        parameters: {},
      },
    ],
    sampleSets: [
      {
        id: "sampleset_test",
        samples: [
          {
            id: "sample_1",
            path: "samples/test.flac",
            note: 60,
            velocity: 100,
            articulation: "art_test",
            metadata: {
              duration: 1.0,
              sampleRate: 44100,
              channels: 2,
              format: "flac",
            },
          },
        ],
      },
    ],
    regions: [],
    mapping: {
      keyZones: [],
      velocityZones: [],
    },
    modulation: {
      nodes: [],
      edges: [],
    },
    rules: [],
    metadata: {
      compiledAt: new Date().toISOString(),
      compilerVersion: "0.1.0",
    },
  };

  const inputPath = join(testDir, "cli-test-input.msf.json");
  const outputPath = join(testDir, "cli-test-output.msf.json");
  await writeFile(inputPath, JSON.stringify(testMSF, null, 2));

  const result = await runCLI([
    "compile",
    inputPath,
    "--output",
    outputPath,
  ]);

  expect(result.code).toBe(0);
  expect(result.stdout).toContain("Compilation complete");

  // Verify output file exists
  const outputContent = await readFile(outputPath, "utf-8");
  const outputMSF = JSON.parse(outputContent) as MSFInstrument;
  expect(outputMSF.identity.id).toBe("test-cli");
  expect(outputMSF.regions.length).toBeGreaterThan(0);

  // Verify baseDurationFrames is present
  for (const region of outputMSF.regions) {
    expect(region.baseDurationFrames).toBeDefined();
    expect(region.baseDurationFrames).toBeGreaterThan(0);
  }
});

test("CLI preserves original when --preserve-original is used", async () => {
  const testMSF: MSFInstrument = {
    identity: {
      id: "test-preserve",
      name: "Test Preserve",
      version: "0.1.0",
    },
    articulations: [],
    sampleSets: [],
    regions: [],
    mapping: {
      keyZones: [],
      velocityZones: [],
    },
    modulation: {
      nodes: [],
      edges: [],
    },
    rules: [],
    metadata: {
      compiledAt: new Date().toISOString(),
      compilerVersion: "0.1.0",
    },
  };

  const inputPath = join(testDir, "cli-preserve-input.msf.json");
  const outputPath = join(testDir, "cli-preserve-output.msf.json");
  await writeFile(inputPath, JSON.stringify(testMSF, null, 2));

  const result = await runCLI([
    "compile",
    inputPath,
    "--output",
    outputPath,
    "--preserve-original",
  ]);

  expect(result.code).toBe(0);
  expect(result.stdout).toContain("Original preserved");

  // Verify original file exists
  const originalPath = `${outputPath}.original`;
  const originalContent = await readFile(originalPath, "utf-8");
  const originalMSF = JSON.parse(originalContent) as MSFInstrument;
  expect(originalMSF.identity.id).toBe("test-preserve");
});


