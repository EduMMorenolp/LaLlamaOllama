import type { AppConfig } from "../config.js";
import type { DockerInfo } from "../docker-info.js";
import { formatDockerInfo } from "../docker-info.js";

export function buildSystemPrompt(
	config: AppConfig,
	activeModel?: string
): string {
	const dockerSection = config.dockerInfo
		? `\n\n${formatDockerInfo(config.dockerInfo)}`
		: "";

	return `Eres un asistente conversacional para el proyecto LaLlamaOllama.
Responde en español con naturalidad, adaptando tu longitud al mensaje del usuario.
Cuando el usuario pregunte qué herramientas tienes, enumera las herramientas disponibles.
Si el usuario pide buscar archivos, editar código, analizar el proyecto o ejecutar comandos, usa las herramientas correspondientes.
Para conversación normal, responde directamente sin preámbulos ni disculpas.
Modelo activo: ${activeModel || config.defaultModel}${dockerSection}`;
}

/**
 * Build the environment/system context block that gets injected into
 * the session. This includes Docker environment information so the
 * agent is aware of its own capacity and surroundings.
 */
export function buildEnvironmentContext(dockerInfo?: DockerInfo): string {
	if (!dockerInfo) return "";
	return formatDockerInfo(dockerInfo);
}
