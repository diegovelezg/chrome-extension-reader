import { Fragment, useMemo, type ReactNode } from "react";

function renderInline(text: string) {
  type Inline = string | { bold: string } | { italic: string } | { code: string } | { link: { text: string; url: string } };
  const parts: Inline[] = [text];

  const patterns: [RegExp, (m: RegExpExecArray) => Inline & {}][] = [
    [/`([^`]+)`/g, (m) => ({ code: m[1] })],
    [/\*\*([^*]+)\*\*/g, (m) => ({ bold: m[1] })],
    [/\*([^*]+)\*/g, (m) => ({ italic: m[1] })],
    [/\[([^\]]+)\]\(([^)]+)\)/g, (m) => ({ link: { text: m[1], url: m[2] } })],
  ];

  for (const [regex, create] of patterns) {
    const newParts: Inline[] = [];
    for (const part of parts) {
      if (typeof part !== "string") { newParts.push(part); continue; }
      let lastIndex = 0;
      const re = new RegExp(regex.source, "g");
      let match: RegExpExecArray | null;
      while ((match = re.exec(part)) !== null) {
        if (match.index > lastIndex) newParts.push(part.slice(lastIndex, match.index));
        newParts.push(create(match));
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < part.length) newParts.push(part.slice(lastIndex));
    }
    parts.length = 0;
    parts.push(...newParts);
  }

  return parts.map((part, i) => {
    if (typeof part === "string") return <Fragment key={i}>{part}</Fragment>;
    if ("bold" in part) return <strong key={i}>{part.bold}</strong>;
    if ("italic" in part) return <em key={i}>{part.italic}</em>;
    if ("code" in part) return <code key={i} className="bg-muted px-1 rounded text-sm">{part.code}</code>;
    if ("link" in part) return <a key={i} href={part.link.url} className="underline text-primary">{part.link.text}</a>;
    return null;
  });
}

export function Markdown({ content }: { content: string }) {
  const lines = useMemo(() => content.split("\n"), [content]);
  const elements: ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let listItems: ReactNode[] = [];

  function flushList() {
    if (inList && listItems.length > 0) {
      const Tag = inList === "ul" ? "ul" : "ol";
      elements.push(<Tag className="list-inside mb-2" style={{ listStyleType: inList === "ul" ? "disc" : "decimal" }}>{listItems}</Tag>);
      listItems = [];
      inList = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(<pre key={elements.length} className="bg-muted p-3 rounded-lg mb-2 overflow-x-auto text-sm"><code>{codeBlockLines.join("\n")}</code></pre>);
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) { flushList(); elements.push(<div key={elements.length} className="h-2" />); continue; }

    flushList();

    if (trimmed.startsWith("### ")) {
      elements.push(<h3 key={elements.length} className="font-semibold text-lg mt-4 mb-1">{renderInline(trimmed.slice(4))}</h3>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<h2 key={elements.length} className="font-semibold text-xl mt-5 mb-2">{renderInline(trimmed.slice(3))}</h2>);
    } else if (trimmed.startsWith("# ")) {
      elements.push(<h1 key={elements.length} className="font-bold text-2xl mt-6 mb-2">{renderInline(trimmed.slice(2))}</h1>);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      inList = "ul";
      listItems.push(<li key={listItems.length} className="mb-1">{renderInline(trimmed.slice(2))}</li>);
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      inList = "ol";
      listItems.push(<li key={listItems.length} className="mb-1">{renderInline(trimmed.replace(/^\d+[.)]\s/, ""))}</li>);
    } else if (trimmed.startsWith("> ")) {
      elements.push(<blockquote key={elements.length} className="border-l-2 pl-3 italic text-muted-foreground mb-2">{renderInline(trimmed.slice(2))}</blockquote>);
    } else if (/^---+\s*$/.test(trimmed)) {
      elements.push(<hr key={elements.length} className="my-4 border-muted" />);
    } else {
      const isBoldLine = /^\*\*(.+)\*\*$/.test(trimmed);
      if (isBoldLine) {
        elements.push(<p key={elements.length} className="font-semibold mb-2">{renderInline(trimmed.replace(/^\*\*|\*\*$/g, ""))}</p>);
      } else {
        elements.push(<p key={elements.length} className="mb-2">{renderInline(trimmed)}</p>);
      }
    }
  }
  flushList();
  if (inCodeBlock) {
    elements.push(<pre key={elements.length} className="bg-muted p-3 rounded-lg mb-2 overflow-x-auto text-sm"><code>{codeBlockLines.join("\n")}</code></pre>);
  }

  return <>{elements}</>;
}