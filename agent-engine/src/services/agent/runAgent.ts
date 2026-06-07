import type { AgentOptions, AgentResult } from "./types.js";
import { submitAgentRun } from "../orchestrator/index.js";

export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
	return submitAgentRun(opts);
}

export { runAgentCore, resetSession, getActiveSessions } from "./runAgentCore.js";
