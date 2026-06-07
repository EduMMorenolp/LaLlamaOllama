import { exec } from "node:child_process";
import { promisify } from "node:util";
import { toolRegistry } from "./registry.js";
import type { ToolContext } from "./types.js";

const execAsync = promisify(exec);

const DANGEROUS_PATTERNS = [
	/^rm\s+-rf\s+\/\s*$/,
	/^mkfs\./,
	/^dd\s+/,
	/^:\(\)\s*\{\s*:\|\|:&\s*};?\s*:/,
	/^>\/dev\/sda/,
];

function isDangerous(command: string): boolean {
	return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command.trim()));
}

export function registerBashTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "bash",
				description: "Ejecuta un comando en la terminal del workspace. Devuelve stdout y stderr.",
				parameters: {
					type: "object",
					properties: {
						command: {
							type: "string",
							description: "The shell command to execute",
						},
						timeout: {
							type: "number",
							description: "Timeout in milliseconds (default: 30000)",
						},
						workdir: {
							type: "string",
							description: "Working directory relative to workspace (default: workspace root)",
						},
					},
					required: ["command"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			const command = args.command as string;
			const timeout = (args.timeout as number) || 30000;
			const workdir = args.workdir ? `${ctx.workspaceDir}/${args.workdir}` : ctx.workspaceDir;

			if (!command || command.trim().length === 0) {
				return "Error: Empty command";
			}

			if (isDangerous(command)) {
				return "Error: This command has been blocked for safety reasons (destructive pattern detected)";
			}

			try {
				const { stdout, stderr } = await execAsync(command, {
					timeout,
					cwd: workdir,
					maxBuffer: 10 * 1024 * 1024,
				});

				let result = "";
				if (stdout) result += `STDOUT:\n${stdout.substring(0, 50000)}`;
				if (stderr) result += `\nSTDERR:\n${stderr.substring(0, 10000)}`;

				if (!result.trim()) result = "(command completed with no output)";

				return result;
			} catch (err: unknown) {
				const error = err as Error & { stdout?: string; stderr?: string };
				let msg = `Error: ${error.message || String(err)}`;
				if (error.stdout) msg += `\nSTDOUT:\n${error.stdout.substring(0, 10000)}`;
				if (error.stderr) msg += `\nSTDERR:\n${error.stderr.substring(0, 10000)}`;
				return msg;
			}
		},
		enabled: true,
	});
}
