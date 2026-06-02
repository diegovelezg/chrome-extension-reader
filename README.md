# Cognitive Offload: Reader

Reading long-form web content can be overwhelming — especially for people with ADHD, dyslexia, or other neurodivergent profiles. **Cognitive Offload: Reader** is a Chrome side panel extension designed to reduce that barrier. It extracts the core content of any webpage, summarizes it into digestible formats through a configurable LLM, and lets you listen instead of read via text-to-speech. Less noise, less effort, more access.

Built on the same `@mozilla/readability` engine that powers Chrome's native Reading Mode.

## Features

- **Smart content extraction** — uses `@mozilla/readability` with `isProbablyReaderable()` as a content-readiness gate, waiting for real content to appear before extracting (SPA-friendly)
- **Text selection** — select any text on the page and it's automatically sent to the side panel for processing
- **Three viewing modes**:
  - **Executive** — structured summary with key takeaways
  - **Distilled** — compact, essential-only version
  - **Original** — raw extracted content
- **Streaming LLM** — OpenAI-compatible API (`/v1/chat/completions`) with real-time streaming
- **Text-to-Speech** — OpenAI-compatible endpoint (`/v1/audio/speech`) with play/pause/resume, speed control, and progress tracking
- **Fully configurable** — LLM endpoint, TTS endpoint, model, voice, prompts, font size, and line height
- **Editable prompts** — customize the prompt templates for Executive and Distilled modes
- **Dark mode** — follows system preference automatically
- **Tab-aware** — maintains separate state per browser tab, including TTS playback position

## Tech Stack

- React 19 + TypeScript
- Vite + [vite-plugin-web-extension](https://github.com/nicedoc/vite-plugin-web-extension)
- [Base UI](https://base-ui.com/) + [Shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS 4
- [@mozilla/readability](https://github.com/mozilla/readability) for content extraction
- Chrome Manifest V3

## Architecture

```
src/
├── sidepanel/              # Side panel UI (React app)
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # React entry point
│   ├── index.css           # Tailwind theme + variables
│   └── sidepanel.html      # HTML shell
├── components/
│   ├── Markdown.tsx        # Lightweight markdown renderer
│   ├── ModeSelector.tsx    # Executive / Distilled / Original tabs
│   ├── TTSControls.tsx     # Play/pause/resume + speed + progress
│   ├── SettingsPanel.tsx   # LLM, TTS, and prompt configuration
│   └── ui/                 # Shadcn/ui primitives (Base UI)
├── content/
│   └── content.ts          # Content script: extraction + selection detection
├── background/
│   └── background.ts       # Service worker (port keepalive)
├── lib/
│   ├── llm-client.ts       # OpenAI-compatible streaming client
│   ├── tts-client.ts       # OpenAI-compatible TTS client
│   ├── useLLM.ts           # LLM streaming state hook
│   ├── useTTS.ts           # TTS playback state hook
│   └── utils.ts            # cn(), isSupportedUrl()
└── types/
    └── index.ts            # Settings, Mode, ExtractedContent, defaults
```

## How It Works

### Content Extraction (Chrome Reader Mode approach)

The content script mirrors Chrome's native Reading Mode strategy:

1. Wait for `document.readyState === "complete"` (equivalent to Blink's `kFinishedLoading`)
2. Poll `isProbablyReaderable()` every second until the DOM contains real article content
3. Extract via `@mozilla/readability` with CSS selector fallbacks
4. Send result to the side panel

This avoids extracting empty shell content on SPAs like X.com where the initial load contains no article text.

### LLM Processing

- Prompts are configurable templates with `{{content}}` placeholders (stored in `chrome.storage.sync`)
- Results are cached per content hash + mode, so switching tabs or modes doesn't re-query
- Streaming responses render in real-time via SSE parsing

### TTS

- Uses `HTMLAudioElement` for API-synthesized audio, with `SpeechSynthesisUtterance` as browser fallback
- Audio is cached per tab with Object URLs (properly revoked on cleanup)
- Playback state (position, progress) is preserved when switching tabs

## API Formats

| Service | Endpoint | Format |
|---------|----------|--------|
| LLM | `POST /v1/chat/completions` | OpenAI-compatible, streaming SSE |
| TTS | `POST /v1/audio/speech` | OpenAI-compatible, returns audio |

Compatible backends: [Ollama](https://ollama.com/), [LM Studio](https://lmstudio.ai/), [Supertonic](https://github.com/supertone-inc/supertonic), OpenAI, or any OpenAI-compatible API.

## Settings

All settings are stored in `chrome.storage.sync` and persist across sessions.

- **LLM**: endpoint URL, API key (optional), model name
- **TTS**: endpoint URL, voice ID
- **Display**: font size (12–24px), line height (1.0–2.5)
- **Prompts**: editable templates for Executive and Distilled modes

## Development

```bash
npm install
npm run dev     # dev server with hot reload
npm run build   # production build to dist/
```

Load the extension in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## License

MIT
