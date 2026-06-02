function canInjectContentScript(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://");
}

function sendToSidePanels(message: { type: string; tabId: number; windowId: number }): void {
  chrome.runtime.sendMessage(message, () => {
    void chrome.runtime.lastError;
  });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (_tab) => {
    if (chrome.runtime.lastError) return;
    sendToSidePanels({
      type: "ACTIVE_TAB_CHANGED",
      tabId: activeInfo.tabId,
      windowId: activeInfo.windowId,
    });
  });
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError || !canInjectContentScript(tab.url)) return;
      sendToSidePanels({
        type: "NAVIGATION_OCCURRED",
        tabId: details.tabId,
        windowId: tab.windowId ?? -1,
      });
    });
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError || !canInjectContentScript(tab.url)) return;
      sendToSidePanels({
        type: "NAVIGATION_OCCURRED",
        tabId: details.tabId,
        windowId: tab.windowId ?? -1,
      });
    });
  }
});

chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  if (details.frameId === 0) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError || !canInjectContentScript(tab.url)) return;
      sendToSidePanels({
        type: "NAVIGATION_OCCURRED",
        tabId: details.tabId,
        windowId: tab.windowId ?? -1,
      });
    });
  }
});
