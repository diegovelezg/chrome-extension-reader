export interface Settings {
  llmEndpoint: string;
  llmApiKey: string;
  llmModel: string;
  ttsEndpoint: string;
  ttsVoice: string;
  promptExecutiveSummary: string;
  promptDistilledSummary: string;
}

export const DEFAULT_SETTINGS: Settings = {
  llmEndpoint: "http://localhost:11434",
  llmApiKey: "",
  llmModel: "llama3",
  ttsEndpoint: "http://localhost:8020",
  ttsVoice: "default",
  promptExecutiveSummary:
    "You are a professional analyst. Read the following content and produce the response in Spanish (castellano):\n1. An Executive Summary (2-3 paragraphs)\n2. Key Takeaways (bullet points)\n\nContent:\n{{content}}",
  promptDistilledSummary:
    "You are a professional editor. Read the following content and produce the response in Spanish (castellano), a concise, distilled summary that captures only the essential information in a compact format.\n\nContent:\n{{content}}",
};

export type Mode = "executive" | "distilled" | "original";

export interface ExtractedContent {
  title: string;
  content: string;
  url: string;
}

export type MessageType =
  | { type: "CONTENT_EXTRACTED"; tabId: number; data: ExtractedContent }
  | { type: "ACTIVE_TAB_CHANGED"; tabId: number; windowId: number }
  | { type: "SELECTION_DETECTED"; data: { text: string; url: string } }
  | { type: "REQUEST_EXTRACTION" }
  | { type: "GET_SETTINGS"; data: Settings }
  | { type: "SAVE_SETTINGS"; data: Settings };
