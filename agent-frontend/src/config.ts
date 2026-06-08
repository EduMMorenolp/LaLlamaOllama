export const config = {
	engineUrl: import.meta.env.VITE_ENGINE_URL || "http://localhost:3020",
	brainUrl: import.meta.env.VITE_BRAIN_URL || "http://localhost:3015",
	apiKey: import.meta.env.VITE_API_KEY || "",
	get wsUrl(): string {
		try {
			const url = new URL(this.engineUrl);
			if (url.protocol === "http:") url.protocol = "ws:";
			else if (url.protocol === "https:") url.protocol = "wss:";
			const port = Number(url.port || "3020");
			url.port = String(Number.isFinite(port) ? port + 1 : 3021);
			return url.toString();
		} catch {
			return "ws://localhost:3021";
		}
	},
};
