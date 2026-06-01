function canInjectContentScript(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://");
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (_tab) => {
    if (chrome.runtime.lastError) return;
    chrome.runtime.sendMessage({
      type: "ACTIVE_TAB_CHANGED",
      tabId: activeInfo.tabId,
      windowId: activeInfo.windowId,
    }).catch(() => {});
  });
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError || !canInjectContentScript(tab.url)) return;
      chrome.runtime.sendMessage({
        type: "NAVIGATION_OCCURRED",
        tabId: details.tabId,
        windowId: tab.windowId,
      }).catch(() => {});
    });
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError || !canInjectContentScript(tab.url)) return;
      chrome.runtime.sendMessage({
        type: "NAVIGATION_OCCURRED",
        tabId: details.tabId,
        windowId: tab.windowId,
      }).catch(() => {});
    });
  }
});

chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  if (details.frameId === 0) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError || !canInjectContentScript(tab.url)) return;
      chrome.runtime.sendMessage({
        type: "NAVIGATION_OCCURRED",
        tabId: details.tabId,
        windowId: tab.windowId,
      }).catch(() => {});
    });
  }
});
