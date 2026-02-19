import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { encryptApiKey, decryptApiKey } from "./crypto";

interface StoredKey {
  id: string;
  provider: string;
  label: string;
  hint: string;
  encrypted: string;
  iv: string;
  createdAt: string;
}

export interface KeyReference {
  id: string;
  provider: string;
  label: string;
  hint: string;
  createdAt: string;
}

const DATA_DIR = process.env["DATA_DIR"] ?? path.join(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "api-keys.json");

// In-memory map from provider -> { id, provider, rawKey }
// Stores the most recently added key per provider for quick lookup.
// Keys are indexed by their ID for deletion, and by provider for retrieval.
const decryptedKeys = new Map<string, { id: string; provider: string; rawKey: string; createdAt: string }>();

function ensureDataDir(): void {
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });
}

function readStoredKeys(): StoredKey[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
    return [];
  }
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw) as StoredKey[];
}

function writeStoredKeys(keys: StoredKey[]): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(keys, null, 2), "utf8");
}

export function loadKeys(): void {
  const stored = readStoredKeys();
  decryptedKeys.clear();

  for (const entry of stored) {
    try {
      const rawKey = decryptApiKey(entry.encrypted, entry.iv);
      // Later entries overwrite earlier ones for the same provider,
      // so the most recent key per provider wins.
      decryptedKeys.set(entry.id, {
        id: entry.id,
        provider: entry.provider,
        rawKey,
        createdAt: entry.createdAt,
      });
    } catch {
      console.error(`Failed to decrypt key ${entry.id} for provider ${entry.provider}. Skipping.`);
    }
  }
}

export function saveKey(provider: string, label: string, rawKey: string): KeyReference {
  const id = "key_" + crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const hint = "\u25cf\u25cf\u25cf\u25cf" + rawKey.slice(-4);
  const { encrypted, iv } = encryptApiKey(rawKey);

  const newEntry: StoredKey = {
    id,
    provider,
    label,
    hint,
    encrypted,
    iv,
    createdAt,
  };

  const stored = readStoredKeys();
  stored.push(newEntry);
  writeStoredKeys(stored);

  // Update in-memory map
  decryptedKeys.set(id, { id, provider, rawKey, createdAt });

  return { id, provider, label, hint, createdAt };
}

export function getKeys(): KeyReference[] {
  const stored = readStoredKeys();
  return stored.map(({ id, provider, label, hint, createdAt }) => ({
    id,
    provider,
    label,
    hint,
    createdAt,
  }));
}

export function deleteKey(id: string): boolean {
  const stored = readStoredKeys();
  const index = stored.findIndex((k) => k.id === id);
  if (index === -1) {
    return false;
  }
  stored.splice(index, 1);
  writeStoredKeys(stored);
  decryptedKeys.delete(id);
  return true;
}

export function getDecryptedKey(provider: string): string | undefined {
  // Find the most recently added key for this provider
  let latestEntry: { id: string; provider: string; rawKey: string; createdAt: string } | undefined;

  for (const entry of decryptedKeys.values()) {
    if (entry.provider === provider) {
      if (!latestEntry || entry.createdAt > latestEntry.createdAt) {
        latestEntry = entry;
      }
    }
  }

  return latestEntry?.rawKey;
}
