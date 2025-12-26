# API Reference

## @msf/core

### MSFInstrument

Complete MSF instrument bundle.

```typescript
interface MSFInstrument {
  identity: InstrumentIdentity;
  articulations: Articulation[];
  sampleSets: SampleSet[];
  mapping: Mapping;
  modulation: ModulationGraph;
  rules: PerformanceRule[];
  metadata: InstrumentMetadata;
}
```

### Types

- `InstrumentIdentity`
- `Articulation`
- `SampleSet`
- `Sample`
- `Mapping`
- `KeyZone`
- `VelocityZone`
- `ModulationGraph`
- `ModulationNode`
- `ModulationEdge`
- `PerformanceRule`
- `RuleTrigger`
- `RuleAction`
- `InstrumentMetadata`
- `BuildReport`
- `BuildDecision`

## @msf/compiler

### compile

Compile Instrument Intent Spec to MSF.

```typescript
function compile(
  intent: InstrumentIntent,
  inventory: Inventory,
  options?: CompilerOptions
): Promise<{ instrument: MSFInstrument; report: BuildReport }>
```

### Types

- `InstrumentIntent`
- `IntentDescription`
- `InventoryReference`
- `ArticulationIntent`
- `MappingIntent`
- `ModulationIntent`
- `PerformanceIntent`
- `CompilerOptions`

## @msf/validator

### validateIntent

Validate Instrument Intent Spec.

```typescript
function validateIntent(
  intent: InstrumentIntent,
  options?: ValidationOptions
): ValidationResult
```

### validateMSF

Validate compiled MSF instrument.

```typescript
function validateMSF(
  instrument: MSFInstrument
): ValidationResult
```

### Types

- `ValidationResult`
- `ValidationError`
- `ValidationWarning`
- `ValidationOptions`
- `EngineCapabilities`

## @msf/runtime

### MSFRuntime

MSF playback engine.

```typescript
class MSFRuntime {
  constructor(instrument: MSFInstrument, sampleRate?: number)
  noteOn(note: number, velocity: number, time?: number): void
  noteOff(note: number, time?: number): void
  render(frameCount: number): Float32Array
  reset(): void
}
```

### renderToWAV

Render audio to WAV file.

```typescript
function renderToWAV(
  runtime: MSFRuntime,
  duration: number,
  sampleRate: number,
  outputPath: string
): Promise<void>
```

### calculateMetrics

Calculate audio metrics.

```typescript
function calculateMetrics(
  samples: Float32Array
): { loudness: number; peak: number }
```

## @msf/inventory

### Inventory

Canonical inventory system.

```typescript
class Inventory {
  add(entry: InventoryEntry): void
  get(id: string): InventoryEntry | undefined
  list(): InventoryEntry[]
  search(criteria: SearchCriteria): InventoryEntry[]
  getStats(): InventoryStats
}
```

### scanDirectory

Scan directory and build inventory.

```typescript
function scanDirectory(
  directoryPath: string,
  options?: ScanOptions
): Promise<Inventory>
```

### Types

- `InventoryEntry`
- `SampleMetadata`
- `SearchCriteria`
- `InventoryStats`
- `ScanOptions`

## @msf/intent-generator

### generateIntent

Generate Instrument Intent Spec from natural language.

```typescript
function generateIntent(
  prompt: GenerationPrompt,
  inventory: Inventory,
  options?: GenerationOptions
): Promise<InstrumentIntent>
```

### buildConstrainedPrompt

Build constrained AI prompt.

```typescript
function buildConstrainedPrompt(
  prompt: GenerationPrompt,
  inventory: Inventory,
  options?: GenerationOptions
): string
```

### Types

- `GenerationPrompt`
- `GenerationOptions`

