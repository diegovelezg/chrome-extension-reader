import { Readability, isProbablyReaderable } from "@mozilla/readability";

function flattenShadowRoots(live: Element, clone: Element) {
  const sr = (live as any).shadowRoot as ShadowRoot | null | undefined;
  if (sr) {
    for (const child of Array.from(sr.childNodes) as Node[]) {
      clone.appendChild(clone.ownerDocument.importNode(child, true));
    }
  }
  const liveKids = Array.from(live.children);
  const cloneKids = Array.from(clone.children);
  for (let i = 0; i < liveKids.length && i < cloneKids.length; i++) {
    flattenShadowRoots(liveKids[i], cloneKids[i]);
  }
}

async function extractContent(): Promise<{ title: string; content: string; url: string }> {
  const title = document.title || "";
  const url = window.location.href;

  let content = "";

  try {
    const doc = document.cloneNode(true) as Document;
    flattenShadowRoots(document.body, doc.body);
    const reader = new Readability(doc);
    const article = reader.parse();
    content = article?.textContent || "";
  } catch {
    // fallback below
  }

  if (content.length < 500) {
    content = document.body.innerText || "";
  }

  content = content
    .split("\n")
    .map(l => l.replace(/\s+/g, " ").trim())
    .filter(l => l.length > 0)
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

function waitForReadableContent(timeout = 5000, interval = 300): Promise<void> {
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
