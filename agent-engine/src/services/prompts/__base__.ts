import type { PromptDefinition } from "./index.js";

const base: PromptDefinition = {
  temperature: 0.7,
  history_limit: 10,
  tool_policy: "restricted",
  tools: [],
  sections: {},
};

export default base;
