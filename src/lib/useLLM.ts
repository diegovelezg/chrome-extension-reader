import { useState, useCallback, useRef } from "react";
import { LLMClient, StreamCallback, createLLMClient } from "./llm-client";
import { Settings } from "../types";

export interface LLMState {
  isStreaming: boolean;
  content: string;
  error: string | null;
}

export function useLLM(settings: Settings) {
  const [state, setState] = useState<LLMState>({
    isStreaming: false,
    content: "",
    error: null,
  });

  const clientRef = useRef<LLMClient | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize or update client when settings change
  if (!clientRef.current) {
    clientRef.current = createLLMClient(settings);
  } else {
    clientRef.current.updateSettings(settings);
  }

  const startStream = useCallback(
    (prompt: string, systemPrompt: string | null) => {
      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState({
        isStreaming: true,
        content: "",
        error: null,
      });

      const onChunk: StreamCallback = (chunk) => {
        if (chunk.error) {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: chunk.error || "Unknown error",
          }));
          return;
        }

        if (chunk.done) {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          content: prev.content + chunk.content,
        }));
      };

      clientRef.current!.stream(prompt, systemPrompt, onChunk, abortController.signal);
    },
    []
  );

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState((prev) => ({
        ...prev,
        isStreaming: false,
      }));
    }
  }, []);

  const clearContent = useCallback(() => {
    setState({
      isStreaming: false,
      content: "",
      error: null,
    });
  }, []);

  return {
    ...state,
    startStream,
    stopStream,
    clearContent,
  };
}