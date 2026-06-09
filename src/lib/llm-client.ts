import { Settings } from "../types";

interface LLMStreamChunk {
  content: string;
  done: boolean;
  error?: string;
}

export type StreamCallback = (chunk: LLMStreamChunk) => void;

async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: StreamCallback,
  signal?: AbortSignal
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      onChunk({ content: "", done: true });
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();

        if (data === "[DONE]") {
          onChunk({ content: "", done: true });
          return;
        }

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            onChunk({ content, done: false });
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    if (signal?.aborted) return;
  }
}

export class LLMClient {
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  // fallow-ignore-next-line unused-class-member
  updateSettings(settings: Settings) {
    this.settings = settings;
  }

  // fallow-ignore-next-line unused-class-member
  async stream(
    prompt: string,
    systemPrompt: string | null,
    onChunk: StreamCallback,
    signal?: AbortSignal
  ): Promise<void> {
    const { llmEndpoint, llmApiKey, llmModel } = this.settings;

    try {
      const messages: { role: string; content: string }[] = [];

      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const response = await fetch(`${llmEndpoint}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
        },
        body: JSON.stringify({
          model: llmModel,
          messages,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      await parseSSEStream(response.body.getReader(), onChunk, signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (signal?.aborted) return;
      const message = error instanceof Error ? error.message : "Unknown error";
      onChunk({ content: "", done: true, error: message });
    }
  }
}
