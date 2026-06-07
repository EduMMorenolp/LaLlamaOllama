const colors = {
	reset: "\x1b[0m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
	gray: "\x1b[90m",
} as const;

type LogLevel = "info" | "warn" | "error" | "debug" | "agent" | "tool";

function timestamp(): string {
	return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function colorize(level: LogLevel): string {
	switch (level) {
		case "info":
			return `${colors.cyan}[INFO]${colors.reset}`;
		case "warn":
			return `${colors.yellow}[WARN]${colors.reset}`;
		case "error":
			return `${colors.red}[ERROR]${colors.reset}`;
		case "debug":
			return `${colors.gray}[DEBUG]${colors.reset}`;
		case "agent":
			return `${colors.magenta}[AGENT]${colors.reset}`;
		case "tool":
			return `${colors.green}[TOOL]${colors.reset}`;
	}
}

export const logger = {
	info: (msg: string, ...args: unknown[]) => console.log(`${timestamp()} ${colorize("info")} ${msg}`, ...args),
	warn: (msg: string, ...args: unknown[]) => console.warn(`${timestamp()} ${colorize("warn")} ${msg}`, ...args),
	error: (msg: string, ...args: unknown[]) => console.error(`${timestamp()} ${colorize("error")} ${msg}`, ...args),
	debug: (msg: string, ...args: unknown[]) => console.debug(`${timestamp()} ${colorize("debug")} ${msg}`, ...args),
	agent: (msg: string, ...args: unknown[]) => console.log(`${timestamp()} ${colorize("agent")} ${msg}`, ...args),
	tool: (msg: string, ...args: unknown[]) => console.log(`${timestamp()} ${colorize("tool")} ${msg}`, ...args),
};
