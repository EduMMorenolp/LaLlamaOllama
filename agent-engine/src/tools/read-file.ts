import * as fs from "node:fs";
import * as path from "node:path";
import { type ToolContext, toolRegistry } from "./registry.js";

export function registerReadFileTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "read_file",
				description:
					"Read the contents of a file. Returns the file content or an error if the file does not exist.",
				parameters: {
					type: "object",
					properties: {
						file_path: {
							type: "string",
							description: "Path to the file, relative to the workspace root",
						},
						limit: {
							type: "number",
							description: "Maximum number of lines to read (default: all)",
						},
						offset: {
							type: "number",
							description: "Line number to start reading from, 1-indexed (default: 1)",
						},
					},
					required: ["file_path"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			const filePath = args.file_path as string;
			const limit = args.limit ? (args.limit as number) : undefined;
			const offset = args.offset ? (args.offset as number) : 1;

			if (!filePath) {
				return "Error: file_path is required";
			}

			// Security: prevent path traversal
			const resolvedPath = path.resolve(ctx.workspaceDir, filePath);
			if (!resolvedPath.startsWith(path.resolve(ctx.workspaceDir))) {
				return "Error: Path traversal detected. File must be within the workspace.";
			}

			try {
				if (!fs.existsSync(resolvedPath)) {
					return `Error: File not found: ${filePath}`;
				}

				const stat = fs.statSync(resolvedPath);
				if (stat.isDirectory()) {
					return `Error: '${filePath}' is a directory, not a file`;
				}

				// Check file size (max 50MB)
				if (stat.size > 50 * 1024 * 1024) {
					return `Error: File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max: 50MB`;
				}

				const content = fs.readFileSync(resolvedPath, "utf-8");
				const lines = content.split("\n");

				const startLine = Math.max(0, offset - 1);
				const endLine = limit ? startLine + limit : lines.length;
				const selectedLines = lines.slice(startLine, endLine);

				let result = selectedLines.join("\n");
				if (result.length > 100000) {
					result = result.substring(0, 100000) + "\n... [truncated at 100000 chars]";
				}

				const totalLines = lines.length;
				const showing = `Showing lines ${startLine + 1}-${Math.min(endLine, totalLines)} of ${totalLines}\n`;
				return showing + result;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error reading file: ${msg}`;
			}
		},
		enabled: true,
	});
}
