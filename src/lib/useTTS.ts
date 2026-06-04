import { useState, useCallback, useRef, useEffect } from "react";
import { TTSClient } from "./tts-client";
import { Settings } from "../types";

interface TTSState {
  isPlaying: boolean;
  isLoading: boolean;
  isPaused: boolean;
  progress: number;
  error: string | null;
  speed: number;
  isFallback: boolean;
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
  const speedRef = useRef(state.speed);
  speedRef.current = state.speed;
  const cachedAudioRef = useRef<{ url: string; text: string; currentTime: number; duration: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = new TTSClient(settings);
    } else {
      clientRef.current.updateSettings(settings);
    }
  }, [settings]);

  const revokeCachedUrl = useCallback(() => {
    const c = cachedAudioRef.current;
    if (c) {
      URL.revokeObjectURL(c.url);
      cachedAudioRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    revokeCachedUrl();
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
    utterance.rate = speedRef.current;
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
  }, []);

  const attachAudioListeners = useCallback((audio: HTMLAudioElement, text: string) => {
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
        const c = cachedAudioRef.current;
        if (c && c.text === text) {
          c.currentTime = audio.currentTime;
          c.duration = audio.duration;
        }
      }
    };
    audio.onerror = () => {
      playFallback(text);
    };
  }, [playFallback]);

  const play = useCallback(async (text: string, _tabId: number) => {
    if (!text.trim()) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();

    const cached = cachedAudioRef.current;
    if (cached && cached.text === text) {
      const audio = new Audio(cached.url);
      audioRef.current = audio;
      audio.currentTime = cached.currentTime;
      audio.playbackRate = state.speed;
      attachAudioListeners(audio, text);
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

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const audioBuffer = await clientRef.current!.synthesize({
        input: text,
        speed: state.speed,
        signal: ac.signal,
      });

      const blob = new Blob([audioBuffer], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      revokeCachedUrl();
      cachedAudioRef.current = { url, text, currentTime: 0, duration: 0 };

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.playbackRate = state.speed;
      attachAudioListeners(audio, text);

      await audio.play();
    } catch (error) {
      playFallback(text);
    }
  }, [state.speed, playFallback, attachAudioListeners]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      const c = cachedAudioRef.current;
      if (c) c.currentTime = audioRef.current.currentTime;
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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      revokeCachedUrl();
    };
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
