# MSF Architecture

## Overview

MSF is built as a monorepo with clear separation of concerns:

```
modern-sampler-format/
├── packages/
│   ├── msf-core/           # Core MSF format definitions
│   ├── msf-compiler/       # IIS → MSF deterministic compiler
│   ├── msf-validator/      # IIS validation & repair
│   ├── msf-runtime/        # MSF playback engine
│   ├── inventory/          # Inventory ingestion system
│   ├── intent-generator/   # AI-assisted intent generation
│   └── audition-harness/   # Simple runtime for auditioning MSF
├── apps/
│   ├── refinement-ui/      # Next.js UI for structured refinement
│   └── docs/              # Documentation site
```

## Package Responsibilities

### @msf/core

Core type definitions and runtime model for MSF instruments. Defines the complete MSF format specification.

**Key Exports:**
- `MSFInstrument` - Complete instrument bundle
- `Articulation`, `SampleSet`, `Mapping` - Core structures
- `ModulationGraph`, `PerformanceRule` - Advanced features

### @msf/compiler

Deterministic compiler that transforms Instrument Intent Spec (IIS) into complete MSF instruments.

**Key Functions:**
- `compile(intent, inventory, options)` - Main compilation function
- Resolves samples from inventory
- Builds explicit key and velocity zones
- Assigns round-robin behavior using seeded RNG
- Generates modulation graphs
- Emits event rules for performance behavior

### @msf/validator

Validation and repair system that ensures intent is valid before compilation.

**Key Functions:**
- `validateIntent(intent, options)` - Validates IIS
- `validateMSF(instrument)` - Validates compiled MSF
- `attemptRepair(intent, warnings, capabilities)` - Safe degradation

### @msf/runtime

Playback engine that processes MSF instruments and renders audio from MIDI events.

**Key Classes:**
- `MSFRuntime` - Main runtime class
- `renderToWAV()` - Render audio to WAV file
- `calculateMetrics()` - Calculate audio metrics

### @msf/builder

Canonical inventory system for managing audio samples.

**Key Classes:**
- `Inventory` - Main inventory class
- `scanDirectory()` - Scan directory and build inventory
- Extracts metadata from filenames
- Normalizes naming conventions

### @msf/intent-generator

AI-assisted generation of Instrument Intent Specs from natural language.

**Key Functions:**
- `generateIntent(prompt, inventory, options)` - Generate IIS
- `buildConstrainedPrompt()` - Build AI prompt with constraints

### @msf/audition-harness

Simple runtime for auditioning MSF instruments. Renders MIDI test clips to WAV files for immediate audition and comparison.

**Key Functions:**
- `audition(instrument, clips, options)` - Render MSF instrument with MIDI test clips
- `DEFAULT_TEST_CLIPS` - Predefined test clips for instrument audition
- Supports audio metrics (loudness, peak, spectrum)
- CLI entry point for direct usage

## Data Flow

### Authoring Flow

1. **Inventory Ingestion**
   ```
   Sample Files → scanDirectory() → Inventory
   ```

2. **Intent Generation**
   ```
   Natural Language → generateIntent() → InstrumentIntent
   ```

3. **Validation**
   ```
   InstrumentIntent → validateIntent() → ValidatedIntent
   ```

4. **Compilation**
   ```
   ValidatedIntent + Inventory → compile() → MSFInstrument
   ```

5. **Audition**
   ```
   MSFInstrument + MIDI → MSFRuntime → Audio
   ```

### Refinement Flow

1. User adjusts controls in Refinement UI
2. Controls converted to intent modifications
3. Intent recompiled via API
4. New MSF instrument generated
5. Audition triggered automatically
6. User hears results immediately

## Determinism

MSF ensures deterministic behavior through:

1. **Explicit Configuration** - No hidden defaults
2. **Seeded Random** - Round-robin uses seeded RNG
3. **Complete Specification** - All behavior declared upfront
4. **Build Reports** - Every decision documented

## Extensibility

MSF is designed to be extensible:

- **Custom Articulations** - Add new articulation types
- **Modulation Nodes** - Extend modulation graph
- **Performance Rules** - Add custom event handlers
- **Engine Capabilities** - Validate against engine limits

