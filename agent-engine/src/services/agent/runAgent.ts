import { submitAgentRun } from "../orchestrator/index.js";
import type { AgentOptions, AgentResult } from "./types.js";

export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
	return submitAgentRun(opts);
}

export { getActiveSessions, resetSession, runAgentCore } from "./runAgentCore.js";
