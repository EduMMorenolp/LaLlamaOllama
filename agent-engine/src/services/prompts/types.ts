export type PromptSectionKey =
  | "identity"
  | "purpose"
  | "behavior"
  | "output_format"
  | "examples"
  | "tools_guidelines"
  | "mode_switching";

export interface PromptDefinition {
  extends?: string;
  sections: Partial<Record<PromptSectionKey, string>>;
  tools: string[];
  model?: string;
  temperature: number;
  history_limit: number;
  tool_policy: "auto" | "restricted" | "ask_user";
  usage_count?: number;
  last_used?: string | null;
}
