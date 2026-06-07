import { logger } from "../../utils/logger.js";
import type { ToolContext, ToolDefinition, ToolSpec } from "./types.js";

// ─── Simple Mutex ─────────────────────────────────────────────────────

class SimpleMutex {
	private _locked = false;
	private _queue: Array<() => void> = [];

	async acquire(): Promise<void> {
		if (!this._locked) {
			this._locked = true;
			return;
		}
		return new Promise<void>((resolve) => {
			this._queue.push(resolve);
		});
	}

	release(): void {
		if (this._queue.length > 0) {
			const next = this._queue.shift()!;
			next();
		} else {
			this._locked = false;
		}
	}
}

// ─── Registry ─────────────────────────────────────────────────────────

class ToolRegistry {
	private registry = new Map<string, ToolDefinition>();
	private modeLock = new SimpleMutex();

	register(def: ToolDefinition): void {
		this.registry.set(def.spec.function.name, def);
		logger.tool(`Registered tool: ${def.spec.function.name} (enabled: ${def.enabled})`);
	}

	getSpecs(): ToolSpec[] {
		return Array.from(this.registry.values())
			.filter((t) => t.enabled)
			.map((t) => t.spec);
	}

	getAllTools(): Array<{ spec: ToolSpec; enabled: boolean }> {
		return Array.from(this.registry.values()).map((t) => ({
			spec: t.spec,
			enabled: t.enabled,
		}));
	}

	/**
	 * Obtiene una tool por nombre (para validación).
	 */
	get(name: string): ToolDefinition | undefined {
		return this.registry.get(name);
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

	/**
	 * Registra una tool custom (creada por el usuario). Si ya existe, la reemplaza.
	 */
	registerCustomTool(name: string, def: ToolDefinition): void {
		const existing = this.registry.get(name);
		if (existing) {
			logger.tool(`Replacing existing custom tool: ${name}`);
		}
		this.registry.set(name, def);
		logger.tool(`Registered custom tool: ${name} (enabled: ${def.enabled})`);
	}

	/**
	 * Elimina una tool custom del registry.
	 */
	unregisterCustomTool(name: string): boolean {
		const existed = this.registry.has(name);
		if (existed) {
			this.registry.delete(name);
			logger.tool(`Unregistered custom tool: ${name}`);
		}
		return existed;
	}

	/**
	 * Verifica si un nombre de tool está disponible (no existe en el registry).
	 */
	isToolNameAvailable(name: string): boolean {
		return !this.registry.has(name);
	}

	/**
	 * Retorna el número de tools registradas.
	 */
	getToolCount(): number {
		return this.registry.size;
	}

	/**
	 * Aplica las tools de un modo de forma atómica.
	 * - Adquiere lock para evitar cambios durante ejecución concurrente.
	 * - Deshabilita todas las tools, luego habilita solo las del modo.
	 */
	async applyModeTools(tools: string[]): Promise<void> {
		await this.modeLock.acquire();
		try {
			// Deshabilitar todas
			for (const [name] of this.registry) {
				this.registry.get(name)!.enabled = false;
			}
			// Habilitar solo las del modo
			for (const name of tools) {
				const def = this.registry.get(name);
				if (def) {
					def.enabled = true;
				}
			}
			logger.info(`[Tools] Mode tools applied: ${tools.length} enabled`);
		} finally {
			this.modeLock.release();
		}
	}
}

export const toolRegistry = new ToolRegistry();
