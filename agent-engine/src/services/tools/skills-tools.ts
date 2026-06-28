import type { AppConfig } from "../config.js";
import { SkillsService } from "../skills/service.js";
import { toolRegistry } from "./registry.js";
import type { ToolContext } from "./types.js";

let skillsService: SkillsService;

export function initSkillsService(config: AppConfig): void {
	skillsService = new SkillsService(config.workspaceDir);
}

export function getSkillsService(): SkillsService {
	return skillsService;
}

export function registerSkillsTools(config: AppConfig) {
	initSkillsService(config);

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "skills_list",
				description:
					"Lista todas las skills/habilidades procedurales disponibles. " +
					"Cada skill tiene nombre, descripción, categoría y versión. " +
					"Nivel 0 de progressive disclosure: solo metadatos (~3k tokens total). " +
					"Usa skill_view para ver el contenido completo de una skill.",
				parameters: {
					type: "object",
					properties: {
						category: {
							type: "string",
							description: "Filtrar por categoría (opcional). Ej: devops, coding, writing, research",
						},
					},
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const categoryFilter = args.category as string | undefined;
			let skills = skillsService.list();

			if (categoryFilter) {
				skills = skills.filter((s) => s.category?.toLowerCase() === categoryFilter.toLowerCase());
			}

			if (skills.length === 0) {
				return "No hay skills disponibles.";
			}

			const lines = ["## Skills disponibles", ""];
			for (const s of skills) {
				const cat = s.category ? `[${s.category}]` : "[general]";
				lines.push(`- **${s.name}** ${cat} — ${s.description} (v${s.version})`);
			}
			lines.push("");
			lines.push(`Total: ${skills.length} skills.`);
			lines.push("Usa `skill_view` para ver el contenido completo de una skill.");
			return lines.join("\n");
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "skill_view",
				description:
					"Muestra el contenido completo de una skill procedural. " +
					"Nivel 1 de progressive disclosure: carga el contenido específico de una skill. " +
					"Usa después de skills_list para obtener detalles de una skill relevante.",
				parameters: {
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Nombre exacto de la skill a visualizar",
						},
					},
					required: ["name"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const name = args.name as string;
			if (!name) return "Error: name es requerido.";

			const skill = skillsService.view(name);
			if (!skill) {
				return `Skill "${name}" no encontrada. Usa skills_list para ver las disponibles.`;
			}

			const lines = [
				`# ${skill.metadata.name} (v${skill.metadata.version})`,
				`**Descripción:** ${skill.metadata.description}`,
			];
			if (skill.metadata.category) lines.push(`**Categoría:** ${skill.metadata.category}`);
			if (skill.metadata.tags?.length) lines.push(`**Tags:** ${skill.metadata.tags.join(", ")}`);
			if (skill.metadata.platforms?.length) lines.push(`**Plataformas:** ${skill.metadata.platforms.join(", ")}`);
			if (skill.metadata.author) lines.push(`**Autor:** ${skill.metadata.author}`);
			lines.push("");
			lines.push(skill.content);
			lines.push("");

			const proposalCount = skillsService.listProposals().length;
			if (proposalCount > 0) {
				lines.push(`---\n📋 Hay ${proposalCount} propuesta(s) de skill pendientes de revisión.`);
			}

			return lines.join("\n");
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "skill_manage",
				description:
					"Gestiona skills: crear, actualizar, parchar o eliminar una skill procedural. " +
					"CREAR: usa cuando resuelvas una tarea compleja (5+ tool calls) y quieras guardar el procedimiento. " +
					"PARCHEAR: usa para actualizar una skill existente con nueva información o mejores prácticas. " +
					"ELIMINAR: usa cuando una skill ya no sea relevante. " +
					"Las skills creadas se almacenan como SKILL.md y quedan disponibles para futuras sesiones.",
				parameters: {
					type: "object",
					properties: {
						action: {
							type: "string",
							enum: ["create", "patch", "delete", "propose"],
							description: "Acción a realizar: create (nueva), patch (actualizar existente), delete (eliminar), propose (proponer para revisión)",
						},
						name: {
							type: "string",
							description: "Nombre único de la skill (kebab-case recomendado)",
						},
						description: {
							type: "string",
							description: "Descripción breve de qué hace la skill",
						},
						content: {
							type: "string",
							description: "Contenido markdown de la skill. Incluye: cuándo usarla, procedimiento paso a paso, pitfalls, verificación",
						},
						category: {
							type: "string",
							description: "Categoría: coding, devops, research, writing, productivity, system, custom",
						},
						tags: {
							type: "string",
							description: "Tags separados por coma para clasificación",
						},
						version: {
							type: "string",
							description: "Versión semántica (default: 1.0.0)",
						},
					},
					required: ["action", "name"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const action = args.action as string;
			const name = args.name as string;
			const description = (args.description as string) || "";
			const content = (args.content as string) || "";
			const category = args.category as string | undefined;
			const tags = args.tags as string | undefined;
			const version = (args.version as string) || "1.0.0";

			if (!name) return "Error: name es requerido.";

			switch (action) {
				case "create": {
					if (!content) return "Error: content es requerido para crear una skill.";

					const ok = skillsService.create(
						{
							name,
							description,
							version,
							category,
							tags: tags?.split(",").map((s) => s.trim()).filter(Boolean),
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
						},
						content
					);

					return ok
						? `✅ Skill "${name}" creada exitosamente. Disponible en futuras sesiones.`
						: `Error: no se pudo crear la skill "${name}".`;
				}

				case "patch": {
					const existing = skillsService.view(name);
					if (!existing) {
						return `Error: skill "${name}" no encontrada. Usa 'create' para crearla.`;
					}

					const updates: Record<string, unknown> = {};
					if (description) updates.description = description;
					if (category) updates.category = category;
					if (tags) updates.tags = tags.split(",").map((s) => s.trim()).filter(Boolean);
					if (version) updates.version = version;

					const ok = skillsService.patch(name, updates as any, content || undefined);
					return ok
						? `✅ Skill "${name}" actualizada exitosamente.`
						: `Error: no se pudo actualizar la skill "${name}".`;
				}

				case "delete": {
					const ok = skillsService.delete(name);
					return ok
						? `🗑️ Skill "${name}" eliminada.`
						: `Error: skill "${name}" no encontrada.`;
				}

				case "propose": {
					if (!content) return "Error: content es requerido para proponer una skill.";

					const ok = skillsService.createProposal({
						metadata: {
							name,
							description,
							version,
							category,
							tags: tags?.split(",").map((s) => s.trim()).filter(Boolean),
							created_at: new Date().toISOString(),
						},
						content,
						createdAt: new Date().toISOString(),
					});

					return ok
						? `📋 Propuesta de skill "${name}" creada. Queda pendiente de revisión por el usuario.`
						: `Error: no se pudo crear la propuesta.`;
				}

				default:
					return `Error: acción "${action}" no válida. Usa: create, patch, delete, propose.`;
			}
		},
		enabled: true,
	});
}
