import type { AppConfig } from "../config.js";
import { registerCalendarTools, setCalendarConfig } from "./calendar-tools.js";
import { registerGmailTools, setGmailConfig } from "./gmail-tools.js";

export function registerGoogleTools(config: AppConfig): void {
	setCalendarConfig(config);
	setGmailConfig(config);
	registerCalendarTools();
	registerGmailTools();
}
