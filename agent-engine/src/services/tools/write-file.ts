import * as fs from "node:fs";
import * as path from "node:path";
import { toolRegistry } from "./registry.js";
import type { ToolContext } from "./types.js";

export function registerWriteFileTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "write_file",
				description:
					"Crea un archivo nuevo o sobrescribe uno existente con contenido nuevo. Para ediciones usa edit_file.",
				parameters: {
					type: "object",
					properties: {
						file_path: {
							type: "string",
							description: "Path to the file, relative to the workspace root",
						},
						content: {
							type: "string",
							description: "The full content to write to the file",
						},
					},
					required: ["file_path", "content"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			const filePath = args.file_path as string;
			const content = args.content as string;

			if (!filePath) return "Error: file_path is required";
			if (content === undefined || content === null) return "Error: content is required";

			const resolvedPath = path.resolve(ctx.workspaceDir, filePath);
			if (!resolvedPath.startsWith(path.resolve(ctx.workspaceDir))) {
				return "Error: Path traversal detected. File must be within the workspace.";
			}

			try {
				const dir = path.dirname(resolvedPath);
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}

				fs.writeFileSync(resolvedPath, content, "utf-8");
				const size = Buffer.byteLength(content, "utf-8");
				return `File written: ${filePath} (${size} bytes, ${content.split("\n").length} lines)`;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error writing file: ${msg}`;
			}
		},
		enabled: true,
	});
}

export function registerEditFileTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "edit_file",
				description:
					"Edita un archivo reemplazando texto exacto. Usa reemplazo de cadenas exactas (no regex). Ideal para modificaciones puntuales.",
				parameters: {
					type: "object",
					properties: {
						file_path: {
							type: "string",
							description: "Path to the file, relative to the workspace root",
						},
						old_string: {
							type: "string",
							description: "The exact text to replace (must exist in the file)",
						},
						new_string: {
							type: "string",
							description: "The new text to insert in place of old_string",
						},
					},
					required: ["file_path", "old_string", "new_string"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			const filePath = args.file_path as string;
			const oldString = args.old_string as string;
			const newString = args.new_string as string;

			if (!filePath) return "Error: file_path is required";
			if (!oldString) return "Error: old_string is required";
			if (newString === undefined) return "Error: new_string is required";

			const resolvedPath = path.resolve(ctx.workspaceDir, filePath);
			if (!resolvedPath.startsWith(path.resolve(ctx.workspaceDir))) {
				return "Error: Path traversal detected. File must be within the workspace.";
			}

			try {
				if (!fs.existsSync(resolvedPath)) {
					return `Error: File not found: ${filePath}`;
				}

				const content = fs.readFileSync(resolvedPath, "utf-8");

				if (!content.includes(oldString)) {
					return `Error: old_string not found in ${filePath}`;
				}

				const occurrences = content.split(oldString).length - 1;
				if (occurrences > 1) {
					return `Error: Found ${occurrences} occurrences of old_string. The edit_file tool only supports single occurrences. Use write_file instead for this case.`;
				}

				const newContent = content.replace(oldString, newString);
				fs.writeFileSync(resolvedPath, newContent, "utf-8");

				return `File edited: ${filePath} (replacement applied)`;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error editing file: ${msg}`;
			}
		},
		enabled: true,
	});
}
