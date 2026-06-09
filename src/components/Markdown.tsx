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

function parseTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && s.length > 1) s = s.slice(0, -1);
  return s.split("|").map(c => c.trim());
}

function parseTableSeparator(line: string): ("left" | "right" | "center" | null)[] | null {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && s.length > 1) s = s.slice(0, -1);
  const cells = s.split("|").map(c => c.trim());
  if (cells.length === 0) return null;
  if (!cells.every(c => /^:?-+:?$/.test(c))) return null;
  return cells.map(c => {
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

type TableState = { inTable: boolean; header: string[]; rows: string[][]; aligns: ("left" | "right" | "center" | null)[] };

function flushTable(state: TableState, elements: ReactNode[]): TableState {
  if (!state.inTable || state.header.length === 0) return state;
  const headerCells = state.header.map((cell, i) => (
    <th key={i} className="px-3 py-2 font-semibold border border-border" style={{ textAlign: state.aligns[i] || "left" }}>
      {renderInline(cell)}
    </th>
  ));
  const bodyRows = state.rows.map((row, ri) => (
    <tr key={ri} className="even:bg-muted/30">
      {row.map((cell, ci) => (
        <td key={ci} className="px-3 py-2 border border-border align-top" style={{ textAlign: state.aligns[ci] || "left" }}>
          {renderInline(cell)}
        </td>
      ))}
    </tr>
  ));
  elements.push(
    <div key={elements.length} className="overflow-x-auto mb-3">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-muted/50">
          <tr>{headerCells}</tr>
        </thead>
        <tbody>{bodyRows}</tbody>
      </table>
    </div>
  );
  return { inTable: false, header: [], rows: [], aligns: [] };
}

type ListState = { type: "ul" | "ol" | null; items: ReactNode[] };

function flushList(state: ListState, elements: ReactNode[]): ListState {
  if (state.type && state.items.length > 0) {
    const Tag = state.type === "ul" ? "ul" : "ol";
    elements.push(<Tag key={elements.length} className="list-inside mb-2" style={{ listStyleType: state.type === "ul" ? "disc" : "decimal" }}>{state.items}</Tag>);
  }
  return { type: null, items: [] };
}

export function Markdown({ content }: { content: string }) {
  const lines = useMemo(() => content.split("\n"), [content]);
  const elements: ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let list: ListState = { type: null, items: [] };
  let table: TableState = { inTable: false, header: [], rows: [], aligns: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(<pre key={elements.length} className="bg-muted p-3 rounded-lg mb-2 overflow-x-auto text-sm"><code>{codeBlockLines.join("\n")}</code></pre>);
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        list = flushList(list, elements);
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) { list = flushList(list, elements); table = flushTable(table, elements); elements.push(<div key={elements.length} className="h-2" />); continue; }

    list = flushList(list, elements);

    if (trimmed.startsWith("|")) {
      if (!table.inTable) {
        if (i + 1 < lines.length) {
          const aligns = parseTableSeparator(lines[i + 1].trim());
          if (aligns) {
            table = { inTable: true, header: parseTableRow(trimmed), rows: [], aligns };
            i++;
            continue;
          }
        }
      } else {
        table = { ...table, rows: [...table.rows, parseTableRow(trimmed)] };
        continue;
      }
    }

    if (table.inTable) table = flushTable(table, elements);

    if (trimmed.startsWith("### ")) {
      elements.push(<h3 key={elements.length} className="font-semibold text-lg mt-4 mb-1">{renderInline(trimmed.slice(4))}</h3>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<h2 key={elements.length} className="font-semibold text-xl mt-5 mb-2">{renderInline(trimmed.slice(3))}</h2>);
    } else if (trimmed.startsWith("# ")) {
      elements.push(<h1 key={elements.length} className="font-bold text-2xl mt-6 mb-2">{renderInline(trimmed.slice(2))}</h1>);
    } else if (trimmed.startsWith("###### ")) {
      elements.push(<h6 key={elements.length} className="font-semibold text-xs uppercase tracking-wide mt-2 mb-1">{renderInline(trimmed.slice(7))}</h6>);
    } else if (trimmed.startsWith("##### ")) {
      elements.push(<h5 key={elements.length} className="font-semibold text-sm mt-2 mb-1">{renderInline(trimmed.slice(6))}</h5>);
    } else if (trimmed.startsWith("#### ")) {
      elements.push(<h4 key={elements.length} className="font-semibold text-base mt-3 mb-1">{renderInline(trimmed.slice(5))}</h4>);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      list = { type: "ul", items: [...list.items, <li key={list.items.length} className="mb-1">{renderInline(trimmed.slice(2))}</li>] };
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      list = { type: "ol", items: [...list.items, <li key={list.items.length} className="mb-1">{renderInline(trimmed.replace(/^\d+[.)]\s/, ""))}</li>] };
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
  list = flushList(list, elements);
  table = flushTable(table, elements);
  if (inCodeBlock) {
    elements.push(<pre key={elements.length} className="bg-muted p-3 rounded-lg mb-2 overflow-x-auto text-sm"><code>{codeBlockLines.join("\n")}</code></pre>);
  }

  return <>{elements}</>;
}