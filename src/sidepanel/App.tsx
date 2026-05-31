import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { Mode, Settings, DEFAULT_SETTINGS, ExtractedContent } from "../types";
import { useLLM } from "../lib/useLLM";
import { useTTS } from "../lib/useTTS";
import { BookOpen, CaseUpper, Copy, Minus, Plus, RefreshCw, Settings as SettingsIcon, TextSelect } from "lucide-react";
import { ModeSelector } from "../components/ModeSelector";
import { Markdown } from "../components/Markdown";
import { TTSControls } from "../components/TTSControls";
import { SettingsPanel } from "../components/SettingsPanel";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
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
  const windowIdRef = useRef<number | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeTab = activeTabId !== null ? tabsRef.current.get(activeTabId) : undefined;

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

  const processWithLLM = useCallback((sourceContent: string, targetMode: Mode) => {
    const prompt = targetMode === "executive"
      ? settings.promptExecutiveSummary.replace("{{content}}", sourceContent)
      : settings.promptDistilledSummary.replace("{{content}}", sourceContent);

    const key = `${hash(sourceContent)}|${targetMode}|${prompt}`;
    const cached = llmCacheRef.current.get(key);
    if (cached !== undefined) {
      setLlmContent(cached);
      if (activeTabId !== null) {
        getTab(activeTabId)[targetMode] = cached;
      }
      return;
    }

    startStream(prompt, null, (result) => {
      llmCacheRef.current.set(key, result);
      if (activeTabId !== null) {
        getTab(activeTabId)[targetMode] = result;
      }
    });
  }, [settings, activeTabId, setLlmContent, startStream]);

  function switchToTab(tabId: number) {
    saveCurrentLlm();
    clearContent();
    setActiveTabId(tabId);
    bump();

    const t = getTab(tabId);

    if (!t.original) {
      chrome.runtime.sendMessage({ type: "REQUEST_EXTRACTION", windowId: windowIdRef.current });
      return;
    }

    if (mode !== "original") {
      if (t[mode]) {
        setLlmContent(t[mode]);
      } else {
        const source = t.selectedText || t.original;
        if (source) processWithLLM(source, mode);
      }
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
      if (stored && Object.keys(stored).length > 0) {
        setSettings({ ...DEFAULT_SETTINGS, ...stored } as Settings);
      }
    });
  }, []);

  useEffect(() => {
    chrome.windows.getCurrent((w) => {
      windowIdRef.current = w.id;
    });

    const handler = (message: { type: string; tabId?: number; windowId?: number; data?: unknown }, sender: { tab?: { id?: number; windowId?: number } }) => {
      if (message.type === "CONTENT_EXTRACTED" && message.tabId !== undefined) {
        if (message.windowId !== undefined && message.windowId !== windowIdRef.current) return;
        const data = message.data as ExtractedContent;
        const t = getTab(message.tabId);
        const isNewContent = t.original !== data.content;
        t.original = data.content;
        t.title = data.title;
        if (isNewContent) {
          t.selectedText = "";
          t.executive = "";
          t.distilled = "";
        }

        if (message.tabId === activeTabId || activeTabId === null) {
          if (activeTabId === null) setActiveTabId(message.tabId);
          bump();
          if (isNewContent && mode !== "original" && data.content) {
            processWithLLM(data.content, mode);
          }
        }
      } else if (message.type === "ACTIVE_TAB_CHANGED" && message.tabId !== undefined) {
        if (message.windowId !== undefined && message.windowId !== windowIdRef.current) return;
        switchToTab(message.tabId);
      } else if (message.type === "SELECTION_DETECTED") {
        if (sender.tab?.windowId !== undefined && sender.tab.windowId !== windowIdRef.current) return;
        const data = message.data as { text: string; url: string };
        if (activeTabId === null) return;
        const t = getTab(activeTabId);
        t.selectedText = data.text;
        bump();
        if (mode !== "original" && data.text) {
          processWithLLM(data.text, mode);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [mode, activeTabId, processWithLLM]);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "sidepanel" });
    chrome.runtime.sendMessage({ type: "REQUEST_EXTRACTION", windowId: windowIdRef.current });
    let disconnected = false;

    port.onDisconnect.addListener(() => {
      if (disconnected) return;
      disconnected = true;
      chrome.runtime.connect({ name: "sidepanel" });
      chrome.runtime.sendMessage({ type: "REQUEST_EXTRACTION", windowId: windowIdRef.current });
      setActiveTabId(null);
      clearContent();
    });

    return () => {
      disconnected = true;
      port.disconnect();
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
      if (source) processWithLLM(source, newMode);
    }
  }, [activeTabId, clearContent, tts, setLlmContent, processWithLLM]);

  const handleReextract = useCallback(() => {
    if (activeTabId !== null) {
      tabsRef.current.delete(activeTabId);
    }
    clearContent();
    tts.stop();
    bump();
    chrome.runtime.sendMessage({ type: "REQUEST_EXTRACTION", windowId: windowIdRef.current });
  }, [activeTabId, clearContent, tts]);

  const handlePlayTTS = useCallback(() => {
    const text = streamedContent || activeTab?.selectedText || activeTab?.original || "";
    if (text) tts.play(text);
  }, [streamedContent, activeTab, tts]);

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
        {!displayContent ? (
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

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
