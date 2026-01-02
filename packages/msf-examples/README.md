# @msf/examples

Example MSF package demonstrating the recommended structure for MSF packages.

This package serves as a **template** for how consumers should structure their MSF packages.

## Package Structure

```
@msf/examples/
├── piano/                    # Instrument directory
│   ├── piano.msf.json       # Compiled MSF instrument (with relative paths)
│   └── samples/             # Audio samples directory
│       ├── A0vL.flac
│       ├── A0vH.flac
│       └── ...
└── package.json             # Package configuration with exports
```

**Note**: Only the MSF JSON file and samples are included. The inventory and intent JSON files are build artifacts and not needed in the final package.

## Key Principles

1. **Relative Paths**: MSF JSON files use relative paths (e.g., `samples/A0vL.flac`) so packages are portable
2. **Instrument Subdirectories**: Each instrument gets its own subdirectory
3. **Samples Directory**: Audio files live in a `samples/` subdirectory within the instrument directory
4. **Package Exports**: Use `package.json` exports to expose MSF files via `require.resolve()`

## Usage

### Loading the MSF Instrument

```typescript
import { loadMSFFromPackage } from "@msf/builder";

// Load the instrument
const instrument = await loadMSFFromPackage("@msf/examples", "piano/msf");

// Use with runtime
import { MSFRuntime } from "@msf/runtime";
const runtime = new MSFRuntime(instrument, 44100);
runtime.noteOn(60, 100, 0);
```

### Extracting Inventory and Intent

```typescript
import {
  loadMSFFromPackage,
  extractInventoryFromMSF,
  extractIntentFromMSF,
} from "@msf/builder";

// Load and extract
const msf = await loadMSFFromPackage("@msf/examples", "piano/msf");
const inventory = extractInventoryFromMSF(msf);
const intent = extractIntentFromMSF(msf, {
  attack: 0.02,
  release: 0.4,
});
```

### Using Package Helpers

This package provides convenience functions:

```typescript
import { getPianoInventory, getPianoIntent } from "@msf/examples";

const inventory = await getPianoInventory();
const intent = await getPianoIntent({
  attack: 0.01,
  release: 0.3,
});
```

## Creating Your Own MSF Package

### Quick Start: Auto-Generate from Samples

**The easiest way** - just point to your samples directory:

```typescript
import { autoGenerateMSF, scaffoldMSFPackage } from "@msf/builder";

// Auto-generate MSF from samples directory
// Extracts note, velocity, and articulation from filenames!
const instrument = await autoGenerateMSF(
  "./samples/piano",
  "Upright Piano",
  { groupByVelocity: true }
);

// Then scaffold the package
await scaffoldMSFPackage({
  outputDir: "./my-msf-package",
  instrumentName: "piano",
  msfPath: "./piano.msf.json"  // Save the generated instrument first
});
```

The `autoGenerateMSF` function automatically:
- ✅ Extracts **note** from filename (e.g., `D#4vL.flac` → note 63)
- ✅ Extracts **velocity** from filename (e.g., `vH` → 100, `vL` → 40)
- ✅ Extracts **articulation** from filename
- ✅ Groups samples by velocity into articulations
- ✅ Creates proper velocity-layered mapping

### Manual Setup

1. **Structure your package**:
   ```
   your-msf-package/
   ├── your-instrument/
   │   ├── your-instrument.msf.json  (with relative paths!)
   │   └── samples/
   │       └── *.flac
   └── package.json
   ```

2. **Convert paths to relative** (if your MSF has absolute paths):
   ```typescript
   import { convertPathsToRelative } from "@msf/builder";
   await convertPathsToRelative("./your-instrument.msf.json");
   ```

3. **Configure package.json exports**:
   ```json
   {
     "name": "@your-org/your-msf-package",
     "exports": {
       "./your-instrument/msf": "./your-instrument/your-instrument.msf.json"
     },
     "files": [
       "your-instrument/*.msf.json",
       "your-instrument/samples/**/*.flac"
     ]
   }
   ```

4. **Use the helpers**:
   ```typescript
   import { loadMSFFromPackage } from "@msf/builder";
   const instrument = await loadMSFFromPackage(
     "@your-org/your-msf-package",
     "your-instrument/msf"
   );
   ```

## Features

- **66 FLAC samples** covering A0 to C8 (MIDI notes 21-108)
- **Velocity layers**: Piano (low velocity) and Forte (high velocity)
- **Portable**: Uses relative paths, works anywhere
- **Easy to use**: Simple `loadMSFFromPackage()` API
