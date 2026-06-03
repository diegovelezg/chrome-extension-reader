import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { Mode, Settings, DEFAULT_SETTINGS, ExtractedContent, CONTENT_SCRIPT_PATH } from "../types";
import { useLLM } from "../lib/useLLM";
import { useTTS } from "../lib/useTTS";
import { BookOpen, CaseUpper, Copy, Loader2, Minus, Plus, RefreshCw, Settings as SettingsIcon, TextSelect } from "lucide-react";
import { ModeSelector } from "../components/ModeSelector";
import { Markdown } from "../components/Markdown";
import { TTSControls } from "../components/TTSControls";
import { SettingsPanel } from "../components/SettingsPanel";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../components/ui/tooltip";

interface TabData {
  original: string;
  title: string;
  selectedText: string;
  executive: string;
  distilled: string;
}

function emptyTab(): TabData {
  return { original: "", title: "", selectedText: "", executive: "", distilled: "" };
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function extractFromTab(tabId: number): Promise<ExtractedContent | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: ExtractedContent | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => done(null), 8000);

    chrome.tabs.sendMessage(tabId, { type: "REQUEST_EXTRACTION" }, (response: unknown) => {
      if (settled) return;
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_PATH] }, () => {
          if (chrome.runtime.lastError) {
            done(null);
            return;
          }
          const fallbackTimer = setTimeout(() => done(null), 8000);
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { type: "REQUEST_EXTRACTION" }, (resp: unknown) => {
              clearTimeout(fallbackTimer);
              if (settled) return;
              const r = resp as { type?: string; data?: unknown } | undefined;
              if (r?.type === "CONTENT_EXTRACTED") {
                done(r.data as ExtractedContent);
              } else {
                done(null);
              }
            });
          }, 300);
        });
        return;
      }
      const r = response as { type?: string; data?: unknown } | undefined;
      if (r?.type === "CONTENT_EXTRACTED") {
        done(r.data as ExtractedContent);
      } else {
        done(null);
      }
    });
  });
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<Mode>("original");
  const [showSettings, setShowSettings] = useState(false);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const { isStreaming, content: streamedContent, error, startStream, stopStream, clearContent, setContent: setLlmContent } = useLLM(settings);
  const tts = useTTS(settings);

  const tabRef = useRef<TabData>(emptyTab());
  const llmCacheRef = useRef<Map<string, string>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const pinnedTabIdRef = useRef<number | null>(null);
  const processWithLLMRef = useRef<(sourceContent: string, targetMode: Mode) => void>(null!);
  const extractingRef = useRef(false);

  const tab = tabRef.current;
  const isExtracting = extractingRef.current;
  const showLoading = !tab.original && isExtracting;

  function saveCurrentLlm() {
    if (mode === "original" || !streamedContent) return;
    tab[mode] = streamedContent;
  }

  const processWithLLM = useCallback((sourceContent: string, targetMode: Mode) => {
    const prompt = targetMode === "executive"
      ? settings.promptExecutiveSummary.replace("{{content}}", sourceContent)
      : settings.promptDistilledSummary.replace("{{content}}", sourceContent);

    const key = `${hash(sourceContent)}|${targetMode}|${prompt}`;
    const cached = llmCacheRef.current.get(key);
    if (cached !== undefined) {
      setLlmContent(cached);
      tab[targetMode] = cached;
      return;
    }

    startStream(prompt, null, (result) => {
      llmCacheRef.current.set(key, result);
      tab[targetMode] = result;
    });
  }, [settings, setLlmContent, startStream]);
  processWithLLMRef.current = processWithLLM;

  function normalizeContent(s: string): string {
    return s.replace(/\s+/g, " ").trim();
  }

  function requestExtraction() {
    if (extractingRef.current) return;
    if (pinnedTabIdRef.current === null) return;
    extractingRef.current = true;
    tab.original = "";
    tab.title = "";
    clearContent();
    bump();

    extractFromTab(pinnedTabIdRef.current).then((data) => {
      extractingRef.current = false;
      if (!data) { bump(); return; }
      const newContent = data.content || "";

      const isNewContent = normalizeContent(tab.original) !== normalizeContent(newContent);
      tab.original = newContent;
      tab.title = data.title;
      if (isNewContent) {
        tab.selectedText = "";
        tab.executive = "";
        tab.distilled = "";
      }

      bump();
      if (isNewContent && modeRef.current !== "original" && newContent) {
        processWithLLMRef.current(newContent, modeRef.current);
      }
    });
  }

  function loadModeContent(targetMode: Mode) {
    if (targetMode === "original") return;
    if (tab[targetMode]) {
      setLlmContent(tab[targetMode]);
    } else {
      const source = tab.selectedText || tab.original;
      if (source) processWithLLM(source, targetMode);
    }
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    update(mq);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    chrome.storage.sync.get(null, (stored) => {
      if (chrome.runtime.lastError) return;
      if (stored && Object.keys(stored).length > 0) {
        setSettings({ ...DEFAULT_SETTINGS, ...stored } as Settings);
      }
    });
  }, []);

  useEffect(() => {
    const handler = (message: { type: string; data?: unknown }, _sender: { tab?: { id?: number } }) => {
      if (message.type === "SELECTION_DETECTED") {
        if (_sender.tab?.id !== pinnedTabIdRef.current) return;
        const data = message.data as { text: string; url: string };
        tab.selectedText = data.text;
        bump();
        if (modeRef.current !== "original" && data.text) {
          processWithLLMRef.current(data.text, modeRef.current);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "sidepanel" });
    let disconnected = false;
    port.onDisconnect.addListener(() => {
      if (disconnected) return;
      disconnected = true;
      chrome.runtime.connect({ name: "sidepanel" });
    });

    const onUpdated = (tabId: number, changeInfo: { status?: string }, _tab: unknown) => {
      if (tabId !== pinnedTabIdRef.current) return;
      if (changeInfo.status === "complete") {
        requestExtraction();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return;
      pinnedTabIdRef.current = tabId;
      requestExtraction();
    });

    return () => {
      disconnected = true;
      port.disconnect();
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  useEffect(() => {
    const onOpened = (info: { tabId?: number }) => {
      const tabId = info.tabId;
      if (!tabId) return;
      pinnedTabIdRef.current = tabId;
      tabRef.current = emptyTab();
      clearContent();
      tts.stop();
      bump();
      extractFromTab(tabId).then((data) => {
        extractingRef.current = false;
        if (!data) { bump(); return; }
        const newContent = data.content || "";
        const isNew = normalizeContent(tabRef.current.original) !== normalizeContent(newContent);
        tabRef.current.original = newContent;
        tabRef.current.title = data.title;
        if (isNew) {
          tabRef.current.selectedText = "";
          tabRef.current.executive = "";
          tabRef.current.distilled = "";
        }
        bump();
        if (isNew && modeRef.current !== "original" && newContent) {
          processWithLLMRef.current(newContent, modeRef.current);
        }
      });
    };
    chrome.sidePanel.onOpened.addListener(onOpened);
    return () => chrome.sidePanel.onOpened.removeListener(onOpened);
  }, [clearContent, tts]);

  const handleModeChange = useCallback((newMode: Mode) => {
    saveCurrentLlm();
    clearContent();
    tts.stop();
    setMode(newMode);

    if (newMode === "original") return;
    loadModeContent(newMode);
  }, [clearContent, tts]);

  const handleReextract = useCallback(() => {
    tabRef.current = emptyTab();
    clearContent();
    tts.stop();
    bump();
    requestExtraction();
  }, [clearContent, tts]);

  const handlePlayTTS = useCallback(() => {
    const text = streamedContent || tab.selectedText || tab.original || "";
    if (text && pinnedTabIdRef.current !== null) tts.play(text, pinnedTabIdRef.current);
  }, [streamedContent, tts]);

  const handleSettingsSave = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    chrome.storage.sync.set(newSettings as unknown as Record<string, unknown>);
  }, []);

  const handleCopyRichText = useCallback(async () => {
    if (!contentRef.current) return;
    const html = contentRef.current.innerHTML;
    const text = contentRef.current.textContent || "";
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(text);
    }
  }, []);

  const displayContent = mode === "original"
    ? (tab.selectedText || tab.original)
    : streamedContent;

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Cognitive Offload</h1>
        <div className="flex items-center gap-2">
          {tab.title && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{tab.title}</span>}
          <Button variant="ghost" size="sm" onClick={handleReextract}><RefreshCw className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}><SettingsIcon className="size-4" /></Button>
        </div>
      </header>

      <div className="px-4 py-3 border-b bg-muted/30">
        <ModeSelector activeMode={mode} onModeChange={handleModeChange} />
      </div>

      <TooltipProvider>
        <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <TTSControls
              isPlaying={tts.isPlaying}
              isLoading={tts.isLoading}
              isPaused={tts.isPaused}
              speed={tts.speed}
              error={tts.error}
              disabled={!displayContent}
              onPlay={handlePlayTTS}
              onPause={tts.pause}
              onResume={tts.resume}
              onStop={tts.stop}
              onSpeedChange={tts.setSpeed}
            />
            <div className="w-px h-4 bg-border" />
            <Tooltip>
              <TooltipTrigger>
                <Button variant="ghost" size="xs" onClick={handleCopyRichText} disabled={!displayContent}>
                  <Copy className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="xs" disabled={!displayContent} onClick={() => handleSettingsSave({ ...settings, fontSize: Math.max(12, settings.fontSize - 1) })}>
                <Minus className="size-3" />
              </Button>
              <Tooltip>
                <TooltipTrigger tabIndex={-1}>
                  <CaseUpper className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Font size</TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="xs" disabled={!displayContent} onClick={() => handleSettingsSave({ ...settings, fontSize: Math.min(24, settings.fontSize + 1) })}>
                <Plus className="size-3" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="xs" disabled={!displayContent} onClick={() => handleSettingsSave({ ...settings, lineHeight: Math.max(1.0, +(settings.lineHeight - 0.1).toFixed(1)) })}>
                <Minus className="size-3" />
              </Button>
              <Tooltip>
                <TooltipTrigger tabIndex={-1}>
                  <TextSelect className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Line spacing</TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="xs" disabled={!displayContent} onClick={() => handleSettingsSave({ ...settings, lineHeight: Math.min(2.5, +(settings.lineHeight + 0.1).toFixed(1)) })}>
                <Plus className="size-3" />
              </Button>
            </div>
          </div>
        </div>
      </TooltipProvider>

      <div className="flex-1 overflow-auto p-4">
        {showSettings ? (
          <SettingsPanel
            settings={settings}
            onSave={handleSettingsSave}
            onClose={() => setShowSettings(false)}
          />
        ) : !displayContent && showLoading ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <Loader2 className="size-12 mb-4 text-muted-foreground/50 animate-spin" />
            <p className="text-sm text-center">Extrayendo contenido...</p>
          </div>
        ) : !displayContent ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <BookOpen className="size-16 mb-4 text-muted-foreground/50" />
            <p className="text-sm text-center">Navigate to a page and click the extension icon</p>
          </div>
        ) : (
          <>
            <div ref={contentRef} style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}>
              {mode === "original" && tab.selectedText && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Selected text from page</p>
                  <Markdown content={tab.selectedText} />
                </div>
              )}

              {mode === "original" && tab.original && !tab.selectedText && (
                <div>
                  <p className="text-xs text-muted-foreground mb-4">{tab.title}</p>
                  <Markdown content={tab.original} />
                </div>
              )}

              {streamedContent && mode !== "original" && (
                <Markdown content={streamedContent} />
              )}
            </div>

            {isStreaming && (
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <span className="animate-pulse">●</span>
                <span>Generating...</span>
                <button onClick={stopStream} className="text-xs hover:underline">(stop)</button>
              </div>
            )}

            {error && <div className="mt-4 p-3 bg-red-100 text-red-800 text-sm rounded-lg">{error}</div>}
          </>
        )}
      </div>

    </div>
  );
}
