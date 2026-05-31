/// <reference types="vite-plugin-web-extension/client" />

declare const chrome: {
  runtime: {
    onMessage: {
      addListener(callback: (
        message: { type: string; tabId?: number; data?: unknown },
        sender: { tab?: { id?: number } },
        sendResponse: (response?: unknown) => void
      ) => void): void;
      removeListener(callback: (
        message: { type: string; tabId?: number; data?: unknown },
        sender: { tab?: { id?: number } },
        sendResponse: (response?: unknown) => void
      ) => void): void;
    };
    sendMessage(message: { type: string; tabId?: number; data?: unknown }): Promise<void>;
    connect(connectInfo: { name: string }): {
      disconnect(): void;
      onDisconnect: {
        addListener(callback: () => void): void;
      };
    };
    onConnect: {
      addListener(callback: (port: {
        name: string;
        onDisconnect: { addListener(callback: () => void): void };
      }) => void): void;
    };
    lastError?: { message: string };
    id: string;
  };
  storage: {
    sync: {
      get(keys: string | string[] | null, callback: (items: Record<string, unknown>) => void): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
    };
  };
  tabs: {
    get(tabId: number, callback: (tab: { id?: number; active?: boolean; windowId?: number }) => void): void;
    query(options: { active?: boolean; currentWindow?: boolean }, callback: (tabs: { id?: number; windowId?: number }[]) => void): void;
    sendMessage(tabId: number, message: { type: string; data?: unknown }): Promise<unknown>;
    onActivated: {
      addListener(callback: (activeInfo: { tabId: number; windowId: number }) => void): void;
    };
  };
  webNavigation: {
    onCompleted: {
      addListener(callback: (details: {
        tabId: number;
        url: string;
        frameId: number;
      }) => void): void;
    };
    onHistoryStateUpdated: {
      addListener(callback: (details: {
        tabId: number;
        url: string;
        frameId: number;
      }) => void): void;
    };
    onReferenceFragmentUpdated: {
      addListener(callback: (details: {
        tabId: number;
        url: string;
        frameId: number;
      }) => void): void;
    };
  };
};