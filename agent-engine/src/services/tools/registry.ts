import { logger } from "../../utils/logger.js";
import type { ToolSpec, ToolContext, ToolDefinition } from "./types.js";

// ─── Registry ─────────────────────────────────────────────────────────

class ToolRegistry {
	private registry = new Map<string, ToolDefinition>();

	register(def: ToolDefinition): void {
		this.registry.set(def.spec.function.name, def);
		logger.tool(`Registered tool: ${def.spec.function.name} (enabled: ${def.enabled})`);
	}

	getSpecs(): ToolSpec[] {
		return Array.from(this.registry.values())
			.filter((t) => t.enabled)
			.map((t) => t.spec);
	}

	async execute(name: string, args: Record<string, unknown>, context: ToolContext): Promise<string> {
		const def = this.registry.get(name);
		if (!def) {
			throw new Error(`Tool "${name}" not found`);
		}
		if (!def.enabled) {
			throw new Error(`Tool "${name}" is disabled`);
		}

		logger.tool(`Executing: ${name}`, args);
		const start = Date.now();
		try {
			const result = await def.handler(args, context);
			const elapsed = Date.now() - start;
			logger.tool(`  ✓ ${name} completed (${elapsed}ms)`);
			return result;
		} catch (err) {
			const elapsed = Date.now() - start;
			const msg = err instanceof Error ? err.message : String(err);
			logger.tool(`  ✗ ${name} failed (${elapsed}ms): ${msg}`);
			throw err;
		}
	}

	getToolNames(): string[] {
		return Array.from(this.registry.keys());
	}

	setEnabled(name: string, enabled: boolean): boolean {
		const def = this.registry.get(name);
		if (!def) return false;
		def.enabled = enabled;
		logger.tool(`Tool "${name}" ${enabled ? "enabled" : "disabled"}`);
		return true;
	}

	isEnabled(name: string): boolean {
		return this.registry.get(name)?.enabled ?? false;
	}
}

export const toolRegistry = new ToolRegistry();
