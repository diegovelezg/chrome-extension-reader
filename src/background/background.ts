chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CONTENT_EXTRACTED" || message.type === "SELECTION_DETECTED") {
    if (!message._forwarded && sender.tab) {
      message._forwarded = true;
      chrome.runtime.sendMessage(message).catch(() => {
        console.log("Side panel not available for message:", message.type);
      });
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "REQUEST_EXTRACTION") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_EXTRACTION" }).catch(() => {
          console.log("No content script available in active tab");
        });
      }
    });
    sendResponse({ success: true });
    return true;
  }

  sendResponse({ success: false, error: "Unknown message type" });
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Reader extension installed");
});
