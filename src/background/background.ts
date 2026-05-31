let sidePanelConnected = false;
const pendingExtractions = new Map<number, ReturnType<typeof setTimeout>>();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel") {
    sidePanelConnected = true;
    port.onDisconnect.addListener(() => {
      sidePanelConnected = false;
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
          chrome.runtime.sendMessage(r as { type: string; data: unknown });
        }
      }).catch(() => {
        if (++retries < maxRetries) setTimeout(trySend, 500);
      });
    };
    trySend();
  }, delay);

  pendingExtractions.set(tabId, timer);
}

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0 && sidePanelConnected) {
    requestExtraction(details.tabId, 500);
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0 && sidePanelConnected) {
    requestExtraction(details.tabId, 1500);
  }
});

chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  if (details.frameId === 0 && sidePanelConnected) {
    requestExtraction(details.tabId, 1500);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "REQUEST_EXTRACTION") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) requestExtraction(tabs[0].id);
    });
    sendResponse({});
  }

  return false;
});