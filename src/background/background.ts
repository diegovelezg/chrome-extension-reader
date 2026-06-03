const SIDEPANEL_PATH = "src/sidepanel/sidepanel.html";

chrome.sidePanel.setOptions({ enabled: false });
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.tabs.onUpdated.addListener((tabId, _info, tab) => {
  if (!tab.url) return;
  const ok = tab.url.startsWith("http://") || tab.url.startsWith("https://");
  chrome.sidePanel.setOptions({ tabId, path: SIDEPANEL_PATH, enabled: ok });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    const url = tab.url || "";
    const ok = url.startsWith("http://") || url.startsWith("https://");
    chrome.sidePanel.setOptions({ tabId, path: SIDEPANEL_PATH, enabled: ok });
  });
});
