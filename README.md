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

### No Backward Compatibility

**MSF RULE: No backward compatibility. Ever.**

MSF is a compiled format. All decisions are made at compile time. Runtime must never guess, infer, or fall back to legacy behavior.

- Regions are **REQUIRED** (not optional)
- Missing regions = validation error (not warning)
- No "closest sample" heuristics
- No runtime inference
- Fail fast if data is missing or incomplete

If you need to support old formats, migrate them at compile time, not at runtime. MSF is not a configuration language — it's a fully-resolved runtime model.

This rule is enforced at multiple levels:
- **Type system**: Regions are required in `MSFInstrument`
- **Validator**: Missing regions = validation error
- **Runtime**: Constructor throws if regions are missing
- **Compiler**: Always generates regions from sparse samples

## Monorepo Structure

This is a monorepo managed with Bun workspaces and Turborepo:

```
modern-sampler-format/
├── apps/
│   ├── refinement-ui/      # Next.js UI for structured refinement
│   └── docs/               # Documentation site (Next.js)
├── packages/
│   ├── msf-core/           # Core MSF format definitions
│   ├── msf-compiler/       # IIS → MSF deterministic compiler
│   ├── msf-validator/      # IIS validation & repair
│   ├── msf-runtime/        # MSF playback engine
│   ├── inventory/          # Inventory ingestion system
│   ├── intent-generator/   # AI-assisted intent generation
│   └── audition-harness/   # Simple runtime for auditioning MSF
├── docs/                   # Documentation markdown files
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
5. **MSF Runtime** — Playback engine for MSF instruments
6. **Audition Harness** — Minimal runtime for testing MSF
7. **Refinement UI** — Controlled iteration on MSF instruments
8. **Documentation** — Comprehensive docs with interactive site

## Documentation

View the full documentation:

```bash
cd apps/docs
bun run dev
```

Then open http://localhost:3000 in your browser.

Documentation covers:
- Introduction and architecture
- Format specification
- Instrument Intent Spec
- Compiler and runtime guides
- API reference
- Examples

## License

[To be determined]

