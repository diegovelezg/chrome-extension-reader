# chrome-extension-reader

Chrome extension that extracts webpage content and processes it with configurable LLM and TTS endpoints.

## Features

- **Automatic content extraction** using `@mozilla/readability` (same engine as Chrome's Reading Mode)
- **Manual text selection** — auto-detected and sent to the side panel
- **3 viewing modes**:
  1. **Executive Summary + Takeaways** (default) — full content → LLM
  2. **Distilled Summary** — condensed version via LLM
  3. **Original** — raw extracted content
- **TTS** — OpenAI-compatible endpoint (`/v1/audio/speech`), works with [Supertonic](https://github.com/supertone-inc/supertonic)
- **Streaming LLM responses** via OpenAI-compatible API (`/v1/chat/completions`)
- **Configurable endpoints** — LLM and TTS endpoints are independent and user-configurable
- **Editable prompts** — default prompts for each mode, editable by the user

## Tech Stack

- **React 18 + TypeScript**
- **Vite + CRXJS** (Chrome extension build)
- **Shadcn/ui + Tailwind CSS**
- **Manifest V3**
- **@mozilla/readability** for content extraction

## Architecture

```
src/
├── sidepanel/              # Side Panel UI (React app)
│   ├── App.tsx
│   ├── components/
│   │   ├── ReaderView.tsx
│   │   ├── ModeSelector.tsx
│   │   ├── TTSControls.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   ├── useContent.ts
│   │   ├── useLLM.ts
│   │   └── useTTS.ts
│   └── sidepanel.html
├── content/
│   └── content.ts          # Content script: extraction + selection detection
├── background/
│   └── background.ts       # Service worker: message orchestration
├── lib/
│   ├── extractor.ts        # @mozilla/readability wrapper
│   ├── llm-client.ts       # OpenAI-compatible streaming client
│   ├── tts-client.ts       # OpenAI-compatible TTS client
│   └── prompts.ts          # Default prompts (editable)
└── types/
    └── index.ts
```

## API Formats

- **LLM**: `POST /v1/chat/completions` (OpenAI-compatible, streaming)
- **TTS**: `POST /v1/audio/speech` (OpenAI-compatible, compatible with Supertonic)

## User Flow

1. User opens Side Panel
2. Content script extracts page content via `@mozilla/readability`
3. Automatically sends to LLM → **Mode 1 (Executive Summary + Takeaways)** streams in
4. 3 mode buttons always visible: `Executive Summary` | `Distilled` | `Original`
5. If user selects text on page → auto-appears in side panel → processed by LLM
6. TTS available in any mode with full controls (play/pause/stop, speed, progress bar)

## Settings

- LLM endpoint URL + optional API key + model name
- TTS endpoint URL + voice ID
- Editable prompts for Mode 1 and Mode 2
- Stored in `chrome.storage.sync`

## Development

```bash
npm install
npm run dev
```

Load the extension in Chrome from `dist/` via `chrome://extensions` → Developer mode → Load unpacked.
