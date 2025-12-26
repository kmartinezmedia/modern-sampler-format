# Runtime Guide

## Overview

The MSF runtime processes MSF instruments and renders audio from MIDI events. It provides deterministic playback behavior as specified by MSF.

## Basic Usage

```typescript
import { MSFRuntime, renderToWAV } from "@msf/runtime";
import { MSFInstrument } from "@msf/core";

const instrument: MSFInstrument = {
  // ... your instrument
};

const runtime = new MSFRuntime(instrument, 44100);

// Process MIDI events
runtime.noteOn(60, 100, 0);  // Note 60, velocity 100, time 0
runtime.noteOff(60, 1.0);    // Note 60, time 1.0

// Render audio
const audio = runtime.render(44100);  // 1 second at 44.1kHz
```

## Runtime Class

### Constructor

```typescript
const runtime = new MSFRuntime(
  instrument: MSFInstrument,
  sampleRate: number = 44100
);
```

### Methods

#### noteOn

Process a note-on event:

```typescript
runtime.noteOn(note: number, velocity: number, time?: number): void
```

#### noteOff

Process a note-off event:

```typescript
runtime.noteOff(note: number, time?: number): void
```

#### render

Render audio samples:

```typescript
const audio = runtime.render(frameCount: number): Float32Array
```

Returns interleaved stereo samples `[L, R, L, R, ...]`.

#### reset

Reset runtime state:

```typescript
runtime.reset(): void
```

## Sample Selection

The runtime selects samples based on:

1. **Key Zones** - MIDI note range
2. **Velocity Zones** - MIDI velocity range
3. **Round-Robin** - Deterministic sample rotation
4. **Articulation** - Active articulation

## Round-Robin

Round-robin ensures variety while maintaining determinism:

```typescript
// Sequential round-robin
roundRobin: {
  strategy: "sequential",
  count: 4
}

// Random round-robin (seeded)
roundRobin: {
  strategy: "random",
  seed: 12345,
  count: 4
}
```

## Modulation

Modulation is applied in real-time:

```typescript
// LFO modulation
modulation: {
  nodes: [{ id: "lfo1", type: "lfo", ... }],
  edges: [{ source: "lfo1", target: "gain", amount: 0.5 }]
}
```

## Performance Rules

Rules trigger on events:

```typescript
// Switch articulation on note-on
rules: [{
  trigger: { type: "noteOn" },
  action: { type: "switchArticulation", ... }
}]
```

## Rendering to WAV

```typescript
import { renderToWAV } from "@msf/runtime";

await renderToWAV(
  runtime,
  duration: number,      // Duration in seconds
  sampleRate: number,     // Sample rate
  outputPath: string      // Output file path
);
```

## Audio Metrics

Calculate audio metrics:

```typescript
import { calculateMetrics } from "@msf/runtime";

const metrics = calculateMetrics(audio: Float32Array);
// { loudness: -23.0, peak: -3.0 }
```

## Example: Full Playback

```typescript
const runtime = new MSFRuntime(instrument, 44100);

// Play a chord
runtime.noteOn(60, 100, 0);  // C
runtime.noteOn(64, 100, 0);  // E
runtime.noteOn(67, 100, 0);  // G

// Render 2 seconds
const audio = runtime.render(88200);  // 2 seconds

// Release notes
runtime.noteOff(60, 2.0);
runtime.noteOff(64, 2.0);
runtime.noteOff(67, 2.0);

// Render release
const release = runtime.render(44100);  // 1 second
```

## Determinism

The runtime guarantees:

1. **Same MSF + Same MIDI = Same Audio**
2. **Seeded Random** - Round-robin uses seeded RNG
3. **Explicit Behavior** - No hidden state
4. **Reproducible** - Identical results every time

## Performance Considerations

- **Voice Management** - Active voices are managed automatically
- **Sample Loading** - Samples are loaded on-demand
- **Memory Usage** - Only active samples are kept in memory
- **CPU Usage** - Rendering is optimized for real-time

