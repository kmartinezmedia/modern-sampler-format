import { test, expect, beforeAll, afterAll } from "bun:test";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileMSF } from "./compile.js";
import type { MSFInstrument } from "@msf/core";

let testDir: string;

beforeAll(async () => {
  testDir = join(tmpdir(), `msf-cli-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

test("compileMSF adds baseDurationFrames to regions", async () => {
  // Create a minimal test MSF file
  const testMSF: MSFInstrument = {
    identity: {
      id: "test-instrument",
      name: "Test Instrument",
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
              duration: 2.5, // 2.5 seconds
              sampleRate: 44100,
              channels: 2,
              format: "flac",
            },
          },
        ],
      },
    ],
    regions: [
      {
        id: "region_sample_1",
        sampleId: "sample_1",
        loKey: 60,
        hiKey: 60,
        pitchKeyCenter: 60,
        baseDurationFrames: 0, // Will be calculated
      },
    ],
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

  const inputPath = join(testDir, "test-input.msf.json");
  await writeFile(inputPath, JSON.stringify(testMSF, null, 2));

  // Compile the MSF
  const compiled = await compileMSF({
    input: inputPath,
    output: join(testDir, "test-output.msf.json"),
  });

  // Verify baseDurationFrames is calculated correctly
  // baseDurationFrames = duration * sampleRate = 2.5 * 44100 = 110250
  const region = compiled.regions.find((r) => r.id === "region_sample_1");
  expect(region).toBeDefined();
  expect(region?.baseDurationFrames).toBe(110250);
});

test("compileMSF preserves existing baseDurationFrames", async () => {
  const testMSF: MSFInstrument = {
    identity: {
      id: "test-instrument-2",
      name: "Test Instrument 2",
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

  const inputPath = join(testDir, "test-input-2.msf.json");
  await writeFile(inputPath, JSON.stringify(testMSF, null, 2));

  const compiled = await compileMSF({
    input: inputPath,
    output: join(testDir, "test-output-2.msf.json"),
  });

  // Verify regions were created with baseDurationFrames
  expect(compiled.regions.length).toBeGreaterThan(0);
  for (const region of compiled.regions) {
    expect(region.baseDurationFrames).toBeGreaterThan(0);
    // Should be duration * 44100 = 1.0 * 44100 = 44100
    expect(region.baseDurationFrames).toBe(44100);
  }
});

test("compileMSF handles missing duration gracefully", async () => {
  const testMSF: MSFInstrument = {
    identity: {
      id: "test-instrument-3",
      name: "Test Instrument 3",
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
            path: "samples/nonexistent.flac",
            note: 60,
            velocity: 100,
            articulation: "art_test",
            metadata: {
              duration: 0, // Missing duration
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

  const inputPath = join(testDir, "test-input-3.msf.json");
  await writeFile(inputPath, JSON.stringify(testMSF, null, 2));

  // Should not throw, but will warn about missing duration
  const compiled = await compileMSF({
    input: inputPath,
    output: join(testDir, "test-output-3.msf.json"),
    samplesBasePath: testDir, // Point to test dir (won't find file, but shouldn't crash)
  });

  // Should still compile successfully
  expect(compiled.regions.length).toBeGreaterThan(0);
  // baseDurationFrames will be 0 since duration couldn't be read
  // This is expected behavior - the compiler will use 0 if duration can't be determined
});

test("compileMSF writes output file", async () => {
  const testMSF: MSFInstrument = {
    identity: {
      id: "test-instrument-4",
      name: "Test Instrument 4",
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

  const inputPath = join(testDir, "test-input-4.msf.json");
  const outputPath = join(testDir, "test-output-4.msf.json");
  await writeFile(inputPath, JSON.stringify(testMSF, null, 2));

  await compileMSF({
    input: inputPath,
    output: outputPath,
  });

  // Verify output file exists
  const outputContent = await readFile(outputPath, "utf-8");
  const outputMSF = JSON.parse(outputContent) as MSFInstrument;
  expect(outputMSF.identity.id).toBe("test-instrument-4");
});

test("compileMSF preserves original when requested", async () => {
  const testMSF: MSFInstrument = {
    identity: {
      id: "test-instrument-5",
      name: "Test Instrument 5",
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

  const inputPath = join(testDir, "test-input-5.msf.json");
  const outputPath = join(testDir, "test-output-5.msf.json");
  await writeFile(inputPath, JSON.stringify(testMSF, null, 2));

  await compileMSF({
    input: inputPath,
    output: outputPath,
    preserveOriginal: true,
  });

  // Verify original file exists
  const originalPath = `${outputPath}.original`;
  const originalContent = await readFile(originalPath, "utf-8");
  const originalMSF = JSON.parse(originalContent) as MSFInstrument;
  expect(originalMSF.identity.id).toBe("test-instrument-5");
});

test("compileMSF throws on compilation errors", async () => {
  const invalidMSF = {
    identity: {
      id: "invalid",
      name: "Invalid",
      version: "0.1.0",
    },
    // Missing required fields
  };

  const inputPath = join(testDir, "test-invalid.msf.json");
  await writeFile(inputPath, JSON.stringify(invalidMSF, null, 2));

  // Should throw an error
  await expect(
    compileMSF({
      input: inputPath,
      output: join(testDir, "test-invalid-output.msf.json"),
    })
  ).rejects.toThrow();
});

