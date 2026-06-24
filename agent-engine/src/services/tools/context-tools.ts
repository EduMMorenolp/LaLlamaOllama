import type { BrainClient } from "../brain/client.js";
import { getUser, formatUserProfileForPrompt } from "../db/users.js";
import { getWorkspaceContext, formatWorkspaceForPrompt } from "../db/workspace.js";
import { toolRegistry } from "./registry.js";

export function registerContextTools(brain: BrainClient): void {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "get_brain_profile",
				description: "Obtiene el perfil del usuario/proyecto desde la memoria compartida (brain). Úsala para recordar información persistente del usuario o proyecto.",
				parameters: { type: "object", properties: {} },
			},
		},
		handler: async (_args, _ctx) => {
			const profile = await brain.getUserProfile().catch(() => "");
			return profile || "No hay perfil almacenado en el brain.";
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "get_user_profile",
				description: "Obtiene el perfil almacenado localmente del usuario (nombre, preferencias, intereses, estilo de comunicación, modelo preferido).",
				parameters: { type: "object", properties: {} },
			},
		},
		handler: async (_args, ctx) => {
			if (!ctx.userId) return "Usuario no identificado.";
			const user = getUser(ctx.userId);
			if (!user) return "No hay perfil de usuario almacenado localmente.";
			return formatUserProfileForPrompt(user) || "Perfil vacío.";
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "get_workspace_context",
				description: "Obtiene el contexto actual del workspace: proyecto activo, últimos archivos accedidos, directorios y tags relevantes.",
				parameters: { type: "object", properties: {} },
			},
		},
		handler: async (_args, ctx) => {
			if (!ctx.userId) return "Usuario no identificado.";
			const wsCtx = getWorkspaceContext(ctx.userId);
			if (!wsCtx) return "No hay contexto de workspace disponible.";
			return formatWorkspaceForPrompt(wsCtx) || "Contexto de workspace vacío.";
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "get_project_directives",
				description: "Obtiene las directrices y reglas del proyecto. Úsala cuando necesites conocer convenciones, estándares o políticas del proyecto actual.",
				parameters: { type: "object", properties: {} },
			},
		},
		handler: async (_args, _ctx) => {
			const directives = await brain.getDirectives().catch(() => "");
			return directives || "No hay directrices configuradas para este proyecto.";
		},
		enabled: true,
	});
}
