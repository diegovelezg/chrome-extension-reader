import { Readability } from "@mozilla/readability";

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
  content = content.replace(/\s+/g, " ").split("\n").filter(l => l.trim().length > 20 || l.trim().length === 0).join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return { title, content, url };
}

function handleSelection(): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const text = selection.toString().trim();
  if (text.length < 10) return;

  chrome.runtime.sendMessage({
    type: "SELECTION_DETECTED",
    data: { text, url: window.location.href },
  });
}

document.addEventListener("mouseup", () => {
  setTimeout(handleSelection, 100);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "REQUEST_EXTRACTION") {
    extractContent().then((result) => {
      sendResponse({ type: "CONTENT_EXTRACTED", data: result });
    });
    return true;
  }
  return false;
});