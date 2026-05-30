/// <reference types="vite-plugin-web-extension/client" />

declare const chrome: {
  runtime: {
    onMessage: {
      addListener(
        callback: (
          message: { type: string; data?: unknown; _forwarded?: boolean },
          sender: { tab?: { id?: number } },
          sendResponse: (response?: unknown) => void
        ) => void
      ): void;
      removeListener(
        callback: (
          message: { type: string; data?: unknown; _forwarded?: boolean },
          sender: { tab?: { id?: number } },
          sendResponse: (response?: unknown) => void
        ) => void
      ): void;
    };
    sendMessage(message: { type: string; data?: unknown; _forwarded?: boolean }): Promise<void>;
    onInstalled: {
      addListener(callback: () => void): void;
    };
  };
  storage: {
    sync: {
      get(
        keys: string | string[] | null,
        callback: (items: Record<string, unknown>) => void
      ): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
    };
  };
  tabs: {
    query(
      options: { active?: boolean; currentWindow?: boolean },
      callback: (tabs: { id?: number }[]) => void
    ): void;
    sendMessage(tabId: number, message: { type: string; data?: unknown }): Promise<void>;
  };
};
