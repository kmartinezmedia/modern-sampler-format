"use client";

import { useState, useCallback, useEffect } from "react";

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

interface CompilationState {
  status: "idle" | "compiling" | "success" | "error";
  message?: string;
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

  const [compilationState, setCompilationState] = useState<CompilationState>({
    status: "idle",
  });

  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const triggerRecompilation = useCallback(async (updatedControls: RefinementControls) => {
    setCompilationState({ status: "compiling", message: "Recompiling instrument..." });

    try {
      // Convert controls to intent modifications
      const intentModifications = {
        attack: updatedControls.attack / 100,
        brightness: updatedControls.brightness / 100,
        room: updatedControls.room / 100,
        release: updatedControls.release / 100,
        warmth: updatedControls.warmth / 100,
        presence: updatedControls.presence / 100,
      };

      // Call API route to recompile
      const response = await fetch("/api/recompile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controls: intentModifications }),
      });

      if (!response.ok) {
        throw new Error("Recompilation failed");
      }

      const result = await response.json();

      setCompilationState({
        status: "success",
        message: "Instrument recompiled successfully",
      });

      // Trigger audition if available
      if (result.auditionUrl) {
        // Would play audio preview here
        console.log("Audition available at:", result.auditionUrl);
      }
    } catch (error) {
      setCompilationState({
        status: "error",
        message: error instanceof Error ? error.message : "Recompilation failed",
      });
    }
  }, []);

  const handleControlChange = useCallback(
    (key: keyof RefinementControls, value: number) => {
      setControls((prev) => {
        const updated = { ...prev, [key]: value };

        // Debounce recompilation
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        const timer = setTimeout(() => {
          triggerRecompilation(updated);
        }, 500); // 500ms debounce

        setDebounceTimer(timer);
        return updated;
      });
    },
    [debounceTimer, triggerRecompilation]
  );

  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return (
    <main className="container">
      <h1>MSF Refinement UI</h1>
      <p>Structured refinement interface for MSF instruments</p>

      {compilationState.status !== "idle" && (
        <div className={`status status-${compilationState.status}`}>
          {compilationState.message}
        </div>
      )}

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

