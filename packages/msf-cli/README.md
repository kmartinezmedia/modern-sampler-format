# @msf/cli

Command-line tool for compiling MSF instruments.

## Installation

```bash
bun install @msf/cli
```

Or use directly with `bun x`:

```bash
bun x @msf/cli compile instrument.msf.json
```

## Usage

### Compile an MSF Instrument

Compile an MSF instrument to ensure all required fields are present (like `baseDurationFrames`):

```bash
# Compile and overwrite the input file
msf compile instrument.msf.json

# Compile to a new file
msf compile instrument.msf.json --output compiled.msf.json

# Compile and preserve original as .original file
msf compile instrument.msf.json --preserve-original

# Compile with strict mode (fail on warnings)
msf compile instrument.msf.json --strict
```

## Why Recompile?

MSF instruments should be fully compiled with all required fields present. The compiler ensures:

- All regions have `baseDurationFrames` pre-computed
- All mappings are explicit and valid
- No runtime guessing or inference needed

Recompiling an existing MSF instrument extracts the inventory and intent, then recompiles it with the latest compiler to ensure all fields are present.

## Programmatic API

You can also use the CLI programmatically:

```typescript
import { compileMSF } from "@msf/cli";

const instrument = await compileMSF({
  input: "instrument.msf.json",
  output: "compiled.msf.json",
  preserveOriginal: true,
  strict: false,
});
```

## Examples

See the `@msf/examples` package for usage in build scripts:

```json
{
  "scripts": {
    "build:msf": "bun x @msf/cli compile src/upright-piano/msf.json --output dist/upright-piano/msf.json --preserve-original"
  }
}
```


