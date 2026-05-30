import { useState, useEffect, useCallback } from "react";
import { Mode, Settings, DEFAULT_SETTINGS, ExtractedContent, MessageType } from "../types";
import { useLLM } from "../lib/useLLM";
import { useTTS } from "../lib/useTTS";
import { ModeSelector } from "../components/ModeSelector";
import { TTSControls } from "../components/TTSControls";
import { SettingsPanel } from "../components/SettingsPanel";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { cn } from "../lib/utils";

function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [activeMode, setActiveMode] = useState<Mode>("executive");
  const [content, setContent] = useState<ExtractedContent | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const { isStreaming, content: streamedContent, error, startStream, stopStream, clearContent } = useLLM(settings);
  const tts = useTTS(settings);

  // Load settings from storage on mount
  useEffect(() => {
    chrome.storage.sync.get(null, (stored) => {
      setSettings(stored as unknown as Settings);
    });
  }, []);

  // Request extraction when side panel opens
  useEffect(() => {
    chrome.runtime.sendMessage({ type: "REQUEST_EXTRACTION" });
  }, []);

  // Listen for messages from content script
  useEffect(() => {
    const handleMessage = (message: { type: string; data?: unknown }) => {
      const msg = message as MessageType;
      if (msg.type === "CONTENT_EXTRACTED") {
        setContent(msg.data as ExtractedContent);
        if (activeMode !== "original") {
          processWithLLM((msg.data as ExtractedContent).content, null);
        }
      } else if (msg.type === "SELECTION_DETECTED") {
        const sel = msg.data as { text: string; url: string };
        setSelectedText(sel.text);
        processWithLLM(sel.text, null);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [activeMode]);

  const processWithLLM = useCallback(
    (text: string, customPrompt: string | null) => {
      clearContent();
      
      if (activeMode === "original") {
        return;
      }

      let prompt: string;
      let systemPrompt: string | null = null;

      if (customPrompt) {
        prompt = customPrompt.replace("{{content}}", text);
      } else if (activeMode === "executive") {
        prompt = settings.promptExecutiveSummary.replace("{{content}}", text);
      } else {
        prompt = settings.promptDistilledSummary.replace("{{content}}", text);
      }

      startStream(prompt, systemPrompt);
    },
    [activeMode, settings, startStream, clearContent]
  );

  const handleModeChange = useCallback(
    (mode: Mode) => {
      setActiveMode(mode);
      clearContent();
      tts.stop();

      if (content && mode !== "original") {
        processWithLLM(content.content, null);
      }
    },
    [content, processWithLLM, clearContent, tts]
  );

  const handleSettingsSave = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    chrome.storage.sync.set(newSettings as unknown as Record<string, unknown>);
  }, []);

  const handleReextract = useCallback(() => {
    setContent(null);
    clearContent();
    tts.stop();
    chrome.runtime.sendMessage({ type: "REQUEST_EXTRACTION" });
  }, [clearContent, tts]);

  const handlePlayTTS = useCallback(() => {
    const textToRead = streamedContent || selectedText || content?.content || "";
    if (textToRead) {
      tts.play(textToRead);
    }
  }, [streamedContent, selectedText, content, tts]);

  const displayContent = activeMode === "original" ? content?.content : streamedContent;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Reader</h1>
          {content && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {content.title || content.url}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReextract}>
            ↻
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
            ⚙
          </Button>
        </div>
      </header>

      {/* Mode Selector */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <ModeSelector activeMode={activeMode} onModeChange={handleModeChange} />
      </div>

      {/* Content Area */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {!content && !streamedContent && (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <div className="text-4xl mb-4">📖</div>
              <p className="text-sm">Navigate to a page and click the extension icon to extract content</p>
            </div>
          )}

          {content && activeMode === "original" && (
            <div className="prose prose-sm max-w-none">
              {content.content.split("\n").map((line, i) => (
                <p key={i} className="mb-2">{line}</p>
              ))}
            </div>
          )}

          {streamedContent && (
            <div className="prose prose-sm max-w-none">
              {streamedContent.split("\n").map((line, i) => (
                <p key={i} className={cn("mb-2", line.startsWith("#") && "font-bold text-lg")}>
                  {line}
                </p>
              ))}
            </div>
          )}

          {isStreaming && (
            <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
              <span className="animate-pulse">●</span>
              <span>Generating...</span>
              <button
                onClick={stopStream}
                className="text-xs hover:underline"
              >
                (stop)
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* TTS Controls */}
      {displayContent && (
        <>
          <Separator />
          <div className="px-4 py-3 bg-background">
            <TTSControls
              isPlaying={tts.isPlaying}
              isLoading={tts.isLoading}
              progress={tts.progress}
              speed={tts.speed}
              error={tts.error}
              onPlay={handlePlayTTS}
              onPause={tts.pause}
              onResume={tts.resume}
              onStop={tts.stop}
              onSpeedChange={tts.setSpeed}
            />
          </div>
        </>
      )}

      {/* Settings Modal */}
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

export default App;