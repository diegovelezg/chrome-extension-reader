import { useState, useCallback, useRef, useEffect } from "react";
import { TTSClient, createTTSClient } from "./tts-client";
import { Settings } from "../types";

export interface TTSState {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  error: string | null;
  speed: number;
}

export function useTTS(settings: Settings) {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isLoading: false,
    progress: 0,
    error: null,
    speed: 1.0,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clientRef = useRef<TTSClient | null>(null);

  // Initialize or update client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createTTSClient(settings);
    } else {
      clientRef.current.updateSettings(settings);
    }
  }, [settings]);

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }));
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  const play = useCallback(async (text: string) => {
    if (!text.trim()) return;

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const audioBuffer = await clientRef.current!.synthesize({
        input: text,
        speed: state.speed,
      });

      const blob = new Blob([audioBuffer], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);

      // Clean up previous audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.playbackRate = state.speed;

      audio.onplay = () => {
        setState((prev) => ({ ...prev, isPlaying: true, isLoading: false }));
      };

      audio.onpause = () => {
        setState((prev) => ({ ...prev, isPlaying: false }));
      };

      audio.onended = () => {
        setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
        URL.revokeObjectURL(url);
      };

      audio.ontimeupdate = () => {
        if (audio.duration) {
          const progress = (audio.currentTime / audio.duration) * 100;
          setState((prev) => ({ ...prev, progress }));
        }
      };

      audio.onerror = () => {
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          isLoading: false,
          error: "Audio playback failed",
        }));
      };

      await audio.play();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, [state.speed]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
    }
  }, []);

  return {
    ...state,
    play,
    pause,
    resume,
    stop,
    setSpeed,
  };
}