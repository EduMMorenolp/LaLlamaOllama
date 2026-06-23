import crypto from "node:crypto";
import type { OllamaService } from "../ollama/ollama.service.js";
import logger from "../utils/logger.js";

export interface FileNode {
	name: string;
	type: "file" | "directory";
	size?: number;
	children?: FileNode[];
}

export interface GeneratedFile {
	path: string;
	content: string;
}

export interface AgentGenerationResponse {
	projectName: string;
	analysis: string;
	agents: GeneratedFile[];
	rules: GeneratedFile[];
	workflows: GeneratedFile[];
}

export class AgentsService {
	private lastPromptHash: string = "";
	private lastPrompt: string = "";

	constructor(private readonly ollamaService: OllamaService) {}

	/**
	 * Convierte un árbol FileNode a string indentado (formato tree)
	 */
	private treeToString(node: FileNode, indent = ""): string {
		const prefix = node.type === "directory" ? "📁" : "📄";
		let result = `${indent}${prefix} ${node.name}\n`;
		if (node.children) {
			for (const child of node.children) {
				result += this.treeToString(child, `${indent}  `);
			}
		}
		return result;
	}

	/**
	 * Construye el prompt con la estructura del proyecto y los archivos de configuración
	 */
	private buildPrompt(
		projectName: string,
		structure: FileNode,
		configFiles: Record<string, string>,
	): string {
		const treeStr = this.treeToString(structure);

		let configsStr = "";
		for (const [filePath, content] of Object.entries(configFiles)) {
			configsStr += `\n--- ${filePath} ---\n${content}\n`;
		}

		return `Eres un arquitecto experto en agentes OpenCode AI.

Analiza la estructura del proyecto "${projectName}" y genera una configuración completa de agentes OpenCode, reglas y workflows.

ESTRUCTURA DEL PROYECTO:
\`\`\`
${treeStr}
\`\`\`

ARCHIVOS DE CONFIGURACIÓN:
${configsStr || "(no se proporcionaron archivos de configuración adicionales)"}

INSTRUCCIONES:
1. Identifica los dominios principales del proyecto (backend/, frontend/, docker/, etc.)
2. Por cada dominio, genera un agente subagente OpenCode con permisos scoped a ese directorio
3. Genera un agente orquestador que delegue en todos los subagentes
4. Genera rules (reglas) para cada dominio
5. Genera workflows típicos: session-start, deploy, etc.
6. TODOS los archivos de agente deben incluir conexión al cerebro MCP en http://localhost:3015/sse

Responde SOLAMENTE con JSON válido, sin markdown ni explicaciones adicionales.
Usa este formato exacto:

{
  "projectName": "${projectName}",
  "analysis": "Análisis breve de la estructura del proyecto y qué agentes se crearon",
  "agents": [
    {
      "path": ".opencode/agents/orchestrator.md",
      "content": "---\nname: orchestrator\ndescription: ...\n..."
    }
  ],
  "rules": [
    {
      "path": ".agents/rules/backend.md",
      "content": "---\ntrigger: always_on\n..."
    }
  ],
  "workflows": [
    {
      "path": ".agents/workflows/session-start.md",
      "content": "---\ndescription: ...\n..."
    }
  ]
}

REGLAS PARA EL CONTENIDO DE CADA ARCHIVO:
- **Agentes**: Deben tener frontmatter YAML con name, description, mode (subagent o primary), permission scoped. Incluir stack tecnológico, flujo de trabajo con mem_save obligatorio, y la conexión MCP.
- **Reglas**: Deben tener frontmatter con trigger, glob, description. Incluir reglas específicas del dominio.
- **Workflows**: Deben tener frontmatter con description. Incluir pasos detallados con comandos MCP.
- **Conexión Brain MCP**: En cada agente agregar "URL del cerebro MCP: http://localhost:3015/sse" y el workflow de memoria.
- **Nombres de archivo**: Usar kebab-case, ej: backend-dev.md, frontend-dev.md
- **No incluir** archivos node_modules, .git, dist, build, .next, etc. en el análisis.
- Genera al menos 2 subagentes y 1 orquestador.`;
	}

	/**
	 * Versión cacheada de buildPrompt.
	 * Genera un hash MD5 de los inputs y solo recompila si cambiaron.
	 */
	private buildPromptCached(
		projectName: string,
		structure: FileNode,
		configFiles: Record<string, string>,
	): string {
		const input = projectName + JSON.stringify({ structure, configFiles });
		const hash = crypto.createHash("md5").update(input).digest("hex");

		if (hash === this.lastPromptHash) {
			return this.lastPrompt;
		}

		this.lastPrompt = this.buildPrompt(projectName, structure, configFiles);
		this.lastPromptHash = hash;
		return this.lastPrompt;
	}

	/**
	 * Analiza la estructura del proyecto usando un modelo Ollama y genera agentes
	 */
	async analyzeProject(
		model: string,
		projectName: string,
		structure: FileNode,
		configFiles: Record<string, string>,
	): Promise<AgentGenerationResponse> {
		const prompt = this.buildPromptCached(projectName, structure, configFiles);

		const response = await this.ollamaService.chat(model, [
			{
				role: "system",
				content:
					"Eres un arquitecto de agentes OpenCode AI. Siempre respondes con JSON válido.",
			},
			{ role: "user", content: prompt },
		]);

		const rawContent = response.message.content;

		// Extraer JSON de la respuesta (el modelo podría incluir markdown)
		let jsonStr = rawContent.trim();
		// Quitar posibles bloques de código markdown
		const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (jsonMatch) {
			jsonStr = jsonMatch[1].trim();
		}

		try {
			const parsed = JSON.parse(jsonStr) as AgentGenerationResponse;
			return {
				projectName: parsed.projectName || projectName,
				analysis: parsed.analysis || "Análisis generado por IA",
				agents: parsed.agents || [],
				rules: parsed.rules || [],
				workflows: parsed.workflows || [],
			};
		} catch (parseError) {
			logger
				.child({ component: "agents" })
				.error(
					{ err: parseError, rawContent: rawContent.substring(0, 500) },
					"Error parsing LLM response",
				);
			throw new Error(
				`El modelo no generó una respuesta JSON válida. Respuesta cruda:\n${rawContent.substring(0, 500)}`,
			);
		}
	}
}
