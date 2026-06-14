import * as fs from "node:fs";
import * as path from "node:path";
import { toolRegistry } from "./registry.js";
import type { ToolContext } from "./types.js";

function simpleGlob(pattern: string, baseDir: string): string[] {
	const results: string[] = [];

	function match(patternParts: string[], dir: string, idx: number) {
		if (idx >= patternParts.length) {
			results.push(path.relative(baseDir, dir) || ".");
			return;
		}

		const part = patternParts[idx];

		if (part === "**") {
			match(patternParts, dir, idx + 1);
			try {
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					if (entry.isDirectory()) {
						match(patternParts, path.join(dir, entry.name), idx);
					}
				}
			} catch {
				// Permission denied
			}
		} else {
			try {
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					if (matchSimple(entry.name, part)) {
						const fullPath = path.join(dir, entry.name);
						if (idx === patternParts.length - 1) {
							results.push(path.relative(baseDir, fullPath));
						} else if (entry.isDirectory()) {
							match(patternParts, fullPath, idx + 1);
						}
					}
				}
			} catch {
				// Permission denied
			}
		}
	}

	const patternParts = pattern.split(/[\\/]/).filter(Boolean);
	match(patternParts, baseDir, 0);
	return results;
}

function matchSimple(name: string, pattern: string): boolean {
	if (pattern === "*") return true;
	if (pattern === name) return true;

	const regexStr = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".");

	return new RegExp(`^${regexStr}$`).test(name);
}

export function registerGlobTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "glob",
				description:
					"Busca archivos por patrón glob. Soporta *, ** y ?.",
				parameters: {
					type: "object",
					properties: {
						pattern: {
							type: "string",
							description: "Glob pattern (e.g., '**/*.ts', 'src/**/*.tsx', '*.json')",
						},
						directory: {
							type: "string",
							description: "Directory to search in, relative to workspace root (default: workspace root)",
						},
					},
					required: ["pattern"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			const pattern = args.pattern as string;
			const directory = (args.directory as string) || "";

			if (!pattern) return "Error: pattern is required";

			const searchDir = directory ? path.resolve(ctx.workspaceDir, directory) : ctx.workspaceDir;

			if (!searchDir.startsWith(path.resolve(ctx.workspaceDir))) {
				return "Error: Path traversal detected.";
			}

			try {
				if (!fs.existsSync(searchDir)) {
					return `Error: Directory not found: ${directory || "(root)"}`;
				}

				const results = simpleGlob(pattern, searchDir);

				if (results.length === 0) {
					return `No files found matching: ${pattern}`;
				}

				results.sort();
				const limited = results.slice(0, 200);
				let output = limited.join("\n");

				if (results.length > 200) {
					output += `\n... and ${results.length - 200} more files`;
				}

				output = `Found ${results.length} file(s) for "${pattern}":\n${output}`;
				return output;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error searching files: ${msg}`;
			}
		},
		enabled: true,
	});
}
