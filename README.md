# Cognitive Offload: Reader

Reading long-form web content can be overwhelming — especially for people with ADHD, dyslexia, or other neurodivergent profiles. **Cognitive Offload: Reader** is a Chrome side panel extension designed to reduce that barrier. It extracts the core content of any webpage, summarizes it into digestible formats through a configurable LLM, and lets you listen instead of read via text-to-speech. Less noise, less effort, more access.

Built on the same `@mozilla/readability` engine that powers Chrome's native Reading Mode.

## Features

- **Smart content extraction** — uses `@mozilla/readability` with `isProbablyReaderable()` as a content-readiness gate, waiting for real content to appear before extracting (SPA-friendly). Shadow DOM flattening for modern web apps. CSS selector fallback when Readability can't parse.
- **Text selection** — select any text on the page and it's automatically sent to the side panel for processing
- **Three viewing modes**:
  - **Executive** — structured summary with key takeaways
  - **Distilled** — compact, essential-only version
  - **Original** — raw extracted content (no LLM call)
- **Streaming LLM** — OpenAI-compatible API (`/v1/chat/completions`) with real-time SSE streaming
- **Text-to-Speech** — OpenAI-compatible endpoint (`/v1/audio/speech`) with play/pause/resume, speed control (0.5x–2.0x), and browser `SpeechSynthesis` fallback when API unavailable
- **Rich text copy** — copies content as both HTML and plain text to clipboard
- **Font & line height controls** — adjustable font size (12–24px) and line height (1.0–2.5)
- **Fully configurable** — LLM endpoint, TTS endpoint, API keys, model, voice, editable prompts
- **Dark mode** — follows system preference automatically
- **Tab-aware** — maintains separate state per browser tab with LLM result caching. Automatic re-extraction on navigation.

## Tech Stack

- React 19 + TypeScript
- Vite 8 + [vite-plugin-web-extension](https://github.com/nicedoc/vite-plugin-web-extension)
- [Base UI](https://base-ui.com/) + [Shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS 4
- [@mozilla/readability](https://github.com/mozilla/readability) for content extraction
- Chrome Manifest V3 (sidePanel API)

## Architecture

```
src/
├── sidepanel/
│   ├── App.tsx             # Main app — tab state, extraction orchestration, UI layout
│   ├── main.tsx            # React entry point
│   ├── index.css           # Tailwind theme + CSS variables
│   └── sidepanel.html      # HTML shell
├── components/
│   ├── Markdown.tsx        # Lightweight markdown renderer (headings, lists, tables, code)
│   ├── ModeSelector.tsx    # Executive / Distilled / Original tabs
│   ├── TTSControls.tsx     # Play/pause/resume/stop + speed control
│   ├── SettingsPanel.tsx   # LLM, TTS, and prompt configuration with validation
│   └── ui/                 # Shadcn/ui primitives (Base UI)
├── content/
│   └── content.ts          # Content script: Readability extraction + selection detection
├── background/
│   └── background.ts       # Service worker — sidePanel enable/disable per tab
├── lib/
│   ├── llm-client.ts       # OpenAI-compatible streaming SSE client
│   ├── tts-client.ts       # OpenAI-compatible TTS client (audio/speech)
│   ├── useLLM.ts           # LLM streaming state hook (abort, cache, accumulation)
│   ├── useTTS.ts           # TTS playback hook (API + browser fallback, caching)
│   └── utils.ts            # cn(), isSupportedUrl()
└── types/
    └── index.ts            # Settings, Mode, ExtractedContent types + defaults
```

## How It Works

### Content Extraction (Chrome Reader Mode approach)

The content script mirrors Chrome's native Reading Mode strategy:

1. Wait for `document.readyState === "complete"` (equivalent to Blink's `kFinishedLoading`)
2. Poll `isProbablyReaderable()` every 300ms until the DOM contains real article content (5s timeout)
3. Flatten shadow DOM roots (for modern web frameworks)
4. Extract via `@mozilla/readability` with `innerText` fallback when content < 500 chars
5. Send result to the side panel

If the content script isn't injected yet, the side panel dynamically injects it via `chrome.scripting.executeScript` and retries.

### LLM Processing

- Prompts are configurable templates with `{{content}}` placeholders (stored in `chrome.storage.sync`)
- Results are cached per content hash + mode + prompt, so switching tabs or modes doesn't re-query
- Streaming responses render in real-time via SSE parsing
- Supports aborting in-progress streams

### TTS

- Primary: `HTMLAudioElement` with API-synthesized audio from OpenAI-compatible `/v1/audio/speech`
- Fallback: `SpeechSynthesisUtterance` browser API when TTS endpoint is unavailable
- Audio is cached per tab with Object URLs (properly revoked on cleanup)
- Speed control cycles through 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 1.75x, 2.0x

### Settings Storage

- Non-sensitive settings (endpoints, model, voice, prompts, display prefs) → `chrome.storage.sync`
- API keys → `chrome.storage.local` (not synced across devices)

## API Formats

| Service | Endpoint | Format |
|---------|----------|--------|
| LLM | `POST /v1/chat/completions` | OpenAI-compatible, streaming SSE |
| TTS | `POST /v1/audio/speech` | OpenAI-compatible, returns audio |

Compatible backends: [Ollama](https://ollama.com/), [LM Studio](https://lmstudio.ai/), [Supertonic](https://github.com/supertone-inc/supertonic), OpenAI, or any OpenAI-compatible API. Defaults target Ollama (`localhost:11434`) and Supertonic (`localhost:8020`).

## Settings

All settings are stored in `chrome.storage.sync` (non-sensitive) and `chrome.storage.local` (API keys) and persist across sessions.

- **LLM**: endpoint URL, API key, model name
- **TTS**: endpoint URL, API key, voice ID
- **Display**: font size (12–24px), line height (1.0–2.5)
- **Prompts**: editable templates for Executive and Distilled modes (must include `{{content}}`)

## Development

```bash
npm install
npm run dev     # dev server with hot reload
npm run build   # production build to dist/
```

Load the extension in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## License

MIT
