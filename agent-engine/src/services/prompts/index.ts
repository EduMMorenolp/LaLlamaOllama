import type { PromptDefinition } from "./types.js";

export type { PromptDefinition, PromptSectionKey } from "./types.js";
export { composeSystemPrompt, mergeSystemPrompts, parsePromptIntoSections } from "./utils.js";
import { composeSystemPrompt, mergeSystemPrompts } from "./utils.js";

export { default as basePrompt } from "./__base__.js";
export { default as asistentePrompt } from "./asistente.js";
export { default as investigadorPrompt } from "./investigador.js";
export { default as coachPersonalPrompt } from "./coach-personal.js";
export { default as evolutivoPrompt } from "./evolutivo.js";
export { default as planificadorPrompt } from "./planificador.js";
export { default as tutorEducadorPrompt } from "./tutor-educador.js";
export { default as escritorCreativoPrompt } from "./escritor-creativo.js";
export { default as aprendizajePrompt } from "./aprendizaje.js";
export { subAgentTemplates, type SubAgentDefinition, getSubAgentTemplate } from "./sub-agents.js";

import baseDef from "./__base__.js";
import asistenteDef from "./asistente.js";
import investigadorDef from "./investigador.js";
import coachPersonalDef from "./coach-personal.js";
import evolutivoDef from "./evolutivo.js";
import planificadorDef from "./planificador.js";
import tutorEducadorDef from "./tutor-educador.js";
import escritorCreativoDef from "./escritor-creativo.js";
import aprendizajeDef from "./aprendizaje.js";

const modeDefinitions: Record<string, PromptDefinition> = {
  __base__: baseDef,
  asistente: asistenteDef,
  investigador: investigadorDef,
  "coach-personal": coachPersonalDef,
  evolutivo: evolutivoDef,
  planificador: planificadorDef,
  "tutor-educador": tutorEducadorDef,
  "escritor-creativo": escritorCreativoDef,
  aprendizaje: aprendizajeDef,
};

export function getModeDefinition(name: string): PromptDefinition | undefined {
  return modeDefinitions[name];
}

export function getAllModeDefinitions(): Record<string, PromptDefinition> {
  return { ...modeDefinitions };
}

export function resolveModePrompt(name: string): string {
  function resolve(defName: string, visited: Set<string>): string {
    if (visited.has(defName)) {
      throw new Error(`Circular extends detected for mode '${defName}'`);
    }
    const def = modeDefinitions[defName];
    if (!def) {
      throw new Error(`Mode definition '${defName}' not found`);
    }
    visited.add(defName);

    let parentPrompt = "";
    if (def.extends) {
      parentPrompt = resolve(def.extends, visited);
    }

    const childPrompt = composeSystemPrompt(def.sections as Record<string, string>);
    if (!parentPrompt) return childPrompt;
    return mergeSystemPrompts(parentPrompt, childPrompt);
  }

  return resolve(name, new Set());
}

export function getModeSeedData(name: string): {
  system_prompt: string;
  tools: string[];
  model: string;
  temperature: number;
  history_limit: number;
  tool_policy: "auto" | "restricted" | "ask_user";
  extends: string | null;
} | undefined {
  const def = modeDefinitions[name];
  if (!def || name === "__base__") return undefined;
  return {
    system_prompt: resolveModePrompt(name),
    tools: def.tools,
    model: def.model || "",
    temperature: def.temperature,
    history_limit: def.history_limit,
    tool_policy: def.tool_policy,
    extends: def.extends || null,
  };
}
