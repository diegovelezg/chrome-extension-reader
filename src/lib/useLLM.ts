import { useState, useCallback, useRef, useEffect } from "react";
import { LLMClient, StreamCallback } from "./llm-client";
import { Settings } from "../types";

interface LLMState {
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

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = new LLMClient(settings);
    } else {
      clientRef.current.updateSettings(settings);
    }
  }, [settings]);

  const startStream = useCallback(
    (prompt: string, systemPrompt: string | null, onComplete?: (content: string) => void) => {
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

      let accumulated = "";

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
          onComplete?.(accumulated);
          return;
        }

        accumulated += chunk.content;
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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      isStreaming: false,
      content: "",
      error: null,
    });
  }, []);

  const setContent = useCallback((text: string) => {
    setState({
      isStreaming: false,
      content: text,
      error: null,
    });
  }, []);

  return {
    ...state,
    startStream,
    stopStream,
    clearContent,
    setContent,
  };
}