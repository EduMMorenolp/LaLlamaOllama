import { Router } from "express";
import type { RequestHandler } from "express";
import type { GetAuthSettingsUseCase } from "../use-cases/auth/get-settings.js";
import type { ToggleOllamaAuthUseCase } from "../use-cases/auth/toggle-ollama-auth.js";
import type { ToggleMcpAuthUseCase } from "../use-cases/auth/toggle-mcp-auth.js";
import type { ListMcpToolsUseCase } from "../use-cases/auth/list-mcp-tools.js";
import type { ToggleMcpToolUseCase } from "../use-cases/auth/toggle-mcp-tool.js";
import { ToggleAuthSchema } from "../types/auth.js";

export function createAuthRouter(
  getSettings: GetAuthSettingsUseCase,
  toggleOllamaAuth: ToggleOllamaAuthUseCase,
  toggleMcpAuth: ToggleMcpAuthUseCase,
  listMcpTools: ListMcpToolsUseCase,
  toggleMcpTool: ToggleMcpToolUseCase,
  authMiddleware: RequestHandler
) {
  const router = Router();

  router.get("/api/auth/settings", authMiddleware, (_req, res) => {
    res.json(getSettings.execute());
  });

  router.post("/api/auth/ollama", authMiddleware, (req, res) => {
    const parsed = ToggleAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: "enabled debe ser boolean", type: "invalid_request_error" },
      });
    }
    res.json(toggleOllamaAuth.execute(parsed.data));
  });

  router.post("/api/auth/mcp", authMiddleware, (req, res) => {
    const parsed = ToggleAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: "enabled debe ser boolean", type: "invalid_request_error" },
      });
    }
    res.json(toggleMcpAuth.execute(parsed.data));
  });

  router.get("/api/auth/mcp/tools", authMiddleware, (_req, res) => {
    const tools = listMcpTools.execute();
    res.json({ tools });
  });

  router.post("/api/auth/mcp/tools/:name", authMiddleware, (req, res) => {
    const { name } = req.params;
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        error: { message: "enabled debe ser boolean", type: "invalid_request_error" },
      });
    }
    const result = toggleMcpTool.execute(name, enabled);
    if (!result.found) {
      return res.status(404).json({
        error: { message: `Tool ${name} no existe`, type: "not_found" },
      });
    }
    res.json({ name, enabled, mcpTools: result.mcpTools });
  });

  return router;
}
