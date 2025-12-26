# MSF — Modern Sampler Format

A deterministic, expressive, tool-first sampler platform.

## Overview

MSF (Modern Sampler Format) is a runtime-ready, declarative sampler format designed to replace the structural limitations of SoundFont and the unstructured complexity of SFZ, while avoiding proprietary lock-in.

MSF is the single source of truth for sampler playback behavior. Everything else in the system exists to author, validate, compile, audition, and refine MSF instruments.

## Core Philosophy

MSF succeeds only if it is:

- **Explicit** — no hidden defaults or engine magic
- **Deterministic** — same MSF + same MIDI = same audio
- **Structured** — musical concepts are first-class, not hacks
- **Inspectable** — readable, diff-able, testable artifacts
- **Practical** — supported by tooling, not just a spec

## Monorepo Structure

This is a monorepo managed with Bun workspaces:

```
modern-sampler-format/
├── apps/
│   ├── refinement-ui/      # Next.js UI for structured refinement
│   └── audition-harness/   # Simple runtime for auditioning MSF
├── packages/
│   ├── msf-core/           # Core MSF format definitions
│   ├── msf-compiler/       # IIS → MSF deterministic compiler
│   ├── msf-validator/      # IIS validation & repair
│   ├── inventory/          # Inventory ingestion system
│   └── intent-generator/   # AI-assisted intent generation
└── package.json
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0

### Installation

```bash
bun install
```

### Development

This monorepo uses [Turborepo](https://turbo.build) for fast, cached builds.

```bash
# Run all apps in dev mode
bun run dev

# Build all packages (with caching)
bun run build

# Type check all packages
bun run typecheck

# Lint
bun run lint

# Format
bun run format

# Clean all build outputs
bun run clean
```

Turborepo automatically:
- Caches build outputs for faster subsequent builds
- Runs tasks in parallel where possible
- Respects dependencies between packages
- Only rebuilds what changed

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

## Features

1. **Inventory Ingestion** — Canonical inventory of available samples
2. **Instrument Intent Generation** — AI-assisted typed intent spec
3. **IIS Validation & Repair** — Hard boundary between intent and runtime
4. **Deterministic Compiler** — IIS → MSF with full build reports
5. **Audition Harness** — Minimal runtime for testing MSF
6. **Refinement UI** — Controlled iteration on MSF instruments

## License

[To be determined]

