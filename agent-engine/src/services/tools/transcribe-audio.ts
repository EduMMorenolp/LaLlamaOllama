import * as fs from "node:fs";
import { toolRegistry } from "./registry.js";
import { transcribeWithWhisper } from "../telegram/transcriber.js";
import type { ToolContext } from "./types.js";
import { logger } from "../../utils/logger.js";

/**
 * Tool: transcribe_audio
 *
 * Allows any agent to transcribe an audio file using Whisper via Ollama.
 * Useful for processing voice notes, meeting recordings, or any audio file
 * in the workspace.
 */
export function registerTranscribeAudioTool(): void {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "transcribe_audio",
				description:
					"Transcribe audio a texto usando Whisper.",
				parameters: {
					type: "object",
					properties: {
						file_path: {
							type: "string",
							description:
								"Ruta absoluta al archivo de audio en el workspace.",
						},
					},
					required: ["file_path"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _context: ToolContext): Promise<string> => {
			const filePath = (args.file_path as string || "").trim();

			if (!filePath) {
				return "Error: Debes proporcionar la ruta del archivo de audio (file_path).";
			}

			if (!fs.existsSync(filePath)) {
				return `Error: El archivo no existe en la ruta especificada: ${filePath}`;
			}

			const stat = fs.statSync(filePath);
			if (stat.size === 0) {
				return "Error: El archivo de audio está vacío.";
			}

			// Basic file size limit: 50MB
			if (stat.size > 50 * 1024 * 1024) {
				return `Error: El archivo es demasiado grande (${(stat.size / 1024 / 1024).toFixed(1)} MB). El límite es 50 MB.`;
			}

			logger.info(`[Tool:transcribe_audio] Transcribing: ${filePath} (${(stat.size / 1024).toFixed(1)} KB)`);

			try {
				const transcription = await transcribeWithWhisper(filePath);

				if (!transcription) {
					return "No se pudo transcribir el audio. El modelo Whisper no devolvió texto. " +
						"Verifica que el archivo contenga voz y que el modelo 'whisper-small' esté disponible " +
						"(ejecuta: ollama pull whisper-small).";
				}

				return `✅ Transcripción completada (${transcription.length} caracteres):\n\n${transcription}`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error(`[Tool:transcribe_audio] Error: ${msg}`);
				return `Error al transcribir el audio: ${msg}`;
			}
		},
		enabled: true,
	});
}
