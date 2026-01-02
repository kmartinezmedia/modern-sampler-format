/**
 * MSF Refinement UI - Unified Bun Server
 *
 * Handles static files, API routes, WebSocket, MIDI input, and version history.
 */

import { Database } from "bun:sqlite";
import { MSFRuntime, renderToWAVBuffer } from "@msf/runtime";
import {
  compile,
  extractInventoryFromMSF,
  extractIntentFromMSF,
} from "@msf/compiler";
import type { MSFInstrument } from "@msf/core";
import uprightPianoMSF from "@msf/examples/upright-piano";
import { join, dirname } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import midi from "@julusian/midi";

// Play audio on server using macOS afplay
function playAudioOnServer(wavBuffer: Uint8Array) {
  const tempFile = join(tmpdir(), `msf-${Date.now()}.wav`);
  try {
    writeFileSync(tempFile, wavBuffer);
    console.log(`  Wrote ${wavBuffer.byteLength} bytes to ${tempFile}`);
  } catch (err) {
    console.error(`  Failed to write temp file:`, err);
    return;
  }

  const player = spawn("afplay", [tempFile]);

  player.on("error", (err) => {
    console.error(`  afplay error:`, err);
  });

  player.stderr?.on("data", (data) => {
    console.error(`  afplay stderr:`, data.toString());
  });

  player.on("close", (code) => {
    console.log(`  afplay exited with code ${code}`);
    try { unlinkSync(tempFile); } catch {}
  });
}

import { tmpdir } from "node:os";

// Get paths
const srcDir = dirname(import.meta.path);
const appDir = join(srcDir, "..");
const monorepoRoot = join(appDir, "..", "..");
const samplesBasePath = join(monorepoRoot, "packages", "msf-examples", "dist", "upright-piano");
const dbPath = join(appDir, "instruments.db");

// --- Database Setup ---

const db = new Database(dbPath);

db.run(`
  CREATE TABLE IF NOT EXISTS instrument_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    controls TEXT NOT NULL,
    instrument TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    is_active INTEGER DEFAULT 0
  )
`);

// Ensure we have at least one version (the base instrument)
const count = db.query("SELECT COUNT(*) as count FROM instrument_versions").get() as { count: number };
if (count.count === 0) {
  const baseControls = { attack: 0.5, brightness: 0.5, room: 0.5, release: 0.5, warmth: 0.5, presence: 0.5 };
  const inventory = extractInventoryFromMSF(uprightPianoMSF);
  const intent = extractIntentFromMSF(uprightPianoMSF, baseControls);
  const { instrument } = await compile(intent, inventory, { strict: false });

  db.run(
    "INSERT INTO instrument_versions (name, controls, instrument, is_active) VALUES (?, ?, ?, 1)",
    ["Base", JSON.stringify(baseControls), JSON.stringify(instrument)]
  );
}

// --- Types ---

interface InstrumentVersion {
  id: number;
  name: string;
  controls: string;
  instrument: string;
  created_at: string;
  is_active: number;
}

// --- Global Server Runtime ---
// This runtime is used for ALL audio playback (MIDI and UI)
let serverRuntime: MSFRuntime | null = null;
let currentInstrument: MSFInstrument | null = null;

async function initServerRuntime() {
  // Load active instrument from database
  const active = db.query(
    "SELECT instrument FROM instrument_versions WHERE is_active = 1"
  ).get() as { instrument: string } | null;

  if (active) {
    currentInstrument = JSON.parse(active.instrument);
    serverRuntime = new MSFRuntime(currentInstrument!, 44100, samplesBasePath);
    console.log("🎹 Server runtime initialized with active instrument");
  }
}

function updateServerRuntime(instrument: MSFInstrument) {
  currentInstrument = instrument;
  serverRuntime = new MSFRuntime(instrument, 44100, samplesBasePath);
  console.log("🎹 Server runtime updated");
}

// Initialize on startup
await initServerRuntime();

// --- Build Frontend ---

const buildResult = await Bun.build({
  entrypoints: [join(srcDir, "app.tsx")],
  naming: "[name].js",
  minify: false,
});

if (!buildResult.success) {
  console.error("Build failed:", buildResult.logs);
  process.exit(1);
}

const appJs = await buildResult.outputs[0].text();

// --- API Handlers ---

// MIDI status for UI
let midiStatus: { connected: boolean; deviceName: string | null } = {
  connected: false,
  deviceName: null,
};

function handleMidiStatus(): Response {
  return Response.json(midiStatus);
}

function handleVersions(): Response {
  const versions = db.query(
    "SELECT id, name, controls, created_at, is_active FROM instrument_versions ORDER BY created_at DESC"
  ).all() as InstrumentVersion[];

  return Response.json({
    versions: versions.map(v => ({
      id: v.id,
      name: v.name,
      controls: JSON.parse(v.controls),
      createdAt: v.created_at,
      isActive: v.is_active === 1,
    })),
  });
}

function handleLoadVersion(body: { id: number }): Response {
  const version = db.query(
    "SELECT * FROM instrument_versions WHERE id = ?"
  ).get(body.id) as InstrumentVersion | null;

  if (!version) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  // Set this version as active
  db.run("UPDATE instrument_versions SET is_active = 0");
  db.run("UPDATE instrument_versions SET is_active = 1 WHERE id = ?", [body.id]);

  // Update server runtime
  const instrument = JSON.parse(version.instrument);
  updateServerRuntime(instrument);

  return Response.json({
    success: true,
    instrument,
    controls: JSON.parse(version.controls),
  });
}

function handleDeleteVersion(body: { id: number }): Response {
  const version = db.query(
    "SELECT is_active FROM instrument_versions WHERE id = ?"
  ).get(body.id) as { is_active: number } | null;

  if (!version) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  // Don't allow deleting the active version
  if (version.is_active === 1) {
    return Response.json({ error: "Cannot delete active version" }, { status: 400 });
  }

  db.run("DELETE FROM instrument_versions WHERE id = ?", [body.id]);

  return Response.json({ success: true });
}

async function handleRecompile(body: any): Promise<Response> {
  const { controls, name } = body;

  if (!controls) {
    return Response.json({ success: false, error: "controls required" }, { status: 400 });
  }

  // Use the base instrument (now has .wav paths from build)
  const inventory = extractInventoryFromMSF(uprightPianoMSF);
  const intent = extractIntentFromMSF(uprightPianoMSF, controls);
  const { instrument, report } = await compile(intent, inventory, { strict: false });

  // Update server runtime
  updateServerRuntime(instrument);

  // Save to database
  db.run("UPDATE instrument_versions SET is_active = 0");
  const versionName = name || `Version ${new Date().toLocaleString()}`;
  db.run(
    "INSERT INTO instrument_versions (name, controls, instrument, is_active) VALUES (?, ?, ?, 1)",
    [versionName, JSON.stringify(controls), JSON.stringify(instrument)]
  );

  const newVersion = db.query(
    "SELECT id, created_at FROM instrument_versions WHERE is_active = 1"
  ).get() as { id: number; created_at: string };

  return Response.json({
    success: true,
    instrument,
    report,
    version: {
      id: newVersion.id,
      name: versionName,
      createdAt: newVersion.created_at,
    },
  });
}

// Play a note on server (for UI keyboard)
async function handlePlayNote(body: any): Promise<Response> {
  const { note, velocity = 100 } = body;

  if (!serverRuntime) {
    return Response.json({ error: "No instrument loaded" }, { status: 400 });
  }

  try {
    await serverRuntime.noteOn(note, velocity);
    const wavBuffer = await renderToWAVBuffer(serverRuntime, 2.0, 44100);
    // Play on server - don't wait for it
    playAudioOnServer(wavBuffer);
    return Response.json({ success: true, note, velocity });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

async function handleAudio(body: any): Promise<Response> {
  const { instrument, testNote = 60, testVelocity = 100, duration = 2.0 } = body;

  if (!instrument) {
    return Response.json({ error: "Instrument required" }, { status: 400 });
  }

  const runtime = new MSFRuntime(instrument as MSFInstrument, 44100, samplesBasePath);
  await runtime.noteOn(testNote, testVelocity);

  const wavBuffer = await renderToWAVBuffer(runtime, duration, 44100);
  const base64 = Buffer.from(wavBuffer).toString("base64");

  return Response.json({
    success: true,
    audioUrl: `data:audio/wav;base64,${base64}`,
    duration,
    testNote,
    testVelocity,
  });
}

// --- Server ---

interface WebSocketData {
  runtime?: MSFRuntime;
}

// Track connected WebSocket clients for MIDI broadcast
const connectedClients = new Set<any>();

const server = Bun.serve<WebSocketData>({
  port: 3000,

  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      if (server.upgrade(req, { data: {} })) return undefined;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // API routes
    if (url.pathname.startsWith("/api/")) {
      try {
        // GET endpoints
        if (req.method === "GET") {
          if (url.pathname === "/api/versions") {
            return handleVersions();
          }
          if (url.pathname === "/api/midi") {
            return handleMidiStatus();
          }
        }

        // POST endpoints
        if (req.method === "POST") {
          const body = await req.json();

          if (url.pathname === "/api/recompile") {
            return handleRecompile(body);
          }
          if (url.pathname === "/api/audio") {
            return handleAudio(body);
          }
          if (url.pathname === "/api/versions/load") {
            return handleLoadVersion(body);
          }
          if (url.pathname === "/api/versions/delete") {
            return handleDeleteVersion(body);
          }
          if (url.pathname === "/api/play") {
            return handlePlayNote(body);
          }
        }

        return new Response("Not found", { status: 404 });
      } catch (error) {
        console.error("API error:", error);
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    }

    // Static files - serve directly from src
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file(join(srcDir, "index.html")), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/app.js") {
      return new Response(appJs, {
        headers: { "Content-Type": "application/javascript" },
      });
    }

    if (url.pathname === "/styles.css") {
      return new Response(Bun.file(join(srcDir, "styles.css")), {
        headers: { "Content-Type": "text/css" },
      });
    }

    // Fallback to index.html for SPA
    return new Response(Bun.file(join(srcDir, "index.html")), {
      headers: { "Content-Type": "text/html" },
    });
  },

  websocket: {
    async message(ws, message) {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "setInstrument") {
          ws.data.runtime = new MSFRuntime(data.instrument, 44100, samplesBasePath);
          ws.send(JSON.stringify({ type: "instrumentReady", success: true }));
        }

        if (data.type === "noteOn" && ws.data.runtime) {
          const { note, velocity = 100, duration = 2.0 } = data;
          await ws.data.runtime.noteOn(note, velocity);

          const wavBuffer = await renderToWAVBuffer(ws.data.runtime, duration, 44100);
          const base64 = Buffer.from(wavBuffer).toString("base64");

          ws.send(JSON.stringify({
            type: "audio",
            audioUrl: `data:audio/wav;base64,${base64}`,
            note,
            velocity,
          }));
        }

        if (data.type === "noteOff" && ws.data.runtime) {
          ws.data.runtime.noteOff(data.note);
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        ws.send(JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      }
    },

    open(ws) {
      console.log("WebSocket connected");
      connectedClients.add(ws);
    },

    close(ws) {
      console.log("WebSocket disconnected");
      connectedClients.delete(ws);
    },
  },
});

console.log(`🎹 MSF Refinement UI running at http://localhost:${server.port}`);
console.log(`📁 Database: ${dbPath}`);

// --- MIDI Setup ---

// Create a handler for MIDI messages
async function handleMidiMessage(portName: string, message: number[]) {
  const [status, note, velocity] = message;
  const command = status >> 4;

  // Note On (command 9) with velocity > 0
  if (command === 9 && velocity > 0) {
    console.log(`🎹 [${portName}] Note On: ${note} vel=${velocity}`);

    if (serverRuntime) {
      try {
        // Reset before adding new note to avoid voice accumulation
        serverRuntime.reset();
        await serverRuntime.noteOn(note, velocity);
        const wavBuffer = await renderToWAVBuffer(serverRuntime, 2.0, 44100);
        console.log(`  Playing (${wavBuffer.byteLength} bytes)...`);
        playAudioOnServer(wavBuffer);
      } catch (err) {
        console.error("MIDI playback error:", err);
      }
    } else {
      console.log("  No server runtime!");
    }
  }
  // Note Off (command 8) or Note On with velocity 0
  else if (command === 8 || (command === 9 && velocity === 0)) {
    console.log(`🎹 [${portName}] Note Off: ${note}`);
    for (const ws of connectedClients) {
      if (ws.data.runtime) {
        ws.data.runtime.noteOff(note);
      }
    }
  }
}

// Open ALL MIDI input ports to catch notes from any source
const midiInputs: midi.Input[] = [];
const tempInput = new midi.Input();
const portCount = tempInput.getPortCount();

console.log(`🎹 Found ${portCount} MIDI input port(s)`);

const connectedPorts: string[] = [];

for (let i = 0; i < portCount; i++) {
  const portName = tempInput.getPortName(i);
  console.log(`🎹 MIDI input port ${i}: "${portName}"`);

  // Skip Through ports (virtual loopback)
  if (portName.includes("Through")) continue;

  try {
    const input = new midi.Input();
    input.openPort(i);
    // Ignore clock/timing but accept notes and sysex
    input.ignoreTypes(false, true, true);

    input.on("message", async (_deltaTime, message) => {
      await handleMidiMessage(portName, message);
    });

    midiInputs.push(input);
    connectedPorts.push(portName);
    console.log(`🎹 Listening on: ${portName}`);
  } catch (err) {
    console.error(`🎹 Failed to open port ${i}: ${err}`);
  }
}

tempInput.closePort();

if (connectedPorts.length > 0) {
  midiStatus = { connected: true, deviceName: connectedPorts.join(", ") };
} else {
  console.log("⚠️ No MIDI input devices found");
}
