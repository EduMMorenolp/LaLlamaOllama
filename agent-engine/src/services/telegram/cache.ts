import { getDb } from "../db/connection.js";
import { logger } from "../../utils/logger.js";

/**
 * Caches Whisper transcriptions keyed by Telegram file_id.
 * Avoids re-transcribing the same audio file if it is re-sent.
 */

export interface TranscriptionCacheEntry {
	file_id: string;
	transcription: string;
	created_at: string;
}

/**
 * Retrieve a cached transcription for a given Telegram file_id.
 * @param fileId - The Telegram file_id
 * @returns The cached transcription text, or null if not found
 */
export function getCachedTranscription(fileId: string): string | null {
	try {
		const db = getDb();
		const row = db
			.prepare("SELECT transcription FROM telegram_transcriptions WHERE file_id = ?")
			.get(fileId) as { transcription: string } | undefined;
		if (row) {
			logger.info(`[TG-Cache] Cache hit for file_id ${fileId.slice(0, 16)}...`);
			return row.transcription;
		}
		return null;
	} catch (err) {
		// Cache is best-effort; don't crash if DB is unavailable
		logger.warn(`[TG-Cache] Error reading cache: ${err instanceof Error ? err.message : String(err)}`);
		return null;
	}
}

/**
 * Save a transcription to the cache.
 * @param fileId - The Telegram file_id
 * @param transcription - The transcribed text
 */
export function saveTranscriptionCache(fileId: string, transcription: string): void {
	if (!transcription) return;
	try {
		const db = getDb();
		db.prepare(
			`INSERT OR REPLACE INTO telegram_transcriptions (file_id, transcription, created_at)
			 VALUES (?, ?, ?)`,
		).run(fileId, transcription, new Date().toISOString());
		logger.info(`[TG-Cache] Saved transcription for file_id ${fileId.slice(0, 16)}...`);
	} catch (err) {
		logger.warn(`[TG-Cache] Error saving cache: ${err instanceof Error ? err.message : String(err)}`);
	}
}
