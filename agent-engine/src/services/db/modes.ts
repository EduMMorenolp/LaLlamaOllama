import { logger } from "../../utils/logger.js";
import { toolRegistry } from "../tools/registry.js";
import { getDb } from "./connection.js";
import { getSetting, setSetting } from "./settings.js";
import { mergeSystemPrompts } from "../prompts/utils.js";
import { getModeDefinition, resolveModePrompt } from "../prompts/index.js";

export interface AgentMode {
	name: string;
	label: string;
	system_prompt: string;
	tools: string[];
	model: string;
	temperature: number;
	history_limit: number;
	tool_policy: "auto" | "restricted" | "ask_user";
	extends: string | null;
	usage_count: number;
	last_used: string | null;
	created_at?: string;
}

const SETTING_KEY = "active_mode";
const DEFAULT_MODE = "asistente";

// ─── Internal helpers ────────────────────────────────────────

function rowToMode(row: Record<string, unknown>): AgentMode {
	return {
		name: row.name as string,
		label: row.label as string,
		system_prompt: row.system_prompt as string,
		tools: JSON.parse(row.tools as string) as string[],
		model: row.model as string,
		temperature: row.temperature as number,
		history_limit: row.history_limit as number,
		tool_policy: (row.tool_policy as "auto" | "restricted" | "ask_user") || "restricted",
		extends: (row.extends as string) || null,
		usage_count: row.usage_count as number,
		last_used: (row.last_used as string) || null,
	};
}

function modeToRow(mode: Partial<AgentMode>): Record<string, unknown> {
	return {
		name: mode.name,
		label: mode.label ?? "",
		system_prompt: mode.system_prompt ?? "",
		tools: JSON.stringify(mode.tools ?? []),
		model: mode.model ?? "",
		temperature: mode.temperature ?? 0.7,
		history_limit: mode.history_limit ?? 10,
		tool_policy: mode.tool_policy ?? "restricted",
		extends: mode.extends ?? null,
		usage_count: mode.usage_count ?? 0,
		last_used: mode.last_used ?? null,
	};
}

// ─── CRUD ────────────────────────────────────────────────────

export function listModes(): AgentMode[] {
	const db = getDb();
	const rows = db.prepare("SELECT * FROM agent_modes ORDER BY name ASC").all() as Record<string, unknown>[];
	return rows.map(rowToMode);
}

export function getMode(name: string): AgentMode | null {
	const db = getDb();
	const row = db.prepare("SELECT * FROM agent_modes WHERE name = ?").get(name) as Record<string, unknown> | undefined;
	if (!row) return null;
	return rowToMode(row);
}

/**
 * Resuelve un modo aplicando herencia si extiende otro modo.
 * Combina system_prompt fusionando secciones XML (<tag>...</tag>).
 * Las secciones del hijo reemplazan a las del padre con el mismo tag.
 * Si el modo padre no esta en la DB, intenta resolver desde las definiciones
 * en memoria (e.g., __base__).
 */
export function resolveMode(mode: AgentMode): AgentMode {
	if (!mode.extends) return mode;
	const parent = getMode(mode.extends);
	if (!parent) {
		// Try to resolve from in-memory prompt definitions (e.g., __base__)
		try {
			const def = getModeDefinition(mode.extends);
			if (def) {
				const parentMode: AgentMode = {
					name: mode.extends,
					label: mode.extends,
					system_prompt: resolveModePrompt(mode.extends),
					tools: def.tools,
					model: def.model || "",
					temperature: def.temperature,
					history_limit: def.history_limit,
					tool_policy: def.tool_policy,
					extends: def.extends || null,
					usage_count: 0,
					last_used: null,
				};
				const resolvedParent = resolveMode(parentMode);
				const mergedPrompt = mergeSystemPrompts(
					resolvedParent.system_prompt,
					mode.system_prompt
				);
				return {
					...resolvedParent,
					...mode,
					system_prompt: mergedPrompt,
					tools: [...new Set([...resolvedParent.tools, ...mode.tools])],
				};
			}
		} catch {
			// Fall through to warning below
		}
		logger.warn(`[Modes] Parent mode '${mode.extends}' not found for '${mode.name}', ignoring extends`);
		return mode;
	}
	const resolvedParent = resolveMode(parent);
	const mergedPrompt = mergeSystemPrompts(
		resolvedParent.system_prompt,
		mode.system_prompt
	);
	return {
		...resolvedParent,
		...mode,
		system_prompt: mergedPrompt,
		tools: [...new Set([...resolvedParent.tools, ...mode.tools])],
	};
}

export function upsertMode(mode: Partial<AgentMode> & { name: string }): AgentMode {
	// Validar que las tools existen en el registry
	const allToolNames = toolRegistry.getAllTools().map((t) => t.spec.function.name);
	if (mode.tools) {
		const invalid = mode.tools.filter((t) => !allToolNames.includes(t));
		if (invalid.length > 0) {
			throw new Error(`Invalid tools for mode '${mode.name}': ${invalid.join(", ")}. Valid tools: ${allToolNames.join(", ")}`);
		}
	}

	// Validar extends
	if (mode.extends) {
		const parent = getMode(mode.extends);
		if (!parent) {
			throw new Error(`Parent mode '${mode.extends}' not found for mode '${mode.name}'`);
		}
	}

	const db = getDb();
	const existing = db.prepare("SELECT * FROM agent_modes WHERE name = ?").get(mode.name);
	const row = modeToRow(mode);

	if (existing) {
		const sets: string[] = [];
		const params: unknown[] = [];
		for (const [key, value] of Object.entries(row)) {
			if (key === "name") continue;
			sets.push(`${key} = ?`);
			params.push(value);
		}
		params.push(mode.name);
		db.prepare(`UPDATE agent_modes SET ${sets.join(", ")} WHERE name = ?`).run(...params);
	} else {
		const cols = Object.keys(row).join(", ");
		const placeholders = Object.keys(row)
			.map(() => "?")
			.join(", ");
		db.prepare(`INSERT INTO agent_modes (${cols}) VALUES (${placeholders})`).run(...Object.values(row));
	}

	logger.info(`[Modes] Mode '${mode.name}' ${existing ? "updated" : "created"}`);
	return getMode(mode.name)!;
}

export function deleteMode(name: string): void {
	if (name === DEFAULT_MODE) {
		throw new Error(`Cannot delete default mode '${DEFAULT_MODE}'`);
	}

	// Verificar que ningun otro modo lo extiende
	const db = getDb();
	const dependents = db
		.prepare("SELECT name FROM agent_modes WHERE extends = ?")
		.all(name) as { name: string }[];
	if (dependents.length > 0) {
		throw new Error(
			`Cannot delete mode '${name}': it is extended by: ${dependents.map((d) => d.name).join(", ")}`
		);
	}

	db.prepare("DELETE FROM agent_modes WHERE name = ?").run(name);
	logger.info(`[Modes] Mode '${name}' deleted`);

	// Si era el modo activo, resetear al default
	const active = getActiveMode();
	if (active.name === name) {
		setActiveMode(DEFAULT_MODE);
	}
}

// ─── Active mode ─────────────────────────────────────────────

export function getActiveMode(): AgentMode {
	const name = getSetting(SETTING_KEY) || DEFAULT_MODE;
	const mode = getMode(name);
	if (!mode) {
		logger.warn(`[Modes] Active mode '${name}' not found, falling back to '${DEFAULT_MODE}'`);
		const fallback = getMode(DEFAULT_MODE);
		if (fallback) return fallback;
		// Si no existe el default, devolvemos un modo generico
		return {
			name: DEFAULT_MODE,
			label: "🛠 Asistente General",
			system_prompt: "Eres un asistente conversacional amigable.",
			tools: [],
			model: "",
			temperature: 0.7,
			history_limit: 10,
			tool_policy: "restricted",
			extends: null,
			usage_count: 0,
			last_used: null,
		};
	}
	return resolveMode(mode);
}

export function setActiveMode(name: string): void {
	const mode = getMode(name);
	if (!mode) {
		throw new Error(`Mode '${name}' not found`);
	}
	setSetting(SETTING_KEY, name);
	logger.info(`[Modes] Active mode set to '${name}'`);
}

export function incrementModeUsage(name: string): void {
	const db = getDb();
	db.prepare("UPDATE agent_modes SET usage_count = usage_count + 1, last_used = ? WHERE name = ?").run(
		new Date().toISOString(),
		name
	);
}
