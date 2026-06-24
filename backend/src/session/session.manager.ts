/**
 * SessionManager
 * Manages isolated sessions per IP + API Key
 * Prevents global state interference between concurrent users
 */

import logger from "../utils/logger.js";

const log = logger.child({ component: "sessions" });

export interface Session {
	id: string;
	ip: string;
	apiKey: string;
	createdAt: number;
	lastActivity: number;
	model?: string;
	temperature?: number;
	context?: number;
}

export class SessionManager {
	private sessions: Map<string, Session> = new Map();
	private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes
	private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes

	constructor() {
		this.startCleanupWatcher();
	}

	createSession(ip: string, apiKey: string): string {
		const sessionId = `session_${ip}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const session: Session = {
			id: sessionId,
			ip,
			apiKey,
			createdAt: Date.now(),
			lastActivity: Date.now(),
		};
		this.sessions.set(sessionId, session);
		log.agent(
			{ ip, sessionId: `${sessionId.substring(0, 20)}...` },
			"Session created",
		);
		return sessionId;
	}

	getSession(sessionId: string): Session | undefined {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.lastActivity = Date.now();
		}
		return session;
	}

	updateSessionModel(sessionId: string, model: string): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.model = model;
			session.lastActivity = Date.now();
		}
	}

	updateSessionSettings(
		sessionId: string,
		settings: { temperature?: number; context?: number },
	): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			if (settings.temperature !== undefined)
				session.temperature = settings.temperature;
			if (settings.context !== undefined) session.context = settings.context;
			session.lastActivity = Date.now();
		}
	}

	endSession(sessionId: string): void {
		this.sessions.delete(sessionId);
		log.agent(
			{ sessionId: `${sessionId.substring(0, 20)}...` },
			"Session ended",
		);
	}

	getSessions(): Session[] {
		return Array.from(this.sessions.values());
	}

	getSessionsByIp(ip: string): Session[] {
		return Array.from(this.sessions.values()).filter((s) => s.ip === ip);
	}

	private startCleanupWatcher() {
		setInterval(() => {
			const now = Date.now();
			let expired = 0;

			for (const [sessionId, session] of this.sessions.entries()) {
				if (now - session.lastActivity > this.sessionTimeout) {
					this.sessions.delete(sessionId);
					expired++;
				}
			}

			if (expired > 0) {
				log.agent({ expired }, "Stale sessions cleaned up");
			}
		}, this.cleanupInterval);
	}
}
