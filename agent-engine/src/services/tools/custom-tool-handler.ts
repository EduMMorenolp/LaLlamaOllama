import { exec } from "node:child_process";
import { promisify } from "node:util";
import axios from "axios";
import type { ToolContext } from "./types.js";

const execAsync = promisify(exec);

/**
 * Sustituye {{param}} en un template con valores reales.
 */
function substituteParams(template: string, args: Record<string, unknown>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
		const val = args[key];
		if (val === undefined || val === null) return `{{${key}}}`;
		return String(val);
	});
}

/**
 * Ejecuta un handler de tipo "bash": corre un comando con parámetros sustituidos.
 */
async function handleBash(
	handlerConfig: Record<string, unknown>,
	args: Record<string, unknown>,
	context: ToolContext,
): Promise<string> {
	const commandTemplate = (handlerConfig.command as string) || "";
	if (!commandTemplate) {
		return "Error: No hay comando configurado para esta herramienta.";
	}

	const command = substituteParams(commandTemplate, args);
	const timeout = (handlerConfig.timeout as number) || 30000;
	const workdir = handlerConfig.workdir
		? `${context.workspaceDir}/${handlerConfig.workdir}`
		: context.workspaceDir;

	try {
		const { stdout, stderr } = await execAsync(command, {
			timeout,
			cwd: workdir,
			maxBuffer: 10 * 1024 * 1024,
		});

		let result = "";
		if (stdout) result += `STDOUT:\n${stdout.substring(0, 50000)}`;
		if (stderr) result += `\nSTDERR:\n${stderr.substring(0, 10000)}`;
		if (!result.trim()) result = "(comando ejecutado sin salida)";

		return result;
	} catch (err: unknown) {
		const error = err as Error & { stdout?: string; stderr?: string };
		let msg = `Error: ${error.message || String(err)}`;
		if (error.stdout) msg += `\nSTDOUT:\n${error.stdout.substring(0, 10000)}`;
		if (error.stderr) msg += `\nSTDERR:\n${error.stderr.substring(0, 10000)}`;
		return msg;
	}
}

/**
 * Ejecuta un handler de tipo "http": hace una request HTTP con parámetros sustituidos.
 */
async function handleHttp(
	handlerConfig: Record<string, unknown>,
	args: Record<string, unknown>,
): Promise<string> {
	const urlTemplate = (handlerConfig.url as string) || "";
	const method = (handlerConfig.method as string)?.toUpperCase() || "GET";
	const bodyTemplate = handlerConfig.body ? (handlerConfig.body as string) : undefined;
	const headers: Record<string, string> = (handlerConfig.headers as Record<string, string>) || {};

	if (!urlTemplate) {
		return "Error: No hay URL configurada para esta herramienta.";
	}

	const url = substituteParams(urlTemplate, args);

	try {
		const mergedHeaders: Record<string, string> = {
			"User-Agent": "LaLlamaOllama-CustomTool/1.0",
			...headers,
		};

		const httpConfig: Record<string, unknown> = {
			url,
			method,
			timeout: 15000,
			headers: mergedHeaders,
		};

		if (bodyTemplate) {
			httpConfig.data = substituteParams(bodyTemplate, args);
			if (!mergedHeaders["Content-Type"]) {
				mergedHeaders["Content-Type"] = "application/json";
			}
		}

		const res = await axios(httpConfig);

		const resultData = typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
		return [
			`## HTTP ${method} ${url}`,
			`**Status**: ${res.status}`,
			``,
			`${resultData.substring(0, 50000)}`,
		].join("\n");
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		if (axios.isAxiosError(err) && err.response) {
			const data = typeof err.response.data === "string"
				? err.response.data
				: JSON.stringify(err.response.data);
			return `Error HTTP ${err.response.status}: ${data.substring(0, 5000)}`;
		}
		return `Error en la petición HTTP: ${msg}`;
	}
}

/**
 * Ejecuta un handler de tipo "prompt": formatea el prompt y lo devuelve.
 * NOTA: El prompt se devuelve como texto formateado para que el agente lo procese.
 */
async function handlePrompt(
	handlerConfig: Record<string, unknown>,
	args: Record<string, unknown>,
): Promise<string> {
	const promptTemplate = (handlerConfig.prompt as string) || "";
	if (!promptTemplate) {
		return "Error: No hay prompt configurado para esta herramienta.";
	}

	const prompt = substituteParams(promptTemplate, args);

	// Devolver el prompt formateado como si fuera una respuesta del sistema
	return [
		`## Prompt generado por herramienta custom`,
		``,
		`${prompt}`,
	].join("\n");
}

/**
 * Dispatcher principal para herramientas custom.
 */
export async function executeCustomTool(
	handlerType: "bash" | "prompt" | "http",
	handlerConfig: Record<string, unknown>,
	args: Record<string, unknown>,
	context: ToolContext,
): Promise<string> {
	switch (handlerType) {
		case "bash":
			return handleBash(handlerConfig, args, context);
		case "http":
			return handleHttp(handlerConfig, args);
		case "prompt":
			return handlePrompt(handlerConfig, args);
		default:
			return `Error: Tipo de handler desconocido: ${handlerType}`;
	}
}
