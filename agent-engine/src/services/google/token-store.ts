import crypto from "node:crypto";
import { getDb } from "../db/connection.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(raw: string): Buffer {
	if (raw.length !== 64) {
		throw new Error("GOOGLE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
	}
	return Buffer.from(raw, "hex");
}

function encrypt(text: string, keyHex: string): string {
	if (!keyHex) return text;
	const key = getEncryptionKey(keyHex);
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");
	const authTag = cipher.getAuthTag().toString("hex");
	return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(encoded: string, keyHex: string): string {
	if (!keyHex) return encoded;
	const key = getEncryptionKey(keyHex);
	const parts = encoded.split(":");
	if (parts.length !== 3) return encoded;
	const iv = Buffer.from(parts[0], "hex");
	const authTag = Buffer.from(parts[1], "hex");
	const encrypted = parts[2];
	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	let decrypted = decipher.update(encrypted, "hex", "utf8");
	decrypted += decipher.final("utf8");
	return decrypted;
}

export interface GoogleTokenRow {
	user_id: string;
	access_token: string;
	refresh_token: string | null;
	scope: string;
	token_type: string;
	expiry_date: number | null;
	email: string | null;
	name: string | null;
	avatar_url: string | null;
}

export function saveGoogleToken(
	userId: string,
	token: Omit<GoogleTokenRow, "user_id">,
	encryptionKey: string
): void {
	const db = getDb();
	db.prepare(`
		INSERT INTO google_tokens (user_id, access_token, refresh_token, scope, token_type, expiry_date, email, name, avatar_url, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id) DO UPDATE SET
			access_token = excluded.access_token,
			refresh_token = excluded.refresh_token,
			scope = excluded.scope,
			token_type = excluded.token_type,
			expiry_date = excluded.expiry_date,
			email = excluded.email,
			name = excluded.name,
			avatar_url = excluded.avatar_url,
			updated_at = CURRENT_TIMESTAMP
	`).run(
		userId,
		encrypt(token.access_token, encryptionKey),
		token.refresh_token ? encrypt(token.refresh_token, encryptionKey) : null,
		token.scope,
		token.token_type,
		token.expiry_date ?? null,
		token.email ?? null,
		token.name ?? null,
		token.avatar_url ?? null,
	);
}

export function getGoogleToken(userId: string, encryptionKey: string): GoogleTokenRow | null {
	const db = getDb();
	const row = db.prepare("SELECT * FROM google_tokens WHERE user_id = ?").get(userId) as Record<string, unknown> | undefined;
	if (!row) return null;
	return {
		user_id: row.user_id as string,
		access_token: decrypt(row.access_token as string, encryptionKey),
		refresh_token: row.refresh_token ? decrypt(row.refresh_token as string, encryptionKey) : null,
		scope: row.scope as string,
		token_type: row.token_type as string,
		expiry_date: row.expiry_date as number | null,
		email: row.email as string | null,
		name: row.name as string | null,
		avatar_url: row.avatar_url as string | null,
	};
}

export function deleteGoogleToken(userId: string): void {
	const db = getDb();
	db.prepare("DELETE FROM google_tokens WHERE user_id = ?").run(userId);
}

export function getAllGoogleTokens(encryptionKey: string): GoogleTokenRow[] {
	const db = getDb();
	const rows = db.prepare("SELECT * FROM google_tokens").all() as Record<string, unknown>[];
	return rows.map((row) => ({
		user_id: row.user_id as string,
		access_token: decrypt(row.access_token as string, encryptionKey),
		refresh_token: row.refresh_token ? decrypt(row.refresh_token as string, encryptionKey) : null,
		scope: row.scope as string,
		token_type: row.token_type as string,
		expiry_date: row.expiry_date as number | null,
		email: row.email as string | null,
		name: row.name as string | null,
		avatar_url: row.avatar_url as string | null,
	}));
}

export function googleTokenExists(userId: string): boolean {
	const db = getDb();
	const row = db.prepare("SELECT 1 FROM google_tokens WHERE user_id = ?").get(userId);
	return !!row;
}
