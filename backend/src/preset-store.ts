import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface Preset {
  id: string;
  name: string;
  systemMessage: string;
  tone: string;
  context: string;
  createdAt: string;
}

export interface PresetRequest {
  name: string;
  systemMessage: string;
  tone: string;
  context: string;
}

const DATA_DIR = process.env["DATA_DIR"] ?? path.join(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "presets.json");

function ensureDataDir(): void {
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });
}

function readPresetsFromDisk(): Preset[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
    return [];
  }
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw) as Preset[];
}

function writePresetsToDisk(presets: Preset[]): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(presets, null, 2), "utf8");
}

export function loadPresets(): Preset[] {
  return readPresetsFromDisk();
}

export function savePreset(request: PresetRequest): Preset {
  const presets = readPresetsFromDisk();
  const newPreset: Preset = {
    id: "preset_" + crypto.randomUUID(),
    name: request.name,
    systemMessage: request.systemMessage,
    tone: request.tone,
    context: request.context,
    createdAt: new Date().toISOString(),
  };
  presets.push(newPreset);
  writePresetsToDisk(presets);
  return newPreset;
}

export function updatePreset(id: string, request: PresetRequest): Preset | undefined {
  const presets = readPresetsFromDisk();
  const index = presets.findIndex((p) => p.id === id);
  if (index === -1) {
    return undefined;
  }
  const existing = presets[index];
  if (!existing) {
    return undefined;
  }
  const updated: Preset = {
    ...existing,
    name: request.name,
    systemMessage: request.systemMessage,
    tone: request.tone,
    context: request.context,
  };
  presets[index] = updated;
  writePresetsToDisk(presets);
  return updated;
}

export function deletePreset(id: string): boolean {
  const presets = readPresetsFromDisk();
  const index = presets.findIndex((p) => p.id === id);
  if (index === -1) {
    return false;
  }
  presets.splice(index, 1);
  writePresetsToDisk(presets);
  return true;
}

export function getPresets(): Preset[] {
  return readPresetsFromDisk();
}
