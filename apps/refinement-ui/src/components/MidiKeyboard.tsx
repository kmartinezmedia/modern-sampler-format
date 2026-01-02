import { useState, useCallback, useEffect } from "react";

interface MidiKeyboardProps {
  onNotePlay: (note: number, velocity: number) => Promise<void>;
  disabled?: boolean;
}

// MIDI note numbers for a 2-octave keyboard (C4 to C6)
const WHITE_KEYS = ["C", "D", "E", "F", "G", "A", "B"];

// Starting from C4 (MIDI note 60)
const getNoteNumber = (octave: number, keyIndex: number, isBlack: boolean): number => {
  const baseNote = 60 + (octave - 4) * 12; // C4 = 60
  const whiteKeyOffset = [0, 2, 4, 5, 7, 9, 11][keyIndex]; // C, D, E, F, G, A, B
  if (isBlack) {
    const blackKeyOffset = [1, 3, -1, 6, 8, 10, -1][keyIndex]; // C#, D#, -, F#, G#, A#, -
    return baseNote + blackKeyOffset;
  }
  return baseNote + whiteKeyOffset;
};

export default function MidiKeyboard({ onNotePlay, disabled = false }: MidiKeyboardProps) {
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());

  const handleKeyPress = useCallback(
    async (note: number, velocity: number = 100) => {
      if (disabled || pressedKeys.has(note)) return;

      setPressedKeys((prev) => new Set(prev).add(note));

      try {
        await onNotePlay(note, velocity);
      } catch (error) {
        console.error("Failed to play note:", error);
      } finally {
        // Release key visual state after a delay (visual feedback)
        setTimeout(() => {
          setPressedKeys((prev) => {
            const next = new Set(prev);
            next.delete(note);
            return next;
          });
        }, 150);
      }
    },
    [disabled, onNotePlay, pressedKeys]
  );

  // Keyboard shortcuts (computer keyboard)
  useEffect(() => {
    if (disabled) return;

    const keyMap: Record<string, number> = {
      // First octave (C4-B4)
      a: 60, // C
      w: 61, // C#
      s: 62, // D
      e: 63, // D#
      d: 64, // E
      f: 65, // F
      t: 66, // F#
      g: 67, // G
      y: 68, // G#
      h: 69, // A
      u: 70, // A#
      j: 71, // B
      // Second octave (C5-B5)
      k: 72, // C
      o: 73, // C#
      l: 74, // D
      p: 75, // D#
      ";": 76, // E
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const note = keyMap[e.key.toLowerCase()];
      if (note) {
        e.preventDefault();
        handleKeyPress(note, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, handleKeyPress]);

  const octaves = [4, 5]; // C4 to C6

  return (
    <div className="midi-keyboard">
      <div className="keyboard-container">
        {octaves.map((octave) => (
          <div key={octave} className="keyboard-octave">
            {/* White keys */}
            {WHITE_KEYS.map((key, index) => {
              const note = getNoteNumber(octave, index, false);
              const isPressed = pressedKeys.has(note);
              return (
                <button
                  key={`${octave}-${key}-white`}
                  className={`key key-white ${isPressed ? "key-pressed" : ""}`}
                  onMouseDown={() => handleKeyPress(note, 100)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleKeyPress(note, 100);
                  }}
                  disabled={disabled}
                  aria-label={`${key}${octave} (MIDI ${note})`}
                >
                  <span className="key-label">{key}</span>
                </button>
              );
            })}

            {/* Black keys - render all 5 black keys per octave */}
            {[
              { key: "C#", whiteKeyIndex: 0, blackKeyIndex: 0 },
              { key: "D#", whiteKeyIndex: 1, blackKeyIndex: 1 },
              { key: "F#", whiteKeyIndex: 3, blackKeyIndex: 3 },
              { key: "G#", whiteKeyIndex: 4, blackKeyIndex: 4 },
              { key: "A#", whiteKeyIndex: 5, blackKeyIndex: 5 },
            ].map(({ key, whiteKeyIndex, blackKeyIndex }) => {
              const note = getNoteNumber(octave, blackKeyIndex, true);
              const isPressed = pressedKeys.has(note);
              // Calculate position: each white key is 100/7 ≈ 14.2857% of octave width
              // Black keys are centered between white keys, accounting for their 9% width
              const whiteKeyWidth = 100 / 7; // ~14.2857%
              const blackKeyWidth = 9; // 9% of container (matches CSS)

              // Position at the center between two white keys, minus half the black key width
              // Center is at (whiteKeyIndex + 0.5) * whiteKeyWidth
              const centerPosition = (whiteKeyIndex + 0.5) * whiteKeyWidth;
              const leftPosition = Math.max(0, Math.min(100 - blackKeyWidth, centerPosition - (blackKeyWidth / 2)));

              return (
                <button
                  key={`${octave}-${key}-black`}
                  className={`key key-black ${isPressed ? "key-pressed" : ""}`}
                  style={{ left: `${leftPosition}%` }}
                  onMouseDown={() => handleKeyPress(note, 100)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleKeyPress(note, 100);
                  }}
                  disabled={disabled}
                  aria-label={`${key}${octave} (MIDI ${note})`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="keyboard-hint">Click keys or use keyboard: A-S-D-F-G-H-J-K-L for white keys, W-E-T-Y-U-O for black keys</p>
    </div>
  );
}

