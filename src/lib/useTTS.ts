import { useState, useCallback, useRef, useEffect } from "react";
import { TTSClient, createTTSClient } from "./tts-client";
import { Settings } from "../types";

export interface TTSState {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  error: string | null;
  speed: number;
  isFallback: boolean;
}

export function useTTS(settings: Settings) {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isLoading: false,
    progress: 0,
    error: null,
    speed: 1.0,
    isFallback: false,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clientRef = useRef<TTSClient | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createTTSClient(settings);
    } else {
      clientRef.current.updateSettings(settings);
    }
  }, [settings]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }));
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  const playFallback = useCallback((text: string) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = state.speed;
    utteranceRef.current = utterance;

    setState((prev) => ({ ...prev, isPlaying: true, isLoading: false, isFallback: true }));

    utterance.onend = () => {
      setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setState((prev) => ({ ...prev, isPlaying: false, isLoading: false, error: "Browser TTS failed" }));
      utteranceRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  }, [state.speed]);

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

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.playbackRate = state.speed;

      audio.onplay = () => {
        setState((prev) => ({ ...prev, isPlaying: true, isLoading: false, isFallback: false }));
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
        console.log("TTS API failed, falling back to browser TTS");
        playFallback(text);
      };

      await audio.play();
    } catch (error) {
      console.log("TTS API unavailable, falling back to browser TTS");
      playFallback(text);
    }
  }, [state.speed, playFallback]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    } else {
      window.speechSynthesis.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
    } else {
      window.speechSynthesis.resume();
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
