import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { config } from "../config";

interface WsContextValue {
	connected: boolean;
	reconnecting: boolean;
	send: (type: string, payload?: Record<string, unknown>) => boolean;
	subscribe: (handler: (msg: { type: string; payload?: Record<string, unknown> }) => void) => () => void;
	userId: string;
}

const WsContext = createContext<WsContextValue>(null!);

export function WsProvider({ children }: { children: ReactNode }) {
	const [connected, setConnected] = useState(false);
	const [reconnecting, setReconnecting] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const handlersRef = useRef<Set<(msg: any) => void>>(new Set());
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const intentionalRef = useRef(false);
	const userId = "web-user";

	const send = useCallback((type: string, payload?: Record<string, unknown>): boolean => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type, payload: payload || {} }));
			return true;
		}
		return false;
	}, []);

	const subscribe = useCallback((handler: (msg: any) => void) => {
		handlersRef.current.add(handler);
		return () => {
			handlersRef.current.delete(handler);
		};
	}, []);

	useEffect(() => {
		let mounted = true;
		function connect() {
			if (!mounted) return;
			intentionalRef.current = false;
			setConnected(false);
			setReconnecting(true);
			const ws = new WebSocket(config.wsUrl);
			wsRef.current = ws;
			ws.onopen = () => {
				if (!mounted) {
					ws.close();
					return;
				}
				reconnectAttemptsRef.current = 0;
				setConnected(true);
				setReconnecting(false);
				ws.send(JSON.stringify({ type: "identify", payload: { userId } }));
			};
			ws.onclose = () => {
				if (!mounted) return;
				setConnected(false);
				setReconnecting(false);
				if (intentionalRef.current) return;
				setReconnecting(true);
				const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 15000);
				reconnectAttemptsRef.current++;
				reconnectTimerRef.current = setTimeout(connect, delay);
			};
			ws.onerror = () => ws.close();
			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data);
					handlersRef.current.forEach((h) => h(msg));
				} catch {
					/* ignore */
				}
			};
		}
		connect();
		return () => {
			mounted = false;
			intentionalRef.current = true;
			if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
			if (wsRef.current) {
				wsRef.current.close();
				wsRef.current = null;
			}
		};
	}, []);

	return <WsContext.Provider value={{ connected, reconnecting, send, subscribe, userId }}>{children}</WsContext.Provider>;
}

export function useWs() {
	const ctx = useContext(WsContext);
	if (!ctx) throw new Error("useWs debe usarse dentro de un WsProvider");
	return ctx;
}
