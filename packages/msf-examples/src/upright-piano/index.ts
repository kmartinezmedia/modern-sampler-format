import msfData from './msf.json' with { type: 'json' };
import type { MSFInstrument } from '@msf/core';

// Type assertion to ensure the JSON matches MSFInstrument structure
// JSON doesn't preserve tuple types, so we assert through 'unknown' first
// The runtime data is valid, but TypeScript infers number[] instead of [number, number]
const uprightPianoMSF = msfData as unknown as MSFInstrument;

export default uprightPianoMSF;