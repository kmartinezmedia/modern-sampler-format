"use client";

import { useState } from "react";

/**
 * MSF Refinement UI
 *
 * A controlled way to iterate on MSF without chaos.
 * 6–10 high-value musical knobs (attack, brightness, room, release, etc.)
 * Knobs modify intent, not MSF directly.
 * Changes trigger recompilation.
 * Results are immediately auditionable.
 */

interface RefinementControls {
  attack: number; // 0-100
  brightness: number; // 0-100
  room: number; // 0-100
  release: number; // 0-100
  warmth: number; // 0-100
  presence: number; // 0-100
}

export default function RefinementPage() {
  const [controls, setControls] = useState<RefinementControls>({
    attack: 50,
    brightness: 50,
    room: 50,
    release: 50,
    warmth: 50,
    presence: 50,
  });

  const handleControlChange = (key: keyof RefinementControls, value: number) => {
    setControls((prev) => ({ ...prev, [key]: value }));
    // TODO: Trigger recompilation and audition
  };

  return (
    <main className="container">
      <h1>MSF Refinement UI</h1>
      <p>Structured refinement interface for MSF instruments</p>

      <div className="controls">
        <ControlKnob
          label="Attack"
          value={controls.attack}
          onChange={(value) => handleControlChange("attack", value)}
        />
        <ControlKnob
          label="Brightness"
          value={controls.brightness}
          onChange={(value) => handleControlChange("brightness", value)}
        />
        <ControlKnob
          label="Room"
          value={controls.room}
          onChange={(value) => handleControlChange("room", value)}
        />
        <ControlKnob
          label="Release"
          value={controls.release}
          onChange={(value) => handleControlChange("release", value)}
        />
        <ControlKnob
          label="Warmth"
          value={controls.warmth}
          onChange={(value) => handleControlChange("warmth", value)}
        />
        <ControlKnob
          label="Presence"
          value={controls.presence}
          onChange={(value) => handleControlChange("presence", value)}
        />
      </div>
    </main>
  );
}

function ControlKnob({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="control-knob">
      <label htmlFor={label}>{label}</label>
      <input
        id={label}
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
      />
      <span>{value}</span>
    </div>
  );
}

