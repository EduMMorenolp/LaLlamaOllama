export const config = {
	embeddingModel: "qwen3.5:4b-12k",
	ollamaUrl: process.env.OLLAMA_API_URL || "http://localhost:11434",
	backendUrl: process.env.BACKEND_URL || "http://backend:3016",
	apiKey: process.env.API_KEY || "",
};
