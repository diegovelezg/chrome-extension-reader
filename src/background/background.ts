chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel") {
    // Accept the connection; no further handling needed.
  }
});
