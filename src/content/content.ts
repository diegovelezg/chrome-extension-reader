import { Readability, isProbablyReaderable } from "@mozilla/readability";

function L(msg: string, ...args: unknown[]) { console.warn(`[CS] ${msg}`, ...args); }

async function extractContent(): Promise<{ title: string; content: string; url: string }> {
  const url = window.location.href;
  L(`extractContent() start url=${url} readyState=${document.readyState}`);

  const title = document.title || "";
  const _url = url;

  let content = "";
  let readabilityLen = 0;

  try {
    const doc = document.cloneNode(true) as Document;
    const reader = new Readability(doc);
    const article = reader.parse();
    content = article?.textContent || "";
    readabilityLen = content.length;
    L(`Readability result: ${readabilityLen} chars, title="${article?.title || ""}"`);
  } catch (e) {
    L(`Readability FAILED: ${(e as Error).message}`);
  }

  const liveText = document.body.innerText || "";
  L(`innerText result: ${liveText.length} chars (vs readability ${readabilityLen})`);

  if (liveText.length > content.length * 3) {
    L(`→ using innerText (3x rule: ${liveText.length} > ${readabilityLen * 3})`);
    content = liveText;
  } else {
    L(`→ using Readability result`);
  }

  content = content
    .split("\n")
    .map(l => l.replace(/\s+/g, " ").trim())
    .filter(l => l.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  L(`extractContent() done: title="${title}" finalLen=${content.length}`);
  return { title, content, url: _url };
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

function waitForReadableContent(timeout = 5000, interval = 300): Promise<void> {
  const start = Date.now();
  const check = () => {
    try {
      return isProbablyReaderable(document, { minContentLength: 140, minScore: 20 });
    } catch {
      return false;
    }
  };

  if (check()) {
    L(`waitForReadableContent: immediately ready`);
    return Promise.resolve();
  }

  L(`waitForReadableContent: not ready, polling (timeout=${timeout}ms)`);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        L(`waitForReadableContent: ready after ${Date.now() - start}ms`);
        resolve();
      } else if (Date.now() >= deadline) {
        clearInterval(timer);
        L(`waitForReadableContent: timeout after ${timeout}ms`);
        resolve();
      }
    }, interval);
  });
}

if (isContextValid()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "REQUEST_EXTRACTION") {
      L(`REQUEST_EXTRACTION received url=${window.location.href}`);
      waitForDocumentReady()
        .then(() => L(`document ready, waiting for readable content`))
        .then(() => waitForReadableContent())
        .then(() => extractContent())
        .then((result) => {
          L(`extraction complete, sending response: ${result.content.length}chars`);
          try {
            sendResponse({ type: "CONTENT_EXTRACTED", data: result });
          } catch {
            // Extension context invalidated; ignore.
          }
        })
        .catch((e) => {
          L(`extraction FAILED: ${(e as Error)?.message || e}`);
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
