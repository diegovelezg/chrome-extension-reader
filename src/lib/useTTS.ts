import { useState, useCallback, useRef, useEffect } from "react";
import { TTSClient, createTTSClient } from "./tts-client";
import { Settings } from "../types";

export interface TTSState {
  isPlaying: boolean;
  isLoading: boolean;
  isPaused: boolean;
  progress: number;
  error: string | null;
  speed: number;
  isFallback: boolean;
}

interface CachedAudio {
  url: string;
  text: string;
  currentTime: number;
  duration: number;
}

export function useTTS(settings: Settings) {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isLoading: false,
    isPaused: false,
    progress: 0,
    error: null,
    speed: 1.0,
    isFallback: false,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clientRef = useRef<TTSClient | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentTabIdRef = useRef<number | null>(null);
  const audioCacheRef = useRef<Map<number, CachedAudio>>(new Map());

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createTTSClient(settings);
    } else {
      clientRef.current.updateSettings(settings);
    }
  }, [settings]);

  const revokeCachedUrl = useCallback((tabId: number) => {
    const c = audioCacheRef.current.get(tabId);
    if (c) {
      URL.revokeObjectURL(c.url);
      audioCacheRef.current.delete(tabId);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    if (currentTabIdRef.current != null) {
      revokeCachedUrl(currentTabIdRef.current);
    }
    currentTabIdRef.current = null;
    setState((prev) => ({ ...prev, isPlaying: false, isLoading: false, progress: 0, error: null, isFallback: false }));
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

    setState((prev) => ({ ...prev, isPlaying: true, isLoading: false, isPaused: false, isFallback: true, error: null }));

    utterance.onend = () => {
      setState((prev) => ({ ...prev, isPlaying: false, isPaused: false, progress: 0 }));
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setState((prev) => ({ ...prev, isPlaying: false, isLoading: false, isPaused: false, error: "Browser TTS failed" }));
      utteranceRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  }, [state.speed]);

  const attachAudioListeners = useCallback((audio: HTMLAudioElement, text: string, tabId: number) => {
    audio.onplay = () => {
      setState((prev) => ({ ...prev, isPlaying: true, isLoading: false, isPaused: false, isFallback: false }));
    };
    audio.onpause = () => {
      setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
    };
    audio.onended = () => {
      setState((prev) => ({ ...prev, isPlaying: false, isPaused: false, progress: 0 }));
    };
    audio.ontimeupdate = () => {
      if (audio.duration) {
        const progress = (audio.currentTime / audio.duration) * 100;
        setState((prev) => ({ ...prev, progress }));
        const c = audioCacheRef.current.get(tabId);
        if (c && c.text === text) {
          c.currentTime = audio.currentTime;
          c.duration = audio.duration;
        }
      }
    };
    audio.onerror = () => {
      console.log("TTS API failed, falling back to browser TTS");
      playFallback(text);
    };
  }, [playFallback]);

  const play = useCallback(async (text: string, tabId: number) => {
    if (!text.trim()) return;

    currentTabIdRef.current = tabId;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();

    const cached = audioCacheRef.current.get(tabId);
    if (cached && cached.text === text) {
      const audio = new Audio(cached.url);
      audioRef.current = audio;
      audio.currentTime = cached.currentTime;
      audio.playbackRate = state.speed;
      attachAudioListeners(audio, text, tabId);
      setState((prev) => ({ ...prev, isLoading: true, error: null, isFallback: false }));
      try {
        await audio.play();
        return;
      } catch {
        playFallback(text);
        return;
      }
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null, isFallback: false, isPaused: false }));

      const audioBuffer = await clientRef.current!.synthesize({
        input: text,
        speed: state.speed,
      });

      const blob = new Blob([audioBuffer], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      const existing = audioCacheRef.current.get(tabId);
      if (existing) URL.revokeObjectURL(existing.url);
      audioCacheRef.current.set(tabId, { url, text, currentTime: 0, duration: 0 });

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.playbackRate = state.speed;
      attachAudioListeners(audio, text, tabId);

      await audio.play();
    } catch (error) {
      console.log("TTS API unavailable, falling back to browser TTS");
      playFallback(text);
    }
  }, [state.speed, playFallback, attachAudioListeners]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (currentTabIdRef.current != null) {
        const c = audioCacheRef.current.get(currentTabIdRef.current);
        if (c) c.currentTime = audioRef.current.currentTime;
      }
    } else {
      window.speechSynthesis.pause();
    }
    setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
    } else {
      window.speechSynthesis.resume();
    }
    setState((prev) => ({ ...prev, isPlaying: true, isPaused: false }));
  }, []);

  const switchFromTab = useCallback((tabId: number) => {
    if (audioRef.current) {
      const c = audioCacheRef.current.get(tabId);
      if (c) {
        c.currentTime = audioRef.current.currentTime;
        c.duration = audioRef.current.duration || c.duration;
      }
      audioRef.current.pause();
    } else {
      window.speechSynthesis.pause();
    }
  }, []);

  const switchToTab = useCallback((tabId: number) => {
    currentTabIdRef.current = tabId;
    const c = audioCacheRef.current.get(tabId);
    if (c && c.duration > 0) {
      const progress = (c.currentTime / c.duration) * 100;
      setState((prev) => ({ ...prev, isPlaying: false, isLoading: false, isPaused: false, progress, error: null, isFallback: false }));
    } else {
    setState((prev) => ({ ...prev, isPlaying: false, isLoading: false, isPaused: false, progress: 0, error: null, isFallback: false }));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      audioCacheRef.current.forEach((c) => URL.revokeObjectURL(c.url));
      audioCacheRef.current.clear();
    };
  }, []);

  return {
    ...state,
    play,
    pause,
    resume,
    stop,
    setSpeed,
    switchFromTab,
    switchToTab,
    currentTabIdRef,
  };
}
