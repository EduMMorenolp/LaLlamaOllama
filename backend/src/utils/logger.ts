import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const logger = pino({
	level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
	...(isDev
		? {
				transport: {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "SYS:HH:MM:ss.l",
						ignore: "pid,hostname",
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
