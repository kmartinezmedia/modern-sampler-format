# MSF Format Specification

## Overview

MSF (Modern Sampler Format) is a complete, deterministic declaration of sampler behavior. Every aspect of playback is explicitly defined.

## MSF Instrument Structure

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

## Instrument Identity

```typescript
interface InstrumentIdentity {
  id: string;              // Unique identifier
  name: string;            // Human-readable name
  version: string;         // Version string
  author?: string;         // Optional author
  description?: string;    // Optional description
}
```

## Articulations

Articulations are first-class behaviors in MSF:

```typescript
interface Articulation {
  id: string;
  name: string;
  type: ArticulationType;  // legato, staccato, sustain, etc.
  parameters: Record<string, unknown>;
}
```

### Supported Articulation Types

- `legato` - Smooth transitions between notes
- `staccato` - Short, detached notes
- `sustain` - Long, held notes
- `tremolo` - Rapid repetition
- `vibrato` - Pitch modulation
- `pizzicato` - Plucked strings
- `bowed` - Bowed strings
- `custom` - Custom articulation

## Sample Sets

Sample sets group related samples with optional round-robin:

```typescript
interface SampleSet {
  id: string;
  samples: Sample[];
  roundRobin?: RoundRobinConfig;
}
```

### Round-Robin Configuration

```typescript
interface RoundRobinConfig {
  strategy: "sequential" | "random";
  seed?: number;           // For deterministic random
  count: number;          // Number of round-robin samples
}
```

## Mapping

Explicit key and velocity mapping:

```typescript
interface Mapping {
  keyZones: KeyZone[];
  velocityZones: VelocityZone[];
}

interface KeyZone {
  range: [number, number];  // MIDI note range [0-127]
  sampleSetId: string;
  articulationId?: string;
}

interface VelocityZone {
  range: [number, number];  // MIDI velocity range [0-127]
  sampleSetId: string;
  articulationId?: string;
}
```

## Modulation Graph

Signal graph for modulation:

```typescript
interface ModulationGraph {
  nodes: ModulationNode[];
  edges: ModulationEdge[];
}

interface ModulationNode {
  id: string;
  type: ModulationNodeType;
  parameters: Record<string, unknown>;
}
```

### Modulation Node Types

- `lfo` - Low-frequency oscillator
- `envelope` - ADSR envelope
- `velocity` - MIDI velocity
- `aftertouch` - MIDI aftertouch
- `cc` - MIDI CC
- `math` - Mathematical operations
- `constant` - Constant value

## Performance Rules

Event-driven performance behavior:

```typescript
interface PerformanceRule {
  id: string;
  trigger: RuleTrigger;
  action: RuleAction;
  condition?: RuleCondition;
}
```

### Rule Triggers

- `noteOn` - Note-on event
- `noteOff` - Note-off event
- `cc` - MIDI CC change
- `programChange` - Program change
- `time` - Time-based trigger

### Rule Actions

- `switchArticulation` - Switch active articulation
- `modulate` - Apply modulation
- `selectSample` - Change sample selection
- `custom` - Custom action

## Metadata

Build and provenance information:

```typescript
interface InstrumentMetadata {
  compiledAt: string;           // ISO timestamp
  compilerVersion: string;       // Compiler version
  sourceIntent?: string;         // Original IIS (JSON)
  buildReport?: BuildReport;    // Compilation decisions
}
```

## Determinism Guarantees

MSF guarantees:

1. **Same Input = Same Output** - Identical MSF + MIDI = identical audio
2. **Explicit Behavior** - No hidden defaults or magic
3. **Complete Specification** - All behavior declared upfront
4. **Reproducible Builds** - Build reports document all decisions

## File Format

MSF instruments are stored as JSON files with `.msf` extension:

```json
{
  "identity": {
    "id": "piano_c4",
    "name": "Piano C4",
    "version": "1.0.0"
  },
  "articulations": [...],
  "sampleSets": [...],
  "mapping": {...},
  "modulation": {...},
  "rules": [...],
  "metadata": {...}
}
```



