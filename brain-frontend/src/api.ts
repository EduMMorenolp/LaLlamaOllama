import { config } from "./config";

export interface Memory {
	id: string;
	project: string;
	type: string;
	title: string;
	content: string;
	tags: string;
	phase: string;
	agent: string;
	createdAt: number;
	updatedAt: number;
	similarity?: number;
}

export interface MemoryStatsRes {
	totalMemories: number;
	byType: Record<string, number>;
	latestActivity: number;
}

export interface MemorySearchRes extends Array<Memory> {}

const brain = (path: string, init?: RequestInit) =>
	fetch(`${config.brainUrl}${path}`, {
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});

export async function fetchMemories(
	project: string,
	limit = 100,
	offset = 0,
	type?: string,
): Promise<Memory[]> {
	const params = new URLSearchParams({ project, limit: String(limit), offset: String(offset) });
	if (type) params.set("type", type);
	const res = await brain(`/api/memory/timeline?${params}`);
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function fetchMemory(id: string): Promise<Memory> {
	const res = await brain(`/api/memory/${id}`);
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function createMemory(data: Partial<Memory>): Promise<Memory> {
	const res = await brain("/api/memory", {
		method: "POST",
		body: JSON.stringify(data),
	});
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function updateMemory(id: string, data: Partial<Memory>): Promise<void> {
	const res = await brain(`/api/memory/${id}`, {
		method: "PUT",
		body: JSON.stringify(data),
	});
	if (!res.ok) throw new Error(await res.text());
}

export async function deleteMemory(id: string): Promise<void> {
	const res = await brain(`/api/memory/${id}`, { method: "DELETE" });
	if (!res.ok) throw new Error(await res.text());
}

export async function searchMemories(
	q: string,
	project: string,
	type?: string,
	limit = 50,
): Promise<Memory[]> {
	const params = new URLSearchParams({ q, project, limit: String(limit) });
	if (type) params.set("type", type);
	const res = await brain(`/api/memory/search?${params}`);
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function fetchStats(project: string): Promise<MemoryStatsRes> {
	const res = await brain(`/api/memory/stats?project=${encodeURIComponent(project)}`);
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function fetchProjects(): Promise<string[]> {
	const res = await brain("/api/projects");
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}
