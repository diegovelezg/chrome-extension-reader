# Progress Checklist

## Setup
- [x] 1. Initialize project with Vite 8 + vite-plugin-web-extension + React 19 + TypeScript 6
- [x] 2. Configure Tailwind CSS 4 + Shadcn/ui (Base UI)
- [x] 3. Create Manifest V3 with required permissions (`sidePanel`, `activeTab`, `storage`, `scripting`, `webNavigation`, `tabs`)

## Core — Content Extraction
- [x] 4. Install and configure `@mozilla/readability`
- [x] 5. Create content script — extract page content automatically (Readability + shadow DOM flattening + `innerText` fallback)
- [x] 6. Create content script — detect user text selection (mouseup listener, min 10 chars)
- [x] 7. Content script — `isProbablyReaderable()` polling gate (300ms interval, 5s timeout) for SPA compatibility
- [x] 8. Dynamic content script injection via `chrome.scripting.executeScript` when not yet loaded

## Core — Background Service Worker
- [x] 9. Side panel enable/disable per tab (HTTP/HTTPS only)
- [x] 10. `openPanelOnActionClick` behavior

## Core — Side Panel UI
- [x] 11. Side Panel HTML entry point + React mount
- [x] 12. Base layout with Shadcn/ui (header, content area, mode selector)
- [x] 13. `ModeSelector` component — 3 buttons: Executive | Distilled | Original

## Core — LLM Integration
- [x] 14. `llm-client.ts` — OpenAI-compatible client with streaming (SSE)
- [x] 15. Prompts configured in Settings (editable via SettingsPanel, defaults in `types/index.ts`)
- [x] 16. `useLLM` hook — manage streaming state, accumulate chunks, abort support
- [x] 17. Mode 1 (Executive) — extract content → send to LLM → render streaming summary + takeaways
- [x] 18. Mode 2 (Distilled) — extract content → send to LLM → render streaming distilled summary
- [x] 19. Mode 3 (Original) — display raw extracted content (no LLM call)
- [x] 20. Default behavior — Mode 3 (Original) on load, auto-processes with active mode

## Core — Text Selection
- [x] 21. Auto-detect text selection in content script → send to side panel via `SELECTION_DETECTED` message
- [x] 22. Side panel receives selected text → processes with active mode's LLM prompt

## Core — TTS
- [x] 23. `tts-client.ts` — POST `/v1/audio/speech` OpenAI-compatible client
- [x] 24. `useTTS` hook — manage audio playback state, Object URL caching, browser fallback
- [x] 25. `TTSControls` component — play/pause/stop + speed control (0.5x–2.0x cycle)
- [x] 26. Browser `SpeechSynthesisUtterance` fallback when TTS API unavailable or errors
- [x] 27. TTS available in all 3 modes (reads current visible content)
- [x] 28. 30s loading timeout with automatic fallback to browser TTS

## Core — Tab Management
- [x] 29. Per-tab state caching (`cacheRef` Map) — preserves content across tab switches
- [x] 30. LLM result caching per content hash + mode + prompt
- [x] 31. Automatic re-extraction on navigation (`webNavigation.onCompleted`)
- [x] 32. `sidePanel.onOpened` handler — resume tab state when panel reopens
- [x] 33. Content deduplication via `normalizeContent()` comparison

## UI Features
- [x] 34. Rich text copy (HTML + plain text to clipboard)
- [x] 35. Font size controls (12–24px, +/- buttons)
- [x] 36. Line height controls (1.0–2.5, +/- buttons)
- [x] 37. Regenerate button on error (re-runs LLM with `force=true`)
- [x] 38. Extraction loading spinner with error state + retry
- [x] 39. Dark mode — follows `prefers-color-scheme` media query

## Settings
- [x] 40. Settings UI — LLM endpoint URL + API key + model name
- [x] 41. Settings UI — TTS endpoint URL + API key + voice ID
- [x] 42. Settings UI — Editable prompt textareas for Mode 1 and Mode 2 (with `{{content}}` validation)
- [x] 43. Field validation (URL format, required fields, `{{content}}` placeholder check)
- [x] 44. Persist non-sensitive settings to `chrome.storage.sync`
- [x] 45. Persist API keys to `chrome.storage.local` (not synced)
- [x] 46. Reset to defaults button

## Final
- [ ] 47. Test with local Ollama (LLM streaming)
- [ ] 48. Test with local Supertonic (TTS)
- [ ] 49. Manual QA — full flow across multiple websites

## Notes
- Steps 1-46 code complete, build passes (`tsc -b && vite build` clean)
- Content script extracts via @mozilla/readability with shadow DOM flattening and `innerText` fallback
- Side panel requests extraction on mount via `REQUEST_EXTRACTION` message with dynamic script injection fallback
- All 3 modes wire through: content extraction → LLM streaming → render
- TTS client hits `/v1/audio/speech` with browser SpeechSynthesis fallback; play/pause/stop/speed all wired
- Settings persisted split: `chrome.storage.sync` (non-sensitive) + `chrome.storage.local` (API keys)
- Per-tab caching with automatic re-extraction on navigation events
