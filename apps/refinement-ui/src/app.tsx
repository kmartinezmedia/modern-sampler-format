import { createRoot } from "react-dom/client";
import { useState, useCallback, useEffect, useRef } from "react";
import MidiKeyboard from "./components/MidiKeyboard";

interface RefinementControls {
  attack: number;
  brightness: number;
  room: number;
  release: number;
  warmth: number;
  presence: number;
}

interface CompilationState {
  status: "idle" | "compiling" | "success" | "error";
  message?: string;
}

interface AudioState {
  audioUrl: string | null;
  isGenerating: boolean;
  error: string | null;
}

interface Version {
  id: number;
  name: string;
  controls: Record<string, number>;
  createdAt: string;
  isActive: boolean;
}

function App() {
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

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>({
    audioUrl: null,
    isGenerating: false,
    error: null,
  });
  const [currentInstrument, setCurrentInstrument] = useState<unknown>(null);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [wsReady, setWsReady] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);

  // Fetch versions
  const fetchVersions = useCallback(async () => {
    try {
      const response = await fetch("/api/versions");
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions);
        const active = data.versions.find((v: Version) => v.isActive);
        if (active) setActiveVersionId(active.id);
      }
    } catch (error) {
      console.error("Failed to fetch versions:", error);
    }
  }, []);

  const generateAudioPreview = useCallback(async (instrument: unknown) => {
    setAudioState({ audioUrl: null, isGenerating: true, error: null });

    try {
      const response = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument,
          testNote: 60,
          testVelocity: 100,
          duration: 2.0,
        }),
      });

      if (!response.ok) throw new Error("Audio generation failed");

      const result = await response.json();
      setAudioState({
        audioUrl: result.audioUrl,
        isGenerating: false,
        error: null,
      });
    } catch (error) {
      setAudioState({
        audioUrl: null,
        isGenerating: false,
        error: error instanceof Error ? error.message : "Failed to generate audio",
      });
    }
  }, []);

  const handleCompile = useCallback(async () => {
    setCompilationState({ status: "compiling", message: "Compiling instrument..." });

    try {
      const intentModifications = {
        attack: controls.attack / 100,
        brightness: controls.brightness / 100,
        room: controls.room / 100,
        release: controls.release / 100,
        warmth: controls.warmth / 100,
        presence: controls.presence / 100,
      };

      const response = await fetch("/api/recompile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controls: intentModifications }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Compilation failed (${response.status})`);
      }

      const result = await response.json();

      setCompilationState({
        status: "success",
        message: "Instrument compiled successfully",
      });
      setHasUnsavedChanges(false);

      if (result.instrument) {
        setCurrentInstrument(result.instrument);
        await generateAudioPreview(result.instrument);
      }

      // Refresh versions list
      await fetchVersions();
    } catch (error) {
      setCompilationState({
        status: "error",
        message: error instanceof Error ? error.message : "Compilation failed",
      });
    }
  }, [controls, generateAudioPreview, fetchVersions]);

  const handleLoadVersion = useCallback(async (versionId: number) => {
    try {
      const response = await fetch("/api/versions/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: versionId }),
      });

      if (!response.ok) throw new Error("Failed to load version");

      const result = await response.json();

      // Update controls from loaded version
      const loadedControls = result.controls;
      setControls({
        attack: Math.round(loadedControls.attack * 100),
        brightness: Math.round(loadedControls.brightness * 100),
        room: Math.round(loadedControls.room * 100),
        release: Math.round(loadedControls.release * 100),
        warmth: Math.round(loadedControls.warmth * 100),
        presence: Math.round(loadedControls.presence * 100),
      });

      setCurrentInstrument(result.instrument);
      setActiveVersionId(versionId);
      setHasUnsavedChanges(false);
      setCompilationState({ status: "success", message: "Version loaded" });

      await generateAudioPreview(result.instrument);
      await fetchVersions();
    } catch (error) {
      console.error("Failed to load version:", error);
    }
  }, [generateAudioPreview, fetchVersions]);

  const handleDeleteVersion = useCallback(async (versionId: number) => {
    if (!confirm("Delete this version?")) return;

    try {
      const response = await fetch("/api/versions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: versionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to delete");
        return;
      }

      await fetchVersions();
    } catch (error) {
      console.error("Failed to delete version:", error);
    }
  }, [fetchVersions]);

  const handleControlChange = useCallback((key: keyof RefinementControls, value: number) => {
    setControls((prev) => {
      setHasUnsavedChanges(true);
      return { ...prev, [key]: value };
    });
  }, []);

  // Audio element ref for reuse
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  // Process audio queue
  const processAudioQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    const nextUrl = audioQueueRef.current.shift();
    if (!nextUrl) return;

    isPlayingRef.current = true;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    audioRef.current.src = nextUrl;
    audioRef.current.onended = () => {
      isPlayingRef.current = false;
      processAudioQueue();
    };
    audioRef.current.onerror = () => {
      console.error("[AUDIO] Error playing");
      isPlayingRef.current = false;
      processAudioQueue();
    };

    audioRef.current.play().catch((err) => {
      console.error("[AUDIO] Play failed:", err);
      isPlayingRef.current = false;
    });
  }, []);

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setWsReady(true);
      if (currentInstrument) {
        ws.send(JSON.stringify({ type: "setInstrument", instrument: currentInstrument }));
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "audio") {
        console.log(`[AUDIO] Queuing note ${data.note}`);
        // For MIDI, play immediately without queueing (polyphonic)
        const audio = new Audio(data.audioUrl);
        audio.play().catch((err) => {
          console.error("[AUDIO] Play failed:", err);
        });
      }
    };

    ws.onerror = () => setWsReady(false);
    ws.onclose = () => setWsReady(false);

    setWsConnection(ws);
    return () => ws.close();
  }, []);

  // Send instrument when it changes
  useEffect(() => {
    if (wsConnection?.readyState === WebSocket.OPEN && currentInstrument) {
      wsConnection.send(JSON.stringify({ type: "setInstrument", instrument: currentInstrument }));
    }
  }, [currentInstrument, wsConnection]);

  const playNote = useCallback(async (note: number, velocity: number) => {
    // Play via server API (audio comes through computer speakers)
    try {
      await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, velocity }),
      });
    } catch (err) {
      console.error("Failed to play note:", err);
    }
  }, []);

  // Server-side MIDI status
  const [midiDevice, setMidiDevice] = useState<string | null>(null);

  useEffect(() => {
    // Poll server for MIDI status
    const checkMidi = async () => {
      try {
        const res = await fetch("/api/midi");
        if (res.ok) {
          const data = await res.json();
          setMidiDevice(data.connected ? data.deviceName : null);
        }
      } catch {
        // Ignore errors
      }
    };

    checkMidi();
    const interval = setInterval(checkMidi, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Initial load - fetch versions and load active
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      (async () => {
        setCompilationState({ status: "compiling", message: "Loading..." });
        try {
          // Fetch versions
          const versionsResponse = await fetch("/api/versions");
          if (versionsResponse.ok) {
            const data = await versionsResponse.json();
            setVersions(data.versions);

            // Find and load active version
            const active = data.versions.find((v: Version) => v.isActive);
            if (active) {
              setActiveVersionId(active.id);
              // Load it
              const loadResponse = await fetch("/api/versions/load", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: active.id }),
              });
              if (loadResponse.ok) {
                const result = await loadResponse.json();
                const loadedControls = result.controls;
                setControls({
                  attack: Math.round(loadedControls.attack * 100),
                  brightness: Math.round(loadedControls.brightness * 100),
                  room: Math.round(loadedControls.room * 100),
                  release: Math.round(loadedControls.release * 100),
                  warmth: Math.round(loadedControls.warmth * 100),
                  presence: Math.round(loadedControls.presence * 100),
                });
                setCurrentInstrument(result.instrument);
                await generateAudioPreview(result.instrument);
              }
            }
          }
          setCompilationState({ status: "success", message: "Ready" });
        } catch (error) {
          setCompilationState({ status: "error", message: error instanceof Error ? error.message : "Failed" });
        }
      })();
    }
  }, [initialized, generateAudioPreview]);

  return (
    <main className="container">
      <h1>MSF Refinement UI</h1>
      <p>Structured refinement interface for MSF instruments</p>

      {compilationState.status !== "idle" && (
        <div className={`status status-${compilationState.status}`}>
          {compilationState.message}
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="compile-cta">
          <button
            type="button"
            className="compile-button"
            onClick={handleCompile}
            disabled={compilationState.status === "compiling"}
          >
            {compilationState.status === "compiling" ? "Compiling..." : "Save New Version"}
          </button>
        </div>
      )}

      {(audioState.audioUrl || audioState.isGenerating || audioState.error) && (
        <div className="audio-preview">
          <h2>Audio Preview</h2>
          {audioState.isGenerating && <p className="audio-status">Generating audio preview...</p>}
          {audioState.error && <p className="audio-error">Error: {audioState.error}</p>}
          {audioState.audioUrl && (
            <div className="audio-player">
              <audio controls src={audioState.audioUrl} className="audio-element">
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>
      )}

      <div className="midi-keyboard-section">
        <h2>MIDI Keyboard</h2>
        {midiDevice && (
          <p className="midi-status">
            🎹 <strong>{midiDevice}</strong> connected
          </p>
        )}
        {!wsReady && <p className="keyboard-hint" style={{ marginTop: 0, color: "#dc2626" }}>Connecting...</p>}
        {wsReady && !currentInstrument && <p className="keyboard-hint" style={{ marginTop: 0 }}>Load a version to enable keyboard</p>}
        <MidiKeyboard onNotePlay={playNote} disabled={!currentInstrument || !wsReady} />
      </div>

      <div className="controls">
        {(["attack", "brightness", "room", "release", "warmth", "presence"] as const).map((key) => (
          <div key={key} className="control-knob">
            <label htmlFor={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
            <input
              id={key}
              type="range"
              min="0"
              max="100"
              value={controls[key]}
              onChange={(e) => handleControlChange(key, Number.parseInt(e.target.value, 10))}
            />
            <span>{controls[key]}</span>
          </div>
        ))}
      </div>

      {versions.length > 0 && (
        <div className="version-history">
          <h2>Version History</h2>
          <div className="versions-list">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`version-item ${version.id === activeVersionId ? "active" : ""}`}
              >
                <div className="version-info">
                  <span className="version-name">{version.name}</span>
                  <span className="version-date">
                    {new Date(version.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="version-actions">
                  {version.id !== activeVersionId && (
                    <button
                      type="button"
                      className="version-load"
                      onClick={() => handleLoadVersion(version.id)}
                    >
                      Load
                    </button>
                  )}
                  {version.id === activeVersionId && (
                    <span className="version-active-badge">Active</span>
                  )}
                  {version.id !== activeVersionId && (
                    <button
                      type="button"
                      className="version-delete"
                      onClick={() => handleDeleteVersion(version.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
