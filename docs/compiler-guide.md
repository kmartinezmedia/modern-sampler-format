# Compiler Guide

## Overview

The MSF compiler transforms Instrument Intent Spec (IIS) into complete MSF instruments. It is the intelligence center of the system.

## Basic Usage

```typescript
import { compile } from "@msf/compiler";
import { Inventory } from "@msf/builder";

const intent: InstrumentIntent = {
  // ... your intent
};

const inventory = new Inventory();
// ... populate inventory

const { instrument, report } = await compile(intent, inventory, {
  seed: 12345,
  verbose: true,
});
```

## Compiler Options

```typescript
interface CompilerOptions {
  seed?: number;        // Seed for deterministic RNG
  verbose?: boolean;    // Enable verbose reporting
  strict?: boolean;     // Fail on warnings
}
```

## Compilation Process

### 1. Sample Resolution

The compiler resolves samples from inventory:

```typescript
// IIS references samples by ID
inventoryReferences: [{ id: "sample_123", role: "primary" }]

// Compiler looks up actual samples
const sample = inventory.getSample("sample_123");
```

### 2. Zone Building

Builds explicit key and velocity zones:

```typescript
// From mapping strategy
mapping: { strategy: "chromatic" }

// Compiler creates zones
keyZones: [
  { range: [0, 127], sampleSetId: "..." }
]
```

### 3. Round-Robin Assignment

Uses seeded RNG for deterministic round-robin:

```typescript
// Seeded random ensures reproducibility
const seed = options.seed || Date.now();
const rng = createSeededRNG(seed);
const sampleIndex = rng() % samples.length;
```

### 4. Modulation Graph Generation

Builds modulation graph from intent:

```typescript
// From modulation intent
modulation: {
  sources: [{ type: "lfo", id: "lfo1" }],
  targets: [{ parameter: "gain", sourceId: "lfo1", amount: 0.5 }]
}

// Compiler creates graph
modulation: {
  nodes: [{ id: "lfo1", type: "lfo", ... }],
  edges: [{ source: "lfo1", target: "gain", ... }]
}
```

### 5. Performance Rules

Converts performance intent to rules:

```typescript
// From performance intent
performance: {
  rules: [{ trigger: "noteOn", action: "switchArticulation" }]
}

// Compiler creates rules
rules: [{
  id: "rule_1",
  trigger: { type: "noteOn" },
  action: { type: "switchArticulation", ... }
}]
```

## Build Reports

The compiler produces detailed build reports:

```typescript
interface BuildReport {
  decisions: BuildDecision[];
  warnings: string[];
  errors: string[];
}
```

### Example Report

```json
{
  "decisions": [
    {
      "type": "sampleSetCreated",
      "reason": "Created sample set for articulation sustain",
      "context": {
        "articulationId": "sustain",
        "sampleCount": 88
      }
    }
  ],
  "warnings": [],
  "errors": []
}
```

## Determinism

The compiler ensures deterministic output:

1. **Seeded RNG** - Round-robin uses seeded random
2. **Explicit Decisions** - All choices documented
3. **No Ambiguity** - Clear rules for all cases
4. **Reproducible** - Same input = same output

## Error Handling

The compiler handles errors gracefully:

- **Missing Samples** - Warns and continues
- **Invalid Zones** - Applies safe defaults
- **Unsupported Features** - Degrades safely
- **Build Failures** - Returns errors in report

## Advanced Usage

### Custom Compilation

```typescript
const { instrument, report } = await compile(intent, inventory, {
  seed: 12345,
  verbose: true,
  strict: false,
});

if (report.errors.length > 0) {
  console.error("Compilation failed:", report.errors);
}

if (report.warnings.length > 0) {
  console.warn("Warnings:", report.warnings);
}
```

### Compilation Pipeline

```typescript
// 1. Validate intent
const validation = validateIntent(intent);
if (!validation.valid) {
  throw new Error("Invalid intent");
}

// 2. Repair if needed
const repaired = validation.repaired || intent;

// 3. Compile
const { instrument, report } = await compile(repaired, inventory);

// 4. Validate MSF
const msfValidation = validateMSF(instrument);
if (!msfValidation.valid) {
  throw new Error("Invalid MSF");
}
```

