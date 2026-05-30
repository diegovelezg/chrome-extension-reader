export interface Prompts {
  system: string | null;
  user: (content: string) => string;
}

export const DEFAULT_PROMPTS: Record<string, Prompts> = {
  executive: {
    system: `You are a professional analyst. Your task is to analyze content and provide structured insights.`,
    user: (content: string) => `Analyze the following content and produce:

1. **Executive Summary**: A comprehensive 2-3 paragraph summary that captures the main points, context, and significance.

2. **Key Takeaways**: 3-5 bullet points highlighting the most important insights or actionable items.

Be concise but thorough. Focus on the most valuable information.

---
CONTENT TO ANALYZE:

${content}`,
  },
  distilled: {
    system: `You are a professional editor specializing in content distillation.`,
    user: (content: string) => `Read the following content and produce a concise, distilled summary that captures only the essential information in a compact format.

Requirements:
- Maximum 3-4 paragraphs or 500 words
- Preserve all key facts, data points, and important details
- Remove redundancy and filler content
- Use clear, direct language

---
CONTENT TO DISTILL:

${content}`,
  },
};

export function getPrompt(mode: "executive" | "distilled" | "original", content: string): { system: string | null; user: string } {
  if (mode === "original") {
    return { system: null, user: "" };
  }
  
  const prompt = DEFAULT_PROMPTS[mode];
  return {
    system: prompt.system,
    user: prompt.user(content),
  };
}