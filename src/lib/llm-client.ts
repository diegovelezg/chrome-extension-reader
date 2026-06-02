import { Settings } from "../types";

interface LLMStreamChunk {
  content: string;
  done: boolean;
  error?: string;
}

export type StreamCallback = (chunk: LLMStreamChunk) => void;

export class LLMClient {
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  updateSettings(settings: Settings) {
    this.settings = settings;
  }

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

      const reader = response.body.getReader();
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
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      onChunk({ content: "", done: true, error: message });
    }
  }
}
