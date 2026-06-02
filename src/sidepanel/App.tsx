import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { Mode, Settings, DEFAULT_SETTINGS, ExtractedContent } from "../types";
import { useLLM } from "../lib/useLLM";
import { useTTS } from "../lib/useTTS";
import { BookOpen, CaseUpper, Copy, Loader2, Minus, Plus, RefreshCw, Settings as SettingsIcon, TextSelect } from "lucide-react";
import { ModeSelector } from "../components/ModeSelector";
import { Markdown } from "../components/Markdown";
import { TTSControls } from "../components/TTSControls";
import { SettingsPanel } from "../components/SettingsPanel";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../components/ui/tooltip";

interface TabAudio {
  text: string;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  isFallback: boolean;
  speed: number;
}

interface TabData {
  original: string;
  title: string;
  selectedText: string;
  executive: string;
  distilled: string;
  audio: TabAudio | null;
}

function emptyTab(): TabData {
  return { original: "", title: "", selectedText: "", executive: "", distilled: "", audio: null };
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
    chrome.tabs.sendMessage(tabId, { type: "REQUEST_EXTRACTION" }, (response: unknown) => {
    if (chrome.runtime.lastError) {
      console.warn("[Reader] Content script not ready, injecting...", chrome.runtime.lastError.message);
      chrome.scripting.executeScript({ target: { tabId }, files: ["src/content/content.js"] }, () => {
        if (chrome.runtime.lastError) {
          console.error("[Reader] Script injection failed:", chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { type: "REQUEST_EXTRACTION" }, (resp: unknown) => {
            if (chrome.runtime.lastError) {
              console.error("[Reader] Extraction after injection failed:", chrome.runtime.lastError.message);
              resolve(null);
              return;
            }
            const r = resp as { type?: string; data?: unknown } | undefined;
            if (r?.type === "CONTENT_EXTRACTED") {
              resolve(r.data as ExtractedContent);
            } else {
              resolve(null);
            }
          });
        }, 300);
      });
      return;
    }
    const r = response as { type?: string; data?: unknown } | undefined;
    if (r?.type === "CONTENT_EXTRACTED") {
      resolve(r.data as ExtractedContent);
    } else {
      resolve(null);
    }
  });
  });
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<Mode>("original");
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const { isStreaming, content: streamedContent, error, startStream, stopStream, clearContent, setContent: setLlmContent } = useLLM(settings);
  const tts = useTTS(settings);

  const tabsRef = useRef<Map<number, TabData>>(new Map());
  const llmCacheRef = useRef<Map<string, string>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const myWindowIdRef = useRef<number | null>(null);
  const processWithLLMRef = useRef<(sourceContent: string, targetMode: Mode, tabId: number) => void>(null!);
  const switchToTabRef = useRef<(tabId: number) => void>(null!);
  const extractionInProgressRef = useRef<Set<number>>(new Set());
  const pageLoadingRef = useRef<Set<number>>(new Set());
  const navigationDebounceRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const activeTab = activeTabId !== null ? tabsRef.current.get(activeTabId) : undefined;
  const isExtracting = activeTabId !== null && extractionInProgressRef.current.has(activeTabId);
  const isPageLoading = activeTabId !== null && pageLoadingRef.current.has(activeTabId);
  const showLoading = !activeTab?.original && (isExtracting || isPageLoading);

  function getTab(tabId: number): TabData {
    let t = tabsRef.current.get(tabId);
    if (!t) {
      t = emptyTab();
      tabsRef.current.set(tabId, t);
    }
    return t;
  }

  function saveCurrentLlm() {
    if (activeTabId === null || mode === "original" || !streamedContent) return;
    const t = getTab(activeTabId);
    t[mode] = streamedContent;
  }

  const processWithLLM = useCallback((sourceContent: string, targetMode: Mode, tabId: number) => {
    const prompt = targetMode === "executive"
      ? settings.promptExecutiveSummary.replace("{{content}}", sourceContent)
      : settings.promptDistilledSummary.replace("{{content}}", sourceContent);

    const key = `${hash(sourceContent)}|${targetMode}|${prompt}`;
    const cached = llmCacheRef.current.get(key);
    if (cached !== undefined) {
      setLlmContent(cached);
      getTab(tabId)[targetMode] = cached;
      return;
    }

    startStream(prompt, null, (result) => {
      llmCacheRef.current.set(key, result);
      getTab(tabId)[targetMode] = result;
    });
  }, [settings, setLlmContent, startStream]);
  processWithLLMRef.current = processWithLLM;

  function normalizeContent(s: string): string {
    return s.replace(/\s+/g, " ").trim();
  }

  function requestExtractionForTab(tabId: number) {
    if (extractionInProgressRef.current.has(tabId)) {
      console.log("[Reader] Extraction already in progress for tab", tabId, "— skipping");
      return;
    }
    extractionInProgressRef.current.add(tabId);
    bump();
    console.log("[Reader] Extracting content from tab", tabId);

    const attempt = (retriesLeft: number) => {
      extractFromTab(tabId).then((data) => {
        if (!data) {
          if (retriesLeft > 0) {
            console.log("[Reader] Extraction returned no data, retrying...", retriesLeft, "left");
            setTimeout(() => attempt(retriesLeft - 1), 500);
            return;
          }
          extractionInProgressRef.current.delete(tabId);
          bump();
          console.warn("[Reader] Extraction returned no data for tab", tabId);
          return;
        }
        extractionInProgressRef.current.delete(tabId);
        bump();
        const newContent = data.content || "";
        console.log("[Reader] Content extracted:", data.title, newContent.length, "chars");
        const t = getTab(tabId);

        const isNewContent = normalizeContent(t.original) !== normalizeContent(newContent);
        t.original = newContent;
        t.title = data.title;
        if (isNewContent) {
          t.selectedText = "";
          t.executive = "";
          t.distilled = "";
        }

        if (tabId === activeTabIdRef.current || activeTabIdRef.current === null) {
          if (activeTabIdRef.current === null) setActiveTabId(tabId);
          bump();
          if (isNewContent && modeRef.current !== "original" && newContent) {
            processWithLLMRef.current(newContent, modeRef.current, tabId);
          }
        }
      });
    };

    attempt(2);
  }

  function switchToTab(tabId: number) {
    const prevTabId = activeTabId;
    saveCurrentLlm();
    clearContent();
    if (prevTabId != null) tts.switchFromTab(prevTabId);
    tts.switchToTab(tabId);
    setActiveTabId(tabId);
    bump();

    const t = getTab(tabId);

    if (!t.original) {
      chrome.tabs.get(tabId, (currentTab) => {
        if (chrome.runtime.lastError) {
          requestExtractionForTab(tabId);
          return;
        }
        const url = currentTab.url || "";
        if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("file://")) return;
        if (currentTab.status === "complete") {
          requestExtractionForTab(tabId);
        } else {
          pageLoadingRef.current.add(tabId);
          bump();
        }
      });
      return;
    }

    if (mode !== "original") {
      if (t[mode]) {
        setLlmContent(t[mode]);
      } else {
        const source = t.selectedText || t.original;
        if (source) processWithLLM(source, mode, tabId);
      }
    }
  }
  switchToTabRef.current = switchToTab;

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
    const handler = (message: { type: string; data?: unknown }, _sender: { tab?: { id?: number; windowId?: number } }) => {
      if (message.type === "SELECTION_DETECTED") {
        if (_sender.tab?.id !== activeTabIdRef.current) return;
        const data = message.data as { text: string; url: string };
        const senderTabId = activeTabIdRef.current!;
        const t = getTab(senderTabId);
        t.selectedText = data.text;
        bump();
        if (modeRef.current !== "original" && data.text) {
          processWithLLMRef.current(data.text, modeRef.current, senderTabId);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  useEffect(() => {
    console.log("[Reader] Sidepanel mounted, querying active tab...");
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return;
      const tab = tabs[0];
      const tabId = tab?.id;
      if (!tabId) {
        console.warn("[Reader] No active tab found");
        return;
      }
      myWindowIdRef.current = tab.windowId ?? null;
      console.log("[Reader] Active tab:", tabId, "in window:", tab.windowId);
      setActiveTabId(tabId);

      chrome.tabs.get(tabId, (currentTab) => {
        if (chrome.runtime.lastError) {
          requestExtractionForTab(tabId);
          return;
        }
        const url = currentTab.url || "";
        if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("file://")) return;
        if (currentTab.status === "complete") {
          requestExtractionForTab(tabId);
        } else {
          pageLoadingRef.current.add(tabId);
          bump();
        }
      });
    });

    const port = chrome.runtime.connect({ name: "sidepanel" });
    let disconnected = false;

    port.onDisconnect.addListener(() => {
      if (disconnected) return;
      disconnected = true;
      chrome.runtime.connect({ name: "sidepanel" });
    });

    const handleNavigation = (tabId: number) => {
      if (myWindowIdRef.current != null) {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) return;
          if (tab.windowId !== myWindowIdRef.current) return;
          scheduleExtraction(tabId);
        });
      } else {
        scheduleExtraction(tabId);
      }
    };

    const scheduleExtraction = (tabId: number) => {
      const existing = navigationDebounceRef.current.get(tabId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        navigationDebounceRef.current.delete(tabId);
        requestExtractionForTab(tabId);
      }, 300);
      navigationDebounceRef.current.set(tabId, timer);
    };

    const onUpdated = (tabId: number, changeInfo: { status?: string; url?: string }, tab: { windowId?: number; url?: string } | undefined) => {
      if (myWindowIdRef.current != null && tab?.windowId != null && tab.windowId !== myWindowIdRef.current) return;
      if (changeInfo.status === "complete" && pageLoadingRef.current.delete(tabId)) {
        bump();
      }
      if (changeInfo.status === "complete" && tabId === activeTabIdRef.current) {
        const url = tab?.url || "";
        if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("file://")) return;
        console.log("[Reader] Tab", tabId, "completed loading — re-extracting");
        requestExtractionForTab(tabId);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);

    const onActivated = (activeInfo: { tabId: number; windowId: number }) => {
      if (myWindowIdRef.current != null && activeInfo.windowId !== myWindowIdRef.current) return;
      switchToTabRef.current(activeInfo.tabId);
    };
    chrome.tabs.onActivated.addListener(onActivated);

    const onWebNav = (details: { tabId: number; frameId: number; url: string }) => {
      if (details.frameId !== 0) return;
      if (!details.url.startsWith("http://") && !details.url.startsWith("https://") && !details.url.startsWith("file://")) return;
      handleNavigation(details.tabId);
    };
    if (chrome.webNavigation) {
      chrome.webNavigation.onCompleted.addListener(onWebNav);
      chrome.webNavigation.onHistoryStateUpdated.addListener(onWebNav);
      chrome.webNavigation.onReferenceFragmentUpdated.addListener(onWebNav);
    }

    return () => {
      disconnected = true;
      port.disconnect();
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onActivated.removeListener(onActivated);
      if (chrome.webNavigation) {
        chrome.webNavigation.onCompleted.removeListener(onWebNav);
        chrome.webNavigation.onHistoryStateUpdated.removeListener(onWebNav);
        chrome.webNavigation.onReferenceFragmentUpdated.removeListener(onWebNav);
      }
    };
  }, []);

  const handleModeChange = useCallback((newMode: Mode) => {
    saveCurrentLlm();
    clearContent();
    tts.stop();
    setMode(newMode);

    if (newMode === "original" || activeTabId === null) return;

    const t = getTab(activeTabId);

    if (t[newMode]) {
      setLlmContent(t[newMode]);
    } else {
      const source = t.selectedText || t.original;
      if (source) processWithLLM(source, newMode, activeTabId);
    }
  }, [activeTabId, clearContent, tts, setLlmContent, processWithLLM]);

  const handleReextract = useCallback(() => {
    if (activeTabId !== null) {
      tabsRef.current.delete(activeTabId);
    }
    clearContent();
    tts.stop();
    bump();
    if (activeTabId !== null) {
      requestExtractionForTab(activeTabId);
    }
  }, [activeTabId, clearContent, tts]);

  const handlePlayTTS = useCallback(() => {
    const text = streamedContent || activeTab?.selectedText || activeTab?.original || "";
    if (text && activeTabId !== null) tts.play(text, activeTabId);
  }, [streamedContent, activeTab, activeTabId, tts]);

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
    ? (activeTab?.selectedText || activeTab?.original)
    : streamedContent;

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Reader</h1>
        <div className="flex items-center gap-2">
          {activeTab?.title && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{activeTab.title}</span>}
          <Button variant="ghost" size="sm" onClick={handleReextract}><RefreshCw className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}><SettingsIcon className="size-4" /></Button>
        </div>
      </header>

      <div className="px-4 py-3 border-b bg-muted/30">
        <ModeSelector activeMode={mode} onModeChange={handleModeChange} />
      </div>

      <TooltipProvider>
        <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/20">
          <Tooltip>
            <TooltipTrigger>
              <Button variant="ghost" size="xs" onClick={handleCopyRichText}>
                <Copy className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="xs" onClick={() => handleSettingsSave({ ...settings, fontSize: Math.max(12, settings.fontSize - 1) })}>
                <Minus className="size-3" />
              </Button>
              <Tooltip>
                <TooltipTrigger tabIndex={-1}>
                  <CaseUpper className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Font size</TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="xs" onClick={() => handleSettingsSave({ ...settings, fontSize: Math.min(24, settings.fontSize + 1) })}>
                <Plus className="size-3" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="xs" onClick={() => handleSettingsSave({ ...settings, lineHeight: Math.max(1.0, +(settings.lineHeight - 0.1).toFixed(1)) })}>
                <Minus className="size-3" />
              </Button>
              <Tooltip>
                <TooltipTrigger tabIndex={-1}>
                  <TextSelect className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Line spacing</TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="xs" onClick={() => handleSettingsSave({ ...settings, lineHeight: Math.min(2.5, +(settings.lineHeight + 0.1).toFixed(1)) })}>
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
              {mode === "original" && activeTab?.selectedText && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Selected text from page</p>
                  <Markdown content={activeTab.selectedText} />
                </div>
              )}

              {mode === "original" && activeTab?.original && !activeTab?.selectedText && (
                <div>
                  <p className="text-xs text-muted-foreground mb-4">{activeTab.title}</p>
                  <Markdown content={activeTab.original} />
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

      {displayContent && (
        <>
          <Separator />
          <div className="px-4 py-3">
            <TTSControls
              isPlaying={tts.isPlaying}
              isLoading={tts.isLoading}
              progress={tts.progress}
              speed={tts.speed}
              error={tts.error}
              isFallback={tts.isFallback}
              onPlay={handlePlayTTS}
              onPause={tts.pause}
              onResume={tts.resume}
              onStop={tts.stop}
              onSpeedChange={tts.setSpeed}
            />
          </div>
        </>
      )}
    </div>
  );
}
