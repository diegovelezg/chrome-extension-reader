import { Readability, isProbablyReaderable } from "@mozilla/readability";

async function extractContent(): Promise<{ title: string; content: string; url: string }> {
  const title = document.title || "";
  const url = window.location.href;

  let content = "";

  try {
    const doc = document.cloneNode(true) as Document;
    const reader = new Readability(doc);
    const article = reader.parse();
    if (article) {
      content = article.textContent || "";
    }
  } catch (e) {
    // fallback
  }

  if (!content) {
    const selectors = ["article", '[role="main"]', "main", ".post-content", ".article-content", "#content", ".content"];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        content = el.textContent || "";
        break;
      }
    }
  }

  if (!content) {
    content = document.body.textContent || "";
  }

  content = content.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2702}-\u{27B0}]|[\u{24C2}-\u{1F251}]|\u{200D}|\u{FE0F}/gu, "");
  content = content
    .split("\n")
    .map(l => l.replace(/\s+/g, " ").trim())
    .filter(l => l.length === 0 || l.length > 20)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, content, url };
}

function isContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function handleSelection(): void {
  if (!isContextValid()) return;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const text = selection.toString().trim();
  if (text.length < 10) return;

  try {
    chrome.runtime.sendMessage(
      {
        type: "SELECTION_DETECTED",
        data: { text, url: window.location.href },
      },
      () => {
        void chrome.runtime.lastError;
      },
    );
  } catch {
    // Extension context invalidated; ignore.
  }
}

if (isContextValid()) {
  document.addEventListener("mouseup", () => {
    setTimeout(handleSelection, 100);
  });
}

function waitForDocumentReady(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

function waitForReadableContent(timeout = 10000, interval = 1000): Promise<void> {
  const check = () => {
    try {
      return isProbablyReaderable(document, { minContentLength: 140, minScore: 20 });
    } catch {
      return false;
    }
  };

  if (check()) return Promise.resolve();

  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    const timer = setInterval(() => {
      if (check() || Date.now() >= deadline) {
        clearInterval(timer);
        resolve();
      }
    }, interval);
  });
}

if (isContextValid()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "REQUEST_EXTRACTION") {
      waitForDocumentReady()
        .then(() => waitForReadableContent())
        .then(() => extractContent())
        .then((result) => {
          try {
            sendResponse({ type: "CONTENT_EXTRACTED", data: result });
          } catch {
            // Extension context invalidated; ignore.
          }
        })
        .catch(() => {
          try {
            sendResponse({ type: "CONTENT_EXTRACTED", data: { title: "", content: "", url: "" } });
          } catch {
            // Extension context invalidated; ignore.
          }
        });
      return true;
    }
    return false;
  });
}