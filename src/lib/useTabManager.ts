import { useRef, useReducer } from "react";
import { Mode } from "../types";

export interface TabData {
  original: string;
  title: string;
  selectedText: string;
  executive: string;
  distilled: string;
}

export function emptyTab(): TabData {
  return { original: "", title: "", selectedText: "", executive: "", distilled: "" };
}

export function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

export function normalizeContent(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function useTabManager() {
  const tabRef = useRef<TabData>(emptyTab());
  const cacheRef = useRef(new Map<number, TabData>());
  const currentTabIdRef = useRef<number | null>(null);
  const panelTabIdsRef = useRef(new Set<number>());
  const [, bump] = useReducer((x: number) => x + 1, 0);

  function switchToTab(tabId: number, setContent: (text: string) => void, clearContent: () => void, modeRef: React.MutableRefObject<Mode>, processWithLLMRef: React.MutableRefObject<(source: string, targetMode: Mode, force?: boolean) => void>) {
    if (currentTabIdRef.current !== null && tabRef.current.original) {
      cacheRef.current.set(currentTabIdRef.current, { ...tabRef.current });
    }

    currentTabIdRef.current = tabId;

    const cached = cacheRef.current.get(tabId);
    if (cached) {
      tabRef.current = { ...cached };
    } else {
      tabRef.current = emptyTab();
    }

    clearContent();
    if (tabRef.current.original && modeRef.current !== "original") {
      const field = modeRef.current as keyof TabData;
      if (tabRef.current[field]) {
        setContent(tabRef.current[field] as string);
      } else {
        processWithLLMRef.current(tabRef.current.original, modeRef.current);
      }
    }
    bump();
  }

  return {
    tabRef,
    cacheRef,
    currentTabIdRef,
    panelTabIdsRef,
    tab: tabRef.current,
    bump,
    switchToTab,
  };
}
