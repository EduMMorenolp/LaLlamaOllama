/**
 * Puente de acceso para tools que necesitan el WsServer o TelegramBot
 * en tiempo de ejecución (se setean después del registro de tools).
 */
import type { AxiosInstance } from "axios";
import type { WsServer } from "../../server/ws.js";

let _wsServer: WsServer | null = null;
let _httpClient: AxiosInstance | null = null;

export function setWsServer(ws: WsServer): void {
	_wsServer = ws;
}

export function getWsServer(): WsServer | null {
	return _wsServer;
}

export function setHttpClient(client: AxiosInstance): void {
	_httpClient = client;
}

export function getHttpClient(): AxiosInstance | null {
	return _httpClient;
}
