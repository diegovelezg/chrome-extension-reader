import { Readability } from "@mozilla/readability";

type ContentMessage =
  | { type: "CONTENT_EXTRACTED"; data: { title: string; content: string; url: string } }
  | { type: "SELECTION_DETECTED"; data: { text: string; url: string } };

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
    console.log("Readability parse failed, using fallback", e);
  }

  if (!content) {
    content = extractFallbackContent();
  }

  content = cleanContent(content);

  return { title, content, url };
}

// Fallback content extraction
function extractFallbackContent(): string {
  const selectors = [
    "article",
    '[role="main"]',
    "main",
    ".post-content",
    ".article-content",
    "#content",
    ".content",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent || "";
    }
  }

  // Ultimate fallback: body text
  return document.body.textContent || "";
}

// Clean extracted content
function cleanContent(text: string): string {
  return text
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    // Remove very short lines (likely navigation/fillers)
    .split("\n")
    .filter((line) => line.trim().length > 20 || line.trim().length === 0)
    .join("\n")
    // Normalize line breaks
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Handle text selection
function handleSelection(): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const text = selection.toString().trim();
  if (text.length < 10) return; // Ignore very short selections

  const message: ContentMessage = {
    type: "SELECTION_DETECTED",
    data: {
      text,
      url: window.location.href,
    },
  };

  chrome.runtime.sendMessage(message);
}

// Listen for selection changes
document.addEventListener("mouseup", () => {
  setTimeout(handleSelection, 100); // Small delay to allow selection to complete
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "REQUEST_EXTRACTION") {
    extractContent().then((result) => {
      const response: ContentMessage = {
        type: "CONTENT_EXTRACTED",
        data: result,
      };
      chrome.runtime.sendMessage(response);
      sendResponse({ success: true });
    });
    return true; // Indicates async response
  }
});

