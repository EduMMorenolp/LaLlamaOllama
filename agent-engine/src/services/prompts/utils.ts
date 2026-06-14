import type { PromptSectionKey } from "./types.js";

const REG_SECTION = /<(\w+)>([\s\S]*?)<\/\1>/g;

function extractSections(prompt: string): Map<string, string> {
  const map = new Map<string, string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(REG_SECTION.source, "g");
  while ((match = re.exec(prompt)) !== null) {
    map.set(match[1], match[2].trim());
  }
  return map;
}

export function composeSystemPrompt(sections: Record<string, string | undefined>): string {
  const order: PromptSectionKey[] = [
    "identity",
    "purpose",
    "behavior",
    "output_format",
    "examples",
    "tools_guidelines",
    "mode_switching",
  ];
  const parts: string[] = [];
  for (const key of order) {
    const val = sections[key];
    if (val) {
      parts.push(`<${key}>\n${val.trim()}\n</${key}>`);
    }
  }
  return parts.join("\n\n");
}

export function mergeSystemPrompts(parentPrompt: string, childPrompt: string): string {
  const parentSections = extractSections(parentPrompt);
  const childSections = extractSections(childPrompt);
  for (const [tag, content] of childSections) {
    parentSections.set(tag, content);
  }
  const merged: Record<string, string> = {};
  for (const [tag, content] of parentSections) {
    merged[tag] = content;
  }
  return composeSystemPrompt(merged);
}

export function parsePromptIntoSections(prompt: string): Record<string, string> {
  const sections = extractSections(prompt);
  const result: Record<string, string> = {};
  for (const [tag, content] of sections) {
    result[tag] = content;
  }
  return result;
}
