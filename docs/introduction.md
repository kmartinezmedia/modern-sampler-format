# Introduction to MSF

MSF (Modern Sampler Format) is a runtime-ready, declarative sampler format designed to replace the structural limitations of SoundFont and the unstructured complexity of SFZ, while avoiding proprietary lock-in.

## What is MSF?

MSF is the single source of truth for sampler playback behavior. Everything else in the system exists to author, validate, compile, audition, and refine MSF instruments.

## Core Philosophy

MSF succeeds only if it is:

- **Explicit** — no hidden defaults or engine magic
- **Deterministic** — same MSF + same MIDI = same audio
- **Structured** — musical concepts are first-class, not hacks
- **Inspectable** — readable, diff-able, testable artifacts
- **Practical** — supported by tooling, not just a spec

## Installation

### Prerequisites

- [Bun](https://bun.sh) >= 1.3.5
- Node.js 20+ (for some tools)

### Install from Source

```bash
git clone https://github.com/your-org/modern-sampler-format
cd modern-sampler-format
bun install
```

### Build All Packages

```bash
bun run build
```

## System Architecture

```
Natural Language Prompt
        ↓
AI (constrained)
        ↓
Instrument Intent Spec (typed JSON)
        ↓
Validation & Repair
        ↓
Deterministic Compiler
        ↓
MSF Instrument Bundle
        ↓
Audition, Refinement, Playback
```

MSF is the stable center of the system. All workflows converge on producing high-quality MSF.

## Key Features

1. **Inventory Ingestion** — Canonical inventory of available samples
2. **Instrument Intent Generation** — AI-assisted typed intent spec
3. **IIS Validation & Repair** — Hard boundary between intent and runtime
4. **Deterministic Compiler** — IIS → MSF with full build reports
5. **Audition Harness** — Minimal runtime for testing MSF
6. **Refinement UI** — Controlled iteration on MSF instruments

## Next Steps

- Read the [Architecture Guide](./architecture.md) to understand the system design
- Check out [Examples](./examples.md) to see MSF in action
- Explore the [Format Specification](./format-specification.md) for technical details



