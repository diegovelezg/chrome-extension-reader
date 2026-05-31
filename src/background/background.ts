let sidePanelConnected = false;
let sidePanelWindowId: number | null = null;
const pendingExtractions = new Map<number, ReturnType<typeof setTimeout>>();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel") {
    sidePanelConnected = true;

    port.onMessage.addListener((msg) => {
      if (msg.type === "SIDEPANEL_WINDOW" && msg.windowId !== undefined) {
        sidePanelWindowId = msg.windowId;
      }
    });

    port.onDisconnect.addListener(() => {
      sidePanelConnected = false;
      sidePanelWindowId = null;
      for (const [, timer] of pendingExtractions) {
        clearTimeout(timer);
      }
      pendingExtractions.clear();
    });
  }
});

function requestExtraction(tabId: number, delay = 0) {
  const existing = pendingExtractions.get(tabId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingExtractions.delete(tabId);
    let retries = 0;
    const maxRetries = 3;
    const trySend = () => {
      chrome.tabs.sendMessage(tabId, { type: "REQUEST_EXTRACTION" }).then((response: unknown) => {
        const r = response as { type?: string; data?: unknown } | undefined;
        if (r?.type === "CONTENT_EXTRACTED") {
          chrome.runtime.sendMessage({ type: "CONTENT_EXTRACTED", tabId, data: r.data });
        }
      }).catch(() => {
        if (++retries < maxRetries) setTimeout(trySend, 500);
      });
    };
    trySend();
  }, delay);

  pendingExtractions.set(tabId, timer);
}

function tabInSidePanelWindow(windowId?: number) {
  return windowId !== undefined && sidePanelWindowId !== null && windowId === sidePanelWindowId;
}

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0 && sidePanelConnected) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (tab.active && tabInSidePanelWindow(tab.windowId)) {
        requestExtraction(details.tabId, 500);
      }
    });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (tabInSidePanelWindow(activeInfo.windowId)) {
    chrome.runtime.sendMessage({ type: "ACTIVE_TAB_CHANGED", tabId: activeInfo.tabId }).catch(() => {});
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0 && sidePanelConnected) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (tabInSidePanelWindow(tab.windowId)) requestExtraction(details.tabId, 1500);
    });
  }
});

chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  if (details.frameId === 0 && sidePanelConnected) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (tabInSidePanelWindow(tab.windowId)) requestExtraction(details.tabId, 1500);
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "REQUEST_EXTRACTION") {
    if (sidePanelWindowId !== null) {
      chrome.tabs.query({ active: true, windowId: sidePanelWindowId }, (tabs) => {
        if (tabs[0]?.id) requestExtraction(tabs[0].id);
      });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) requestExtraction(tabs[0].id);
      });
    }
    sendResponse({});
  }

  return false;
});