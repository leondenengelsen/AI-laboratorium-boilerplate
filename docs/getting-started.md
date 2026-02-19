# Getting Started

## What AI Lab Does

AI Lab Boilerplate is a local tool for testing and comparing AI providers through a single web interface. Pick a provider, type a prompt, and see the response alongside token usage, cost estimates, and latency. Compare outputs from multiple models side by side. API keys are managed through the UI and encrypted on your machine — no config files to edit, no keys in plaintext.

---

## Tech Stack

**Frontend** — Angular 21
- Tailwind CSS 4, daisyUI 5 — styling and UI components
- marked — markdown rendering for AI responses
- RxJS — reactive data flow

**Backend** — Express 4
- Zod — request validation
- Node.js crypto — AES-256-GCM key encryption
- cors — cross-origin handling

**AI Engine** — Standalone TypeScript module
- @anthropic-ai/sdk — Claude provider
- @google/generative-ai — Gemini provider
- openai — OpenAI provider
- @mistralai/mistralai — Mistral provider

All dependencies install automatically via `npm install` in each directory.

---

## Prerequisites

- **Node.js** 18 or later (LTS recommended)
- **npm** 9 or later
- An API key for at least one supported provider

No global Angular CLI install is required. The project uses local tooling via `npx`.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/leondenengelsen/AI-laboratorium-boilerplate.git
cd AI-laboratorium-boilerplate
```

### 2. Install dependencies

The project has three independent `package.json` files (root, engine, backend, frontend). Install all of them:

```bash
npm install
cd engine && npm install && npm run build && cd ..
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

The engine must be built before the backend can use it — `npm run build` in the engine directory handles this.

### 3. Start the application

```bash
npm run dev
```

This starts both the backend (Express on port 3000) and the frontend (Angular dev server on port 4200) concurrently using the root-level dev script.

On **first launch**, the backend automatically generates an `ENCRYPTION_KEY` and saves it to `.env` in the project root. No manual setup is needed.

### 4. Open the app

Go to [http://localhost:4200](http://localhost:4200) in your browser.

---

## Adding Your First API Key

1. Click **Settings** in the top navbar
2. Find the provider you want to use (e.g., Anthropic Claude)
3. Paste your API key into the password field
4. Click **Save**
5. The key is encrypted and stored. You will see a masked hint like `••••a1b2` confirming it was saved

The key is now available for all models from that provider. You can add keys for multiple providers.

### Where to get API keys

| Provider | Console URL |
|---|---|
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com/) |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/) |
| OpenAI | [platform.openai.com](https://platform.openai.com/) |
| Mistral AI | [console.mistral.ai](https://console.mistral.ai/) |

---

## How API Keys Are Encrypted and Stored

Your API keys never leave your machine and are never stored in plaintext.

1. You paste a key into the Settings panel (a password field — the key is never displayed)
2. The frontend sends it to the local backend over localhost
3. The backend encrypts it using **AES-256-GCM** with the `ENCRYPTION_KEY` from `.env`
4. The encrypted blob is saved to `data/api-keys.json`
5. The frontend receives only a masked hint (e.g., `••••a1b2`) — never the raw key
6. When you send a chat request, the backend decrypts the key in memory, passes it to the AI provider, and discards it

**What this means:**

- Raw keys exist only in memory during a request — they are never written to disk in plaintext
- The encrypted file (`data/api-keys.json`) is useless without your `ENCRYPTION_KEY`
- The frontend never sees, stores, or displays the raw key
- If you delete `.env`, stored keys become permanently unreadable — you would need to re-enter them

The `ENCRYPTION_KEY` in `.env` is the only secret on disk. It is auto-generated and listed in `.gitignore` so it is never committed.

---

## Using the App

### Chat mode

1. Select a **provider** from the dropdown (e.g., Anthropic Claude)
2. Select a **model** (e.g., Claude Sonnet 4.6)
3. Optionally configure:
   - **System message** — define the AI's role or behavior
   - **Tone** — set how the AI responds
   - **Context** — paste documentation, reference material, or background information
4. Type your message and press **Send** (or **Cmd+Enter** / **Ctrl+Enter**)
5. See the response with token count, estimated cost, and latency displayed below it

### Compare mode

1. Click **Compare** in the navbar to switch to comparison mode
2. Select multiple provider/model combinations
3. Send the same prompt to all of them simultaneously
4. Review the outputs side by side with their respective metrics

### Presets

You can save your system message, tone, and context configuration as a named **preset** for reuse. This is useful when you frequently test with the same setup across different models.

### Streaming

Toggle **Streaming** in the Settings panel to see tokens as they arrive from the provider in real time, rather than waiting for the full response.

### Pricing reference

Click **Pricing** in the navbar to see a sortable table of all supported models with their per-million-token input and output costs.

---

## Environment Configuration

The backend uses a single `.env` file in the project root. On first launch it is generated automatically with:

```
ENCRYPTION_KEY=<auto-generated 64-character hex string>
PORT=3000
FRONTEND_ORIGIN=http://localhost:4200
```

The only required value is `ENCRYPTION_KEY`, which is created for you.

If you need to regenerate the encryption key manually:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `.env` as the `ENCRYPTION_KEY` value. Note: changing this key makes previously stored API keys unreadable — you would need to re-enter them in Settings.

---

## Common Issues and Troubleshooting

### "Cannot find module" errors on startup

Make sure you built the engine before starting:

```bash
cd engine && npm run build && cd ..
```

The backend imports the compiled engine output. If the engine has not been built, the backend cannot start.

### Port already in use

If port 3000 or 4200 is occupied, either stop the other process or change the ports:

- Backend: set `PORT` in `.env`
- Frontend: update the `start` script in `frontend/package.json` to include `--port <number>`, and update `FRONTEND_ORIGIN` in `.env` to match

### CORS errors in the browser

The backend only allows requests from the origin specified in `FRONTEND_ORIGIN` (default: `http://localhost:4200`). If you changed the frontend port, update this value in `.env` to match.

### API key not working / auth errors

- Verify the key is valid by testing it in the provider's own console or playground
- Make sure you saved the key for the correct provider in Settings
- Check that the key has not expired or been revoked
- Some providers require billing to be set up before API access is enabled

### Stored keys become unreadable

If you deleted or changed `.env`, the `ENCRYPTION_KEY` no longer matches what was used to encrypt your stored keys. The encrypted blobs in `data/api-keys.json` are now permanently unreadable. Delete `data/api-keys.json` and re-enter your keys through the Settings panel. A new encryption key will be generated on the next backend startup.

### Fresh start

To reset everything and start clean:

```bash
rm -f .env data/api-keys.json data/presets.json
```

On the next `npm run dev`, the backend will generate a fresh encryption key, and you can re-enter your API keys through Settings.
