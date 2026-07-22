import { calendar_v3, gmail_v1, drive_v3, docs_v1, sheets_v4, slides_v1, tasks_v1, people_v1 } from "googleapis";
import { google } from "googleapis";
import type { AppConfig } from "../config.js";
import { getGoogleToken, saveGoogleToken } from "./token-store.js";
import { refreshAccessToken } from "./google-auth.js";
import { logger } from "../../utils/logger.js";

export interface GoogleClients {
	calendar: calendar_v3.Calendar;
	gmail: gmail_v1.Gmail;
	drive: drive_v3.Drive;
	docs: docs_v1.Docs;
	sheets: sheets_v4.Sheets;
	slides: slides_v1.Slides;
	tasks: tasks_v1.Tasks;
	people: people_v1.People;
}

export interface TokenInfo {
	accessToken: string;
	email: string | null;
}

export async function getAccessToken(
	config: AppConfig,
	userId: string
): Promise<TokenInfo> {
	const row = getGoogleToken(userId, config.googleEncryptionKey);
	if (!row) {
		throw new Error("Google not connected. Use /api/google/auth to authenticate first.");
	}

	const now = Date.now();
	let accessToken = row.access_token;
	const refreshTok = row.refresh_token;

	if (refreshTok && row.expiry_date && now >= row.expiry_date - 60000) {
		try {
			const refreshed = await refreshAccessToken(config, refreshTok);
			accessToken = refreshed.access_token;
			saveGoogleToken(userId, {
				access_token: refreshed.access_token,
				refresh_token: refreshed.refresh_token ?? refreshTok,
				scope: refreshed.scope,
				token_type: refreshed.token_type,
				expiry_date: refreshed.expiry_date,
				email: row.email,
				name: row.name,
				avatar_url: row.avatar_url,
			}, config.googleEncryptionKey);
			logger.info(`[GoogleService] Token refreshed for user ${userId}`);
		} catch (err) {
			logger.error(`[GoogleService] Token refresh failed: ${err}`);
			throw new Error("Google session expired. Reconnect at /api/google/auth");
		}
	} else if (!refreshTok && now >= (row.expiry_date ?? 0)) {
		throw new Error("Google session expired. Reconnect at /api/google/auth");
	}

	return {
		accessToken,
		email: row.email,
	};
}

export function createGoogleClients(accessToken: string): GoogleClients {
	const auth = new google.auth.OAuth2();
	auth.setCredentials({ access_token: accessToken });

	return {
		calendar: new calendar_v3.Calendar({ auth }),
		gmail: new gmail_v1.Gmail({ auth }),
		drive: new drive_v3.Drive({ auth }),
		docs: new docs_v1.Docs({ auth }),
		sheets: new sheets_v4.Sheets({ auth }),
		slides: new slides_v1.Slides({ auth }),
		tasks: new tasks_v1.Tasks({ auth }),
		people: new people_v1.People({ auth }),
	};
}
