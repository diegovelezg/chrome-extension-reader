# Progress Checklist

## Setup
- [x] 1. Initialize project with Vite + vite-plugin-web-extension + React + TypeScript
- [x] 2. Configure Tailwind CSS + Shadcn/ui
- [x] 3. Create Manifest V3 with required permissions (`sidePanel`, `activeTab`, `storage`, `scripting`)

## Core — Content Extraction
- [x] 4. Install and configure `@mozilla/readability`
- [x] 5. Create content script — extract page content automatically
- [x] 6. Create content script — detect user text selection
- [x] 7. Create background service worker — message orchestration between content script ↔ side panel

## Core — Side Panel UI
- [x] 8. Side Panel HTML entry point + React mount
- [x] 9. Base layout with Shadcn/ui (header, content area, mode selector)
- [x] 10. `ModeSelector` component — 3 buttons: Executive Summary | Distilled | Original

## Core — LLM Integration
- [x] 11. `llm-client.ts` — OpenAI-compatible client with streaming (SSE)
- [x] 12. Prompts configured in `Settings` (editable via SettingsPanel, defaults in `types/index.ts`)
- [x] 13. `useLLM` hook — manage streaming state, accumulate chunks
- [x] 14. Mode 1 — extract content → send to LLM → render streaming Executive Summary + Takeaways
- [x] 15. Mode 2 — extract content → send to LLM → render streaming Distilled Summary
- [x] 16. Mode 3 — display raw extracted content (no LLM call)
- [x] 17. Default behavior — Mode 1 triggers automatically on page load

## Core — Text Selection
- [x] 18. Auto-detect text selection in content script → send to side panel
- [x] 19. Side panel receives selected text → processes with active mode's LLM prompt

## Core — TTS
- [x] 20. `tts-client.ts` — POST `/v1/audio/speech` OpenAI-compatible client
- [x] 21. `useTTS` hook — manage audio playback state
- [x] 22. `TTSControls` component — play/pause/stop + speed control + progress bar
- [x] 23. TTS available in all 3 modes (reads current visible content)

## Settings
- [x] 24. Settings UI — LLM endpoint URL + API key + model name
- [x] 25. Settings UI — TTS endpoint URL + voice ID
- [x] 26. Settings UI — Editable prompt textareas for Mode 1 and Mode 2
- [x] 27. Persist settings to `chrome.storage.sync`

## Final
- [ ] 28. Test with local Ollama (LLM streaming)
- [ ] 29. Test with local Supertonic (TTS)
- [ ] 30. Manual QA — full flow across multiple websites

## Notes
- Steps 1-27 code complete, build passes (`tsc -b && vite build` clean)
- Fixed critical bugs: Readability import, background listener consolidation, manifest icon paths
- Content script extracts via @mozilla/readability with DOM selector fallback
- Side panel requests extraction on mount via REQUEST_EXTRACTION message
- All 3 modes wire through: content extraction → LLM streaming → render
- TTS client hits `/v1/audio/speech`, play/pause/stop/speed/progress all wired
- Settings persisted to `chrome.storage.sync` with reset-to-defaults
