import type { AppConfig } from "../config.js";

export function buildSystemPrompt(
	config: AppConfig,
	activeModel?: string
): string {
	return `Eres un asistente conversacional para el proyecto LaLlamaOllama.
Responde en español con naturalidad, adaptando tu longitud al mensaje del usuario.
Cuando el usuario pregunte qué herramientas tienes, enumera las herramientas disponibles.
Si el usuario pide buscar archivos, editar código, analizar el proyecto o ejecutar comandos, usa las herramientas correspondientes.
Para conversación normal, responde directamente sin preámbulos ni disculpas.
Modelo activo: ${activeModel || config.defaultModel}`;
}
