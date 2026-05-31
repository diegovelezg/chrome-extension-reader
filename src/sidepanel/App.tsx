import { useState, useEffect, useCallback, useRef } from "react";
import { Mode, Settings, DEFAULT_SETTINGS, ExtractedContent } from "../types";
import { useLLM } from "../lib/useLLM";
import { useTTS } from "../lib/useTTS";
import { BookOpen, Copy, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { ModeSelector } from "../components/ModeSelector";
import { Markdown } from "../components/Markdown";
import { TTSControls } from "../components/TTSControls";
import { SettingsPanel } from "../components/SettingsPanel";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";

interface TabState {
  extracted: ExtractedContent | null;
  selectedText: string | null;
  executive: string | null;
  distilled: string | null;
  mode: Mode;
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [activeMode, setActiveMode] = useState<Mode>("original");
  const [content, setContent] = useState<ExtractedContent | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const { isStreaming, content: streamedContent, error, startStream, stopStream, clearContent, setContent: setLlmContent } = useLLM(settings);
  const tts = useTTS(settings);

  const modeRef = useRef(activeMode);
  modeRef.current = activeMode;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const stateRef = useRef({ content: null as ExtractedContent | null, selectedText: null as string | null, streamedContent: "" });
  stateRef.current = { content, selectedText, streamedContent };
  const contentRef = useRef<HTMLDivElement>(null);
  const tabCacheRef = useRef<Map<number, TabState>>(new Map());
  const llmCacheRef = useRef<Map<string, string>>(new Map());

  function hash(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return h.toString(36);
  }

  function getTabState(tabId: number): TabState {
    let ts = tabCacheRef.current.get(tabId);
    if (!ts) {
      ts = { extracted: null, selectedText: null, executive: null, distilled: null, mode: "original" };
      tabCacheRef.current.set(tabId, ts);
    }
    return ts;
  }

  function snapshotCurrentTab() {
    const tabId = activeTabIdRef.current;
    if (tabId === null) return;
    const s = stateRef.current;
    const ts = getTabState(tabId);
    ts.extracted = s.content;
    ts.selectedText = s.selectedText;
    ts.mode = modeRef.current;
    const mode = modeRef.current;
    if (mode === "executive") ts.executive = s.streamedContent;
    if (mode === "distilled") ts.distilled = s.streamedContent;
  }

  function saveLlmToTab(content: string, mode: Mode) {
    const tabId = activeTabIdRef.current;
    if (tabId === null) return;
    const ts = getTabState(tabId);
    if (mode === "executive") ts.executive = content;
    if (mode === "distilled") ts.distilled = content;
  }

  function restoreTab(tabId: number) {
    const ts = getTabState(tabId);
    setContent(ts.extracted);
    setSelectedText(ts.selectedText);
    clearContent();
    setActiveMode(ts.mode);

    if (!ts.extracted) {
      chrome.runtime.sendMessage({ type: "REQUEST_EXTRACTION" });
      return;
    }

    const mode = ts.mode;
    if (mode === "executive" && ts.executive) {
      setLlmContent(ts.executive);
    } else if (mode === "distilled" && ts.distilled) {
      setLlmContent(ts.distilled);
    } else if (mode !== "original") {
      const source = ts.selectedText || ts.extracted?.content;
      if (source) processWithLLM(source, mode);
    }
  }

  const processWithLLM = useCallback((sourceContent: string, mode: Mode) => {
    const s = settingsRef.current;
    const prompt = mode === "executive"
      ? s.promptExecutiveSummary.replace("{{content}}", sourceContent)
      : s.promptDistilledSummary.replace("{{content}}", sourceContent);

    const key = `${hash(sourceContent)}|${mode}|${prompt}`;
    const cached = llmCacheRef.current.get(key);
    if (cached !== undefined) {
      setLlmContent(cached);
      saveLlmToTab(cached, mode);
      return;
    }

    startStream(prompt, null, (result) => {
      llmCacheRef.current.set(key, result);
      saveLlmToTab(result, mode);
    });
  }, [setLlmContent, startStream]);

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
    const handler = (message: { type: string; tabId?: number; data?: unknown }) => {
      if (message.type === "CONTENT_EXTRACTED" && message.tabId !== undefined) {
        const data = message.data as ExtractedContent;
        const ts = getTabState(message.tabId);
        ts.extracted = data;
        ts.selectedText = null;

        if (message.tabId === activeTabIdRef.current) {
          setContent(data);
          setSelectedText(null);
          const mode = modeRef.current;
          if (mode !== "original" && data.content) {
            processWithLLM(data.content, mode);
          }
        } else if (activeTabIdRef.current === null) {
          setActiveTabId(message.tabId);
          setContent(data);
          setSelectedText(null);
          const mode = modeRef.current;
          if (mode !== "original" && data.content) {
            processWithLLM(data.content, mode);
          }
        }
      } else if (message.type === "ACTIVE_TAB_CHANGED" && message.tabId !== undefined) {
        snapshotCurrentTab();
        setActiveTabId(message.tabId);
        restoreTab(message.tabId);
      } else if (message.type === "SELECTION_DETECTED") {
        const data = message.data as { text: string; url: string };
        const tabId = activeTabIdRef.current;
        if (tabId === null) return;
        getTabState(tabId).selectedText = data.text;
        setSelectedText(data.text);
        const mode = modeRef.current;
        if (mode !== "original" && data.text) {
          processWithLLM(data.text, mode);
        }
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [processWithLLM]);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "sidepanel" });
    chrome.runtime.sendMessage({ type: "REQUEST_EXTRACTION" });
    let disconnected = false;

    port.onDisconnect.addListener(() => {
      if (disconnected) return;
      chrome.runtime.connect({ name: "sidepanel" });
      chrome.runtime.sendMessage({ type: "REQUEST_EXTRACTION" });
    });

    return () => {
      disconnected = true;
      port.disconnect();
    };
  }, []);

  const handleModeChange = useCallback((mode: Mode) => {
    snapshotCurrentTab();
    setActiveMode(mode);
    clearContent();
    tts.stop();

    const tabId = activeTabIdRef.current;
    if (tabId !== null) {
      getTabState(tabId).mode = mode;
    }

    if (mode === "original") return;

    if (tabId === null) return;
    const ts = getTabState(tabId);

    if (mode === "executive" && ts.executive) {
      setLlmContent(ts.executive);
    } else if (mode === "distilled" && ts.distilled) {
      setLlmContent(ts.distilled);
    } else {
      const source = ts.selectedText || ts.extracted?.content;
      if (source) processWithLLM(source, mode);
    }
  }, [clearContent, tts, setLlmContent, processWithLLM]);

  const handleReextract = useCallback(() => {
    const tabId = activeTabIdRef.current;
    if (tabId !== null) {
      const ts = getTabState(tabId);
      ts.extracted = null;
      ts.selectedText = null;
      ts.executive = null;
      ts.distilled = null;
    }
    setContent(null);
    setSelectedText(null);
    clearContent();
    tts.stop();
    chrome.runtime.sendMessage({ type: "REQUEST_EXTRACTION" });
  }, [clearContent, tts]);

  const handlePlayTTS = useCallback(() => {
    const text = streamedContent || selectedText || content?.content || "";
    if (text) tts.play(text);
  }, [streamedContent, selectedText, content, tts]);

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

  const displayContent = activeMode === "original" ? (selectedText || content?.content) : streamedContent;

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Reader</h1>
        <div className="flex items-center gap-2">
          {content && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{content.title}</span>}
          <Button variant="ghost" size="sm" onClick={handleReextract}><RefreshCw className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}><SettingsIcon className="size-4" /></Button>
        </div>
      </header>

      <div className="px-4 py-3 border-b bg-muted/30">
        <ModeSelector activeMode={activeMode} onModeChange={handleModeChange} />
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!content && !streamedContent && !selectedText ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <BookOpen className="size-16 mb-4 text-muted-foreground/50" />
            <p className="text-sm text-center">Navigate to a page and click the extension icon</p>
          </div>
        ) : (
          <>
            {displayContent && (
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="xs" onClick={handleCopyRichText} title="Copy rich text">
                  <Copy className="size-3" />
                </Button>
              </div>
            )}

            <div ref={contentRef}>
              {activeMode === "original" && selectedText && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Selected text from page</p>
                  <Markdown content={selectedText} />
                </div>
              )}

              {content && activeMode === "original" && !selectedText && (
                <div>
                  <p className="text-xs text-muted-foreground mb-4">{content.title}</p>
                  <Markdown content={content.content} />
                </div>
              )}

              {streamedContent && (
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