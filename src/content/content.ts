import { Readability, isProbablyReaderable } from "@mozilla/readability";

declare global {
  interface Element {
    getInnerHTML(options?: { includeShadowRoots?: boolean }): string;
  }
}

function buildDocumentWithShadowDOM(): Document {
  const body = document.body as HTMLElement;
  if (typeof body.getInnerHTML === "function") {
    const html = body.getInnerHTML({ includeShadowRoots: true });
    const doc = new DOMParser().parseFromString(html, "text/html");
    const base = document.createElement("base");
    base.href = document.baseURI;
    doc.head.prepend(base);
    return doc;
  }
  return document.cloneNode(true) as Document;
}

const NAV_ROLES = new Set(["navigation", "banner", "search", "complementary", "contentinfo", "menu", "menubar", "toolbar", "tablist", "tab", "toolbar"]);

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName;
        if (el.hidden || tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
        if (tag === "NAV") return NodeFilter.FILTER_REJECT;
        if (el.getAttribute("aria-hidden") === "true") return NodeFilter.FILTER_REJECT;
        const role = el.getAttribute("role");
        if (role && NAV_ROLES.has(role)) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.SHOW_ALL;
    },
  });

  const blocks = new Set(["P", "DIV", "BR", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "TR", "BLOCKQUOTE", "HR", "FIGCAPTION", "DT", "DD", "SECTION", "ARTICLE", "HEADER", "FOOTER", "DETAILS", "SUMMARY"]);
  const inlinesNeedingSpace = new Set(["A", "SPAN", "B", "I", "EM", "STRONG", "CODE", "MARK", "SMALL", "SUB", "SUP"]);

  const parts: string[] = [];
  let prevWasBlock = false;

  while (walker.nextNode()) {
    const node = walker.currentNode;

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (blocks.has(el.tagName)) {
        if (!prevWasBlock && parts.length > 0) parts.push("\n");
        prevWasBlock = true;
      } else if (inlinesNeedingSpace.has(el.tagName) && parts.length > 0) {
        const last = parts[parts.length - 1];
        if (last && !last.endsWith(" ") && !last.endsWith("\n")) parts.push(" ");
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      const trimmed = text.replace(/\s+/g, " ");
      if (trimmed && trimmed !== " ") {
        parts.push(trimmed);
        prevWasBlock = false;
      }
    }
  }

  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractContent(): Promise<{ title: string; content: string; url: string }> {
  const title = document.title || "";
  const url = window.location.href;

  let content = "";

  try {
    const doc = buildDocumentWithShadowDOM();
    doc.querySelectorAll("script, style, noscript, link").forEach(el => el.remove());
    const reader = new Readability(doc);
    const article = reader.parse();
    if (article?.content) {
      content = htmlToText(article.content);
    } else if (article?.textContent) {
      content = article.textContent;
    }
  } catch {
    // fallback below
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

function waitForReadableContent(timeout = 3000, interval = 500): Promise<void> {
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