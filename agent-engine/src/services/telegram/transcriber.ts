import * as fs from "node:fs";
import { logger } from "../../utils/logger.js";

/**
 * Callback type for transcription progress.
 */
export type TranscriptionCallback = (status: string) => void;

/**
 * Transcribe an audio file using Whisper via Ollama.
 *
 * Calls Ollama's generate API directly with the whisper model.
 * The audio file is sent as a base64 data URI.
 *
 * @param filePath - Absolute path to the audio file on disk
 * @param onStatus  - Optional callback for status updates
 * @returns The transcribed text, or empty string on failure
 */
export async function transcribeWithWhisper(
	filePath: string,
	onStatus?: TranscriptionCallback,
): Promise<string> {
	try {
		// Verify file exists
		if (!fs.existsSync(filePath)) {
			logger.warn(`[Whisper] File not found: ${filePath}`);
			return "";
		}

		const stat = fs.statSync(filePath);
		if (stat.size === 0) {
			logger.warn(`[Whisper] Empty audio file: ${filePath}`);
			return "";
		}

		// Read and encode the audio file
		onStatus?.("Leyendo archivo de audio...");
		const fileBuffer = fs.readFileSync(filePath);
		const base64Audio = fileBuffer.toString("base64");

		// Determine the audio MIME type from file extension
		const ext = filePath.split(".").pop()?.toLowerCase() || "ogg";
		const mimeMap: Record<string, string> = {
			ogg: "audio/ogg",
			mp3: "audio/mpeg",
			wav: "audio/wav",
			m4a: "audio/mp4",
			mp4: "audio/mp4",
			wma: "audio/x-ms-wma",
			flac: "audio/flac",
			webm: "audio/webm",
		};
		const mime = mimeMap[ext] || "audio/ogg";

		// Call Ollama generate API with whisper model
		onStatus?.("Transcribiendo audio con Whisper...");
		logger.info(`[Whisper] Transcribing ${filePath} (${(stat.size / 1024).toFixed(1)} KB)`);

		// Determine the Ollama URL.
		// Inside Docker: http://ollama:11434 (service name in docker-compose)
		// Outside Docker: http://localhost:11434
		// Override via OLLAMA_URL env var
		const ollamaBaseUrl = process.env.OLLAMA_URL || "http://ollama:11434";

		const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: "whisper-small",
				file: `data:${mime};base64,${base64Audio}`,
				options: {
					temperature: 0,
				},
			}),
			signal: AbortSignal.timeout(120_000), // 2min timeout for long audio
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "unknown");
			const isModelNotFound = response.status === 404 && errorText.includes("not found");

			if (isModelNotFound) {
				logger.warn(`[Whisper] Model 'whisper-small' no encontrado. Intentando descargar...`);
				onStatus?.("Descargando modelo Whisper (primera vez)...");

				// Intentar hacer pull del modelo automáticamente
				try {
					const pullResponse = await fetch(`${ollamaBaseUrl}/api/pull`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ model: "whisper-small" }),
						signal: AbortSignal.timeout(300_000), // 5min timeout for download
					});

					if (!pullResponse.ok) {
						const pullError = await pullResponse.text().catch(() => "unknown");
						logger.error(`[Whisper] Auto-pull failed: ${pullResponse.status} ${pullError.slice(0, 200)}`);
						return "";
					}

					// Leer el stream de pull (progress)
					const pullText = await pullResponse.text();
					const pullLines = pullText.trim().split("\n").filter(Boolean);
					for (const line of pullLines) {
						try {
							const p = JSON.parse(line) as { status?: string; error?: string };
							if (p.error) {
								logger.error(`[Whisper] Pull error: ${p.error}`);
								return "";
							}
							if (p.status) logger.info(`[Whisper] Pull: ${p.status}`);
						} catch { /* skip */ }
					}

					onStatus?.("Modelo Whisper descargado. Transcribiendo...");
					logger.info(`[Whisper] Modelo descargado exitosamente. Reintentando transcripción...`);

					// Reintentar la transcripción
					const retryResponse = await fetch(`${ollamaBaseUrl}/api/generate`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							model: "whisper-small",
							file: `data:${mime};base64,${base64Audio}`,
							options: { temperature: 0 },
						}),
						signal: AbortSignal.timeout(120_000),
					});

					if (retryResponse.ok) {
						// Reemplazar response para continuar con el procesamiento normal
						return await processNdJsonResponse(await retryResponse.text());
					}

					const retryError = await retryResponse.text().catch(() => "unknown");
					logger.error(`[Whisper] Retry failed: ${retryResponse.status} ${retryError.slice(0, 200)}`);
					return "";
				} catch (pullErr) {
					const pullMsg = pullErr instanceof Error ? pullErr.message : String(pullErr);
					logger.error(`[Whisper] Auto-pull error: ${pullMsg}`);
					return "";
				}
			}

			logger.error(`[Whisper] Ollama API error: ${response.status} ${errorText.slice(0, 200)}`);
			return "";
		}

		// Ollama generate API returns a JSON stream; collect all response parts
		onStatus?.("Procesando transcripción...");
		const ndjsonText = await response.text();
		return await processNdJsonResponse(ndjsonText);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.error(`[Whisper] Transcription failed: ${msg}`);
		return "";
	}
}

/**
 * Parse Ollama NDJSON response for generate API.
 */
async function processNdJsonResponse(text: string): Promise<string> {
	const lines = text.trim().split("\n").filter(Boolean);
	let fullTranscription = "";

	for (const line of lines) {
		try {
			const parsed = JSON.parse(line) as { response?: string; done?: boolean; error?: string };
			if (parsed.error) {
				logger.error(`[Whisper] Model error: ${parsed.error}`);
				return "";
			}
			if (parsed.response) {
				fullTranscription += parsed.response;
			}
			if (parsed.done) {
				break;
			}
		} catch {
			// skip malformed lines
		}
	}

	const trimmed = fullTranscription.trim();
	if (trimmed) {
		logger.info(`[Whisper] Transcription complete: ${trimmed.length} chars`);
	} else {
		logger.warn("[Whisper] Empty transcription result");
	}

	return trimmed;
}
