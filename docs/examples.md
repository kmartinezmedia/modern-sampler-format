# Examples

## Your First Instrument

### 1. Create Inventory

```typescript
import { Inventory, scanDirectory } from "@msf/builder";

const inventory = await scanDirectory("./samples", {
  extensions: [".wav", ".aiff"],
  ignoreHidden: true,
});
```

### 2. Generate Intent

```typescript
import { generateIntent } from "@msf/intent-generator";

const intent = await generateIntent(
  {
    description: "A grand piano with sustain and staccato articulations",
    constraints: {
      instrumentType: "piano",
      articulations: ["sustain", "staccato"],
    },
  },
  inventory
);
```

### 3. Validate Intent

```typescript
import { validateIntent } from "@msf/validator";

const validation = validateIntent(intent, {
  strict: true,
});

if (!validation.valid) {
  console.error("Validation errors:", validation.errors);
}
```

### 4. Compile to MSF

```typescript
import { compile } from "@msf/compiler";

const { instrument, report } = await compile(intent, inventory, {
  seed: 12345,
  verbose: true,
});

console.log("Compiled instrument:", instrument.identity.name);
console.log("Build report:", report);
```

### 5. Play MSF

```typescript
import { MSFRuntime, renderToWAV } from "@msf/runtime";

const runtime = new MSFRuntime(instrument, 44100);

// Play a chord
runtime.noteOn(60, 100, 0);  // C
runtime.noteOn(64, 100, 0);  // E
runtime.noteOn(67, 100, 0);  // G

// Render to WAV
await renderToWAV(runtime, 2.0, 44100, "./output/chord.wav");
```

## Complete Workflow

```typescript
import { Inventory, scanDirectory } from "@msf/builder";
import { generateIntent } from "@msf/intent-generator";
import { validateIntent } from "@msf/validator";
import { compile } from "@msf/compiler";
import { MSFRuntime, renderToWAV } from "@msf/runtime";

async function createInstrument() {
  // 1. Scan samples
  const inventory = await scanDirectory("./samples");

  // 2. Generate intent
  const intent = await generateIntent(
    {
      description: "Concert grand piano",
      constraints: { instrumentType: "piano" },
    },
    inventory
  );

  // 3. Validate
  const validation = validateIntent(intent);
  if (!validation.valid) {
    throw new Error("Invalid intent");
  }

  // 4. Compile
  const { instrument, report } = await compile(intent, inventory);

  // 5. Play
  const runtime = new MSFRuntime(instrument, 44100);
  runtime.noteOn(60, 100, 0);
  await renderToWAV(runtime, 2.0, 44100, "./output/piano.wav");

  return instrument;
}
```

## Custom Mapping

```typescript
const intent: InstrumentIntent = {
  intent: {
    name: "Velocity-Layered Piano",
    instrumentType: "piano",
    targetArticulations: ["sustain"],
  },
  inventoryReferences: [
    { id: "piano_pp", role: "primary" },
    { id: "piano_mp", role: "primary" },
    { id: "piano_f", role: "primary" },
    { id: "piano_ff", role: "primary" },
  ],
  articulations: [
    {
      id: "sustain",
      name: "Sustain",
      type: "sustain",
      samples: ["piano_pp", "piano_mp", "piano_f", "piano_ff"],
    },
  ],
  mapping: {
    strategy: "velocityLayered",
    zones: [
      {
        velocityRange: [0, 40],
        sampleSetIds: ["piano_pp"],
      },
      {
        velocityRange: [41, 80],
        sampleSetIds: ["piano_mp"],
      },
      {
        velocityRange: [81, 110],
        sampleSetIds: ["piano_f"],
      },
      {
        velocityRange: [111, 127],
        sampleSetIds: ["piano_ff"],
      },
    ],
  },
};
```

## Round-Robin Samples

```typescript
const intent: InstrumentIntent = {
  // ... other fields
  articulations: [
    {
      id: "staccato",
      name: "Staccato",
      type: "staccato",
      samples: [
        "staccato_rr1",
        "staccato_rr2",
        "staccato_rr3",
        "staccato_rr4",
      ],
    },
  ],
};

// Compiler will create round-robin configuration
// Runtime will cycle through samples deterministically
```

## Modulation

```typescript
const intent: InstrumentIntent = {
  // ... other fields
  modulation: {
    sources: [
      {
        type: "lfo",
        id: "vibrato",
        parameters: {
          frequency: 5.0,
          waveform: "sine",
        },
      },
    ],
    targets: [
      {
        parameter: "pitch",
        sourceId: "vibrato",
        amount: 0.1,
      },
    ],
  },
};
```

## Performance Rules

```typescript
const intent: InstrumentIntent = {
  // ... other fields
  performance: {
    rules: [
      {
        trigger: "noteOn",
        action: "switchArticulation",
        parameters: {
          articulationId: "legato",
        },
      },
    ],
  },
};
```

