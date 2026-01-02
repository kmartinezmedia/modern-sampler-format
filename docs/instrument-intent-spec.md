# Instrument Intent Spec (IIS)

## Overview

The Instrument Intent Spec (IIS) is a typed, declarative specification that describes musical goals, not wiring. It references inventory by ID, never by filename.

## IIS Structure

```typescript
interface InstrumentIntent {
  intent: IntentDescription;
  inventoryReferences: InventoryReference[];
  articulations: ArticulationIntent[];
  mapping: MappingIntent;
  modulation?: ModulationIntent;
  performance?: PerformanceIntent;
}
```

## Intent Description

High-level musical goals:

```typescript
interface IntentDescription {
  name: string;
  description?: string;
  instrumentType: string;
  targetArticulations: string[];
}
```

## Inventory References

References to inventory samples by ID:

```typescript
interface InventoryReference {
  id: string;                    // Inventory sample ID
  role: "primary" | "secondary" | "roundRobin";
  constraints?: {
    noteRange?: [number, number];
    velocityRange?: [number, number];
    articulation?: string;
  };
}
```

## Articulation Intent

Describes articulation strategy:

```typescript
interface ArticulationIntent {
  id: string;
  name: string;
  type: string;
  samples: string[];             // Inventory IDs
  parameters?: Record<string, unknown>;
}
```

## Mapping Intent

Mapping strategy:

```typescript
interface MappingIntent {
  strategy: "chromatic" | "velocityLayered" | "keySplit" | "hybrid";
  zones?: MappingZone[];
}

interface MappingZone {
  keyRange?: [number, number];
  velocityRange?: [number, number];
  sampleSetIds: string[];
}
```

### Mapping Strategies

- **chromatic** - One sample per MIDI note
- **velocityLayered** - Different samples for different velocities
- **keySplit** - Different samples for different key ranges
- **hybrid** - Combination of strategies

## Modulation Intent

Modulation configuration:

```typescript
interface ModulationIntent {
  sources: ModulationSource[];
  targets: ModulationTarget[];
}
```

## Performance Intent

Performance behavior rules:

```typescript
interface PerformanceIntent {
  rules: PerformanceRuleIntent[];
}
```

## Example IIS

```json
{
  "intent": {
    "name": "Grand Piano",
    "description": "Concert grand piano",
    "instrumentType": "piano",
    "targetArticulations": ["sustain", "staccato"]
  },
  "inventoryReferences": [
    {
      "id": "sample_c4_100",
      "role": "primary",
      "constraints": {
        "noteRange": [60, 60],
        "velocityRange": [100, 100]
      }
    }
  ],
  "articulations": [
    {
      "id": "sustain",
      "name": "Sustain",
      "type": "sustain",
      "samples": ["sample_c4_100"]
    }
  ],
  "mapping": {
    "strategy": "chromatic"
  }
}
```

## IIS to MSF Transformation

The compiler transforms IIS into MSF:

1. **Resolve Samples** - Look up inventory samples by ID
2. **Build Zones** - Create key/velocity zones from mapping strategy
3. **Assign Round-Robin** - Use seeded RNG for deterministic selection
4. **Generate Modulation** - Build modulation graph from intent
5. **Emit Rules** - Convert performance intent to rules

## Validation

IIS is validated before compilation:

- Schema validation
- Capability checks against engine
- Safe degradation of unsupported features
- Explicit warnings for every compromise



