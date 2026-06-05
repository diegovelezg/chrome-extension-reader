import { Readability, isProbablyReaderable } from "@mozilla/readability";

function L(msg: string, ...args: unknown[]) { console.warn(`[CS] ${msg}`, ...args); }

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
  const url = window.location.href;
  L(`extractContent() start. window.location.href=${url} readyState=${document.readyState} title="${document.title}"`);

  const title = document.title || "";

  let content = "";
  let readabilityLen = 0;
  let innerTextLen = 0;

  try {
    const doc = document.cloneNode(true) as Document;
    flattenShadowRoots(document.body, doc.body);
    const reader = new Readability(doc);
    const article = reader.parse();
    content = article?.textContent || "";
    readabilityLen = content.length;
    L(`Readability: ${readabilityLen} chars, articleTitle="${article?.title || ""}", hrefAtParse=${url}`);
  } catch (e) {
    L(`Readability FAILED: ${(e as Error).message}`);
  }

  const liveText = document.body.innerText || "";
  innerTextLen = liveText.length;
  L(`innerText: ${innerTextLen} chars, hrefAtRead=${window.location.href}`);

  if (liveText.length > content.length * 3) {
    L(`→ using innerText (3x rule)`);
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

  L(`extractContent() done. finalHref=${window.location.href} finalTitle="${title}" finalLen=${content.length}`);
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
  const start = Date.now();
  const check = () => {
    try {
      return isProbablyReaderable(document, { minContentLength: 140, minScore: 20 });
    } catch {
      return false;
    }
  };

  if (check()) {
    L(`waitForReadableContent: immediately ready, href=${window.location.href}`);
    return Promise.resolve();
  }

  L(`waitForReadableContent: polling, href=${window.location.href}`);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        L(`waitForReadableContent: ready after ${Date.now() - start}ms, href=${window.location.href}`);
        resolve();
      } else if (Date.now() >= deadline) {
        clearInterval(timer);
        L(`waitForReadableContent: timeout after ${timeout}ms, href=${window.location.href}`);
        resolve();
      }
    }, interval);
  });
}

if (isContextValid()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "REQUEST_EXTRACTION") {
      L(`REQUEST_EXTRACTION received. href=${window.location.href}`);
      waitForDocumentReady()
        .then(() => L(`document ready. href=${window.location.href}`))
        .then(() => waitForReadableContent())
        .then(() => extractContent())
        .then((result) => {
          L(`extraction complete. href=${window.location.href} contentLen=${result.content.length} title="${result.title}"`);
          try {
            sendResponse({ type: "CONTENT_EXTRACTED", data: result });
          } catch {
            // Extension context invalidated; ignore.
          }
        })
        .catch((e) => {
          L(`extraction FAILED: ${(e as Error)?.message || e}, href=${window.location.href}`);
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
