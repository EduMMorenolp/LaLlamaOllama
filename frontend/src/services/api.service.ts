import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3016";
const API_KEY_STORAGE = "llama_master_key";

let runtimeApiKey = typeof window !== "undefined" ? localStorage.getItem(API_KEY_STORAGE) || "" : "";

export const api = axios.create({
	baseURL: API_BASE_URL,
});

const BRAIN_API_URL = import.meta.env.VITE_BRAIN_API_URL || "http://localhost:3015";
export const brainApi = axios.create({
	baseURL: BRAIN_API_URL,
});

const authInterceptor = (config: any) => {
	const key = runtimeApiKey || (typeof window !== "undefined" ? localStorage.getItem(API_KEY_STORAGE) || "" : "");
	if (key) {
		config.headers = config.headers || {};
		config.headers["x-api-key"] = key;
	}
	return config;
};

api.interceptors.request.use(authInterceptor);
brainApi.interceptors.request.use(authInterceptor);

export const setApiKey = (apiKey: string) => {
	runtimeApiKey = apiKey.trim();
};

export const clearApiKey = () => {
	runtimeApiKey = "";
};

export const getStoredApiKey = () => {
	if (typeof window === "undefined") return "";
	return localStorage.getItem(API_KEY_STORAGE) || "";
};

export const persistApiKey = (apiKey: string) => {
	if (typeof window === "undefined") return;
	localStorage.setItem(API_KEY_STORAGE, apiKey);
};

export const removePersistedApiKey = () => {
	if (typeof window === "undefined") return;
	localStorage.removeItem(API_KEY_STORAGE);
};
