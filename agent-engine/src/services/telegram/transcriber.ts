import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "@xenova/transformers";
import { logger } from "../../utils/logger.js";

export type TranscriptionCallback = (status: string) => void;

const CACHE_MODEL_DIR = process.env.TRANSFORMERS_CACHE || "/data/transformers";

declare module "querystring" {
	interface ParsedUrlQuery {}
}

let whisperPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getWhisperPipeline(onStatus?: TranscriptionCallback) {
	if (!whisperPipeline) {
		onStatus?.("Cargando modelo Whisper (primera vez puede tomar varios segundos)...");
		logger.info(`[Whisper] Loading model from cache: ${CACHE_MODEL_DIR}`);
		whisperPipeline = await pipeline("automatic-speech-recognition", "Xenova/whisper-small", {
			cache_dir: CACHE_MODEL_DIR,
			quantized: true,
		});
		logger.info("[Whisper] Model loaded successfully");
	}
	return whisperPipeline;
}

/**
 * Decode an audio file to 16kHz mono PCM samples using ffmpeg.
 */
function decodeAudioToPcm(filePath: string): Promise<Float32Array> {
	return new Promise((resolve, reject) => {
		const ffmpeg = spawn("ffmpeg", [
			"-i", filePath,
			"-f", "wav",
			"-acodec", "pcm_s16le",
			"-ac", "1",
			"-ar", "16000",
			"-",
		], { stdio: ["ignore", "pipe", "pipe"] });

		const chunks: Buffer[] = [];
		ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));

		let stderrBuffer = "";
		ffmpeg.stderr.on("data", (data: Buffer) => {
			stderrBuffer += data.toString();
		});

		ffmpeg.on("close", (code) => {
			if (code !== 0) {
				logger.error(`[Whisper] ffmpeg exited with code ${code}: ${stderrBuffer.slice(0, 200)}`);
				reject(new Error(`ffmpeg error (code ${code})`));
				return;
			}

			const wavBuffer = Buffer.concat(chunks);
			if (wavBuffer.length < 44) {
				reject(new Error("WAV too small"));
				return;
			}

			// Parse WAV header: PCM data starts at byte 44 for standard WAV
			const bitsPerSample = wavBuffer.readUInt16LE(34);
			const dataSize = wavBuffer.readUInt32LE(40);
			const rawData = wavBuffer.subarray(44, 44 + dataSize);

			let samples: Float32Array;
			if (bitsPerSample === 16) {
				const int16 = new Int16Array(rawData.buffer, rawData.byteOffset, rawData.byteLength / 2);
				samples = new Float32Array(int16.length);
				for (let i = 0; i < int16.length; i++) {
					samples[i] = int16[i] / 32768;
				}
			} else if (bitsPerSample === 32) {
				// 32-bit float PCM
				samples = new Float32Array(rawData.buffer, rawData.byteOffset, rawData.byteLength / 4);
			} else {
				reject(new Error(`Unsupported bits per sample: ${bitsPerSample}`));
				return;
			}

			logger.info(`[Whisper] Audio decoded: ${samples.length} samples, ${(samples.length / 16000).toFixed(1)}s`);
			resolve(samples);
		});

		ffmpeg.on("error", (err) => {
			logger.error(`[Whisper] ffmpeg spawn error: ${err.message}`);
			reject(err);
		});
	});
}

export async function transcribeWithWhisper(
	filePath: string,
	onStatus?: TranscriptionCallback,
): Promise<string> {
	try {
		if (!process.env.TRANSFORMERS_CACHE) {
			process.env.TRANSFORMERS_CACHE = CACHE_MODEL_DIR;
		}

		if (!fs.existsSync(filePath)) {
			logger.warn(`[Whisper] File not found: ${filePath}`);
			return "";
		}

		const stat = fs.statSync(filePath);
		if (stat.size === 0) {
			logger.warn(`[Whisper] Empty audio file: ${filePath}`);
			return "";
		}

		logger.info(`[Whisper] Transcribing ${path.basename(filePath)} (${(stat.size / 1024).toFixed(1)} KB)`);

		onStatus?.("Leyendo archivo de audio...");
		const audioSamples = await decodeAudioToPcm(filePath);

		onStatus?.("Transcribiendo audio con Whisper...");
		const transcriber = await getWhisperPipeline(onStatus);

		const result = await (transcriber as (...args: unknown[]) => unknown)(audioSamples, {
			language: "spanish",
			task: "transcribe",
			return_timestamps: false,
		}) as { text: string };

		const text = result.text?.trim() || "";
		if (text) {
			logger.info(`[Whisper] Transcription complete: "${text.slice(0, 100)}..." (${text.length} chars)`);
		} else {
			logger.warn("[Whisper] Empty transcription result");
		}

		return text;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.error(`[Whisper] Transcription failed: ${msg}`);
		return "";
	}
}
