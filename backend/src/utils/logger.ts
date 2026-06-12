import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const logger = pino({
	level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
	customLevels: {
		agent: 35,
		tool: 36,
	},
	useOnlyCustomLevels: false,
	...(isDev
		? {
				transport: {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "SYS:HH:MM:ss.l",
						ignore: "pid,hostname",
						customLevels: "agent:35,tool:36",
						customColors: "agent:magenta,tool:green",
					},
				},
			}
		: {}),
	base: {
		env: isDev ? "development" : "production",
	},
});

export function childLogger(component: string) {
	return logger.child({ component });
}

export default logger;
