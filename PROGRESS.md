# Progress Checklist

## Setup
- [ ] 1. Initialize project with Vite + CRXJS + React + TypeScript
- [ ] 2. Configure Tailwind CSS + Shadcn/ui
- [ ] 3. Create Manifest V3 with required permissions (`sidePanel`, `activeTab`, `storage`, `scripting`)

## Core — Content Extraction
- [ ] 4. Install and configure `@mozilla/readability`
- [ ] 5. Create content script — extract page content automatically
- [ ] 6. Create content script — detect user text selection
- [ ] 7. Create background service worker — message orchestration between content script ↔ side panel

## Core — Side Panel UI
- [ ] 8. Side Panel HTML entry point + React mount
- [ ] 9. Base layout with Shadcn/ui (header, content area, mode selector)
- [ ] 10. `ModeSelector` component — 3 buttons: Executive Summary | Distilled | Original

## Core — LLM Integration
- [ ] 11. `llm-client.ts` — OpenAI-compatible client with streaming (SSE)
- [ ] 12. `prompts.ts` — Default prompts for Mode 1 (Executive Summary + Takeaways) and Mode 2 (Distilled)
- [ ] 13. `useLLM` hook — manage streaming state, accumulate chunks
- [ ] 14. Mode 1 — extract content → send to LLM → render streaming Executive Summary + Takeaways
- [ ] 15. Mode 2 — extract content → send to LLM → render streaming Distilled Summary
- [ ] 16. Mode 3 — display raw extracted content (no LLM call)
- [ ] 17. Default behavior — Mode 1 triggers automatically on page load

## Core — Text Selection
- [ ] 18. Auto-detect text selection in content script → send to side panel
- [ ] 19. Side panel receives selected text → processes with active mode's LLM prompt

## Core — TTS
- [ ] 20. `tts-client.ts` — POST `/v1/audio/speech` OpenAI-compatible client
- [ ] 21. `useTTS` hook — manage audio playback state
- [ ] 22. `TTSControls` component — play/pause/stop + speed control + progress bar
- [ ] 23. TTS available in all 3 modes (reads current visible content)

## Settings
- [ ] 24. Settings UI — LLM endpoint URL + API key + model name
- [ ] 25. Settings UI — TTS endpoint URL + voice ID
- [ ] 26. Settings UI — Editable prompt textareas for Mode 1 and Mode 2
- [ ] 27. Persist settings to `chrome.storage.sync`

## Final
- [ ] 28. Test with local Ollama (LLM streaming)
- [ ] 29. Test with local Supertonic (TTS)
- [ ] 30. Manual QA — full flow across multiple websites
