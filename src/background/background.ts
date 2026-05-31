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
          chrome.tabs.get(tabId, (tab) => {
            chrome.runtime.sendMessage({ type: "CONTENT_EXTRACTED", tabId, windowId: tab.windowId, data: r.data }).catch(() => {});
          });
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
    chrome.tabs.get(details.tabId, (tab) => {
      if (tab.active) requestExtraction(details.tabId, 500);
    });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.runtime.sendMessage({
    type: "ACTIVE_TAB_CHANGED",
    tabId: activeInfo.tabId,
    windowId: activeInfo.windowId,
  }).catch(() => {});
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0 && sidePanelConnected) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (tab.active) requestExtraction(details.tabId, 1500);
    });
  }
});

chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  if (details.frameId === 0 && sidePanelConnected) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (tab.active) requestExtraction(details.tabId, 1500);
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "REQUEST_EXTRACTION") {
    const query = message.windowId
      ? { active: true, windowId: message.windowId }
      : { active: true, currentWindow: true };
    chrome.tabs.query(query, (tabs) => {
      if (tabs[0]?.id) requestExtraction(tabs[0].id);
    });
    sendResponse({});
  }

  return false;
});
