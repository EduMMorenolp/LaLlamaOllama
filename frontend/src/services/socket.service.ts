import { io } from "socket.io-client";
import type { AccessLogEntry, PullProgressData } from "../types/api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3016";

export const socket = io(SOCKET_URL, {
	autoConnect: true,
	reconnection: true,
});

export const subscribeToPullProgress = (callback: (data: PullProgressData) => void) => {
	socket.on("pull-progress", callback);
	return () => socket.off("pull-progress", callback);
};

export const subscribeToSecurityAlerts = (callback: (data: Record<string, unknown>) => void) => {
	socket.on("security-alert", callback);
	return () => socket.off("security-alert", callback);
};

export const subscribeToNewAccess = (callback: (data: AccessLogEntry) => void) => {
	socket.on("new-access", callback);
	return () => socket.off("new-access", callback);
};
