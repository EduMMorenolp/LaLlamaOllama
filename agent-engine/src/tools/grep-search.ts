import * as fs from "node:fs";
import * as path from "node:path";
import { type ToolContext, toolRegistry } from "./registry.js";

export function registerGrepTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "grep",
				description:
					"Search file contents for a regex pattern. Returns matching file paths with line numbers and content. Supports filtering by file pattern.",
				parameters: {
					type: "object",
					properties: {
						pattern: {
							type: "string",
							description: "The regex pattern to search for in file contents",
						},
						include: {
							type: "string",
							description: "File pattern to include (e.g., '*.ts', '*.{ts,tsx}'). Default: all files",
						},
						directory: {
							type: "string",
							description: "Directory to search in, relative to workspace root (default: workspace root)",
						},
						max_results: {
							type: "number",
							description: "Maximum results to return (default: 100)",
						},
					},
					required: ["pattern"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			const pattern = args.pattern as string;
			const include = args.include as string | undefined;
			const directory = (args.directory as string) || "";
			const maxResults = (args.max_results as number) || 100;

			if (!pattern) return "Error: pattern is required";

			const searchDir = directory ? path.resolve(ctx.workspaceDir, directory) : ctx.workspaceDir;

			if (!searchDir.startsWith(path.resolve(ctx.workspaceDir))) {
				return "Error: Path traversal detected.";
			}

			try {
				if (!fs.existsSync(searchDir)) {
					return `Error: Directory not found: ${directory || "(root)"}`;
				}

				const regex = new RegExp(pattern, "g");
				const results: Array<{ file: string; line: number; content: string }> = [];
				const excludeDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "venv", "__pycache__"]);

				function walkDir(dir: string) {
					try {
						const entries = fs.readdirSync(dir, { withFileTypes: true });
						for (const entry of entries) {
							if (results.length >= maxResults) return;
							if (excludeDirs.has(entry.name)) continue;
							if (entry.name.startsWith(".")) continue;

							const fullPath = path.join(dir, entry.name);

							if (entry.isDirectory()) {
								walkDir(fullPath);
							} else if (entry.isFile()) {
								// Check file extension filter
								if (include && !fileMatchesExt(entry.name, include)) continue;

								// Skip binary files
								if (isBinaryExt(entry.name)) continue;

								// Check file size (skip > 5MB)
								const stat = fs.statSync(fullPath);
								if (stat.size > 5 * 1024 * 1024) continue;

								try {
									const content = fs.readFileSync(fullPath, "utf-8");
									const lines = content.split("\n");
									for (let i = 0; i < lines.length; i++) {
										if (regex.test(lines[i])) {
											results.push({
												file: path.relative(ctx.workspaceDir, fullPath),
												line: i + 1,
												content: lines[i].trim().substring(0, 200),
											});
											if (results.length >= maxResults) return;
										}
									}
								} catch {
									// Binary or unreadable file, skip
								}
							}
						}
					} catch {
						// Permission denied
					}
				}

				walkDir(searchDir);

				if (results.length === 0) {
					return `No matches found for: ${pattern}`;
				}

				const output = results.map((r) => `${r.file}:${r.line}: ${r.content}`).join("\n");

				return `Found ${results.length} match(es) for "${pattern}":\n${output}`;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error searching contents: ${msg}`;
			}
		},
		enabled: true,
	});
}

function fileMatchesExt(name: string, pattern: string): boolean {
	// Simple glob matching for extensions
	const patterns = pattern.split(",").map((p) => p.trim());
	for (const p of patterns) {
		const regexStr = p.replace(/\./g, "\\.").replace(/\*/g, ".*");
		if (new RegExp(`^${regexStr}$`).test(name)) return true;
	}
	return false;
}

const BINARY_EXTS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".ico",
	".svg",
	".woff",
	".woff2",
	".ttf",
	".eot",
	".mp3",
	".mp4",
	".avi",
	".mov",
	".zip",
	".tar",
	".gz",
	".7z",
	".rar",
	".pdf",
	".doc",
	".docx",
	".xls",
	".xlsx",
	".exe",
	".dll",
	".so",
	".dylib",
	".o",
	".obj",
	".pyc",
	".class",
]);
function isBinaryExt(name: string): boolean {
	const ext = path.extname(name).toLowerCase();
	return BINARY_EXTS.has(ext);
}
