import { createClient, getDefaultModelConfig } from "./createClient.js";
import { getGeneralConfig } from "../db/experts.js";
import type { AppConfig } from "../config.js";
import type { BrainClient } from "../brain/client.js";

export async function generateSuggestions(
  chatId: string,
  userText: string,
  assistantText: string,
  config: AppConfig,
  brain: BrainClient,
  onSuggestions: (suggestions: string[]) => void
): Promise<void> {
  try {
    const generalConfig = getGeneralConfig();
    const model = generalConfig?.model || config.defaultModel;
    const modelConfig = getDefaultModelConfig(config);
    modelConfig.model = model;
    const client = createClient(modelConfig);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Genera 2-3 preguntas de seguimiento cortas (máx 8 palabras cada una) basadas en esta conversación. Responde SOLO con un array JSON de strings, nada más. Ejemplo: [\"¿Puedes explicar más?\", \"¿Qué alternativas hay?\"]" },
        { role: "user", content: userText },
        { role: "assistant", content: assistantText },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "[]";
    let suggestions: string[] = [];
    try {
      const match = content.match(/[[sS]*]/);
      if (match) {
        suggestions = JSON.parse(match[0]);
      }
    } catch {
      suggestions = content.split("\n").filter(l => l.trim() && !l.startsWith("{") && !l.startsWith("}")).map(l => l.replace(/^d+[.)]s*/, "").trim()).filter(Boolean);
    }

    if (Array.isArray(suggestions) && suggestions.length > 0) {
      onSuggestions(suggestions.slice(0, 3));
    }
  } catch {
    // Silently fail - suggestions are optional
  }
}
