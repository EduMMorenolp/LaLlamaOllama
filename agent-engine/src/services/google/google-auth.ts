import { OAuth2Client } from "google-auth-library";
import type { AppConfig } from "../config.js";
import { logger } from "../../utils/logger.js";

let _oauthClient: OAuth2Client | null = null;

const SCOPES = [
	"https://www.googleapis.com/auth/calendar",
	"https://www.googleapis.com/auth/calendar.events",
	"https://www.googleapis.com/auth/gmail.modify",
	"https://www.googleapis.com/auth/drive",
	"https://www.googleapis.com/auth/documents",
	"https://www.googleapis.com/auth/spreadsheets",
	"https://www.googleapis.com/auth/presentations",
	"https://www.googleapis.com/auth/tasks",
	"https://www.googleapis.com/auth/contacts",
];

export function getOAuthClient(config: AppConfig): OAuth2Client {
	if (_oauthClient) return _oauthClient;
	if (!config.googleClientId || !config.googleClientSecret) {
		throw new Error("Google OAuth not configured: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required");
	}
	_oauthClient = new OAuth2Client({
		clientId: config.googleClientId,
		clientSecret: config.googleClientSecret,
		redirectUri: config.googleRedirectUri,
	});
	return _oauthClient;
}

export function getAuthUrl(config: AppConfig): string {
	const oauth = getOAuthClient(config);
	return oauth.generateAuthUrl({
		access_type: "offline",
		prompt: "consent",
		scope: SCOPES,
	});
}

export async function exchangeCodeForTokens(
	config: AppConfig,
	code: string
): Promise<{
	access_token: string;
	refresh_token: string | null;
	scope: string;
	token_type: string;
	expiry_date: number | null;
}> {
	const oauth = getOAuthClient(config);
	const { tokens } = await oauth.getToken(code);
	logger.info(`[GoogleAuth] Tokens obtained. Scopes: ${tokens.scope}`);

	return {
		access_token: tokens.access_token!,
		refresh_token: tokens.refresh_token || null,
		scope: tokens.scope || SCOPES.join(" "),
		token_type: tokens.token_type || "Bearer",
		expiry_date: tokens.expiry_date || null,
	};
}

export async function refreshAccessToken(
	config: AppConfig,
	refreshToken: string
): Promise<{
	access_token: string;
	refresh_token: string | null;
	scope: string;
	token_type: string;
	expiry_date: number | null;
}> {
	const oauth = getOAuthClient(config);
	oauth.setCredentials({ refresh_token: refreshToken });
	const { credentials } = await oauth.refreshAccessToken();
	logger.info(`[GoogleAuth] Token refreshed`);

	return {
		access_token: credentials.access_token!,
		refresh_token: credentials.refresh_token || refreshToken,
		scope: credentials.scope || SCOPES.join(" "),
		token_type: credentials.token_type || "Bearer",
		expiry_date: credentials.expiry_date || null,
	};
}

export async function revokeToken(config: AppConfig, accessToken: string): Promise<void> {
	const oauth = getOAuthClient(config);
	try {
		await oauth.revokeToken(accessToken);
		logger.info(`[GoogleAuth] Token revoked`);
	} catch (err) {
		logger.warn(`[GoogleAuth] Revoke failed (may already be revoked): ${err}`);
	}
}

export async function getUserInfo(_config: AppConfig, accessToken: string): Promise<{ email: string; name: string; picture: string } | null> {
	try {
		const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!response.ok) return null;
		const data = await response.json() as { email?: string; name?: string; picture?: string };
		const email = data.email || "";
		return {
			email,
			name: data.name || email.split("@")[0],
			picture: data.picture || "",
		};
	} catch {
		return null;
	}
}
