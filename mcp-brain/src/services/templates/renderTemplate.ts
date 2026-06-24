import type { RenderResult, Template } from "./types.js";

function interpolate(text: string, variables: Record<string, string>): string {
	return text.replace(
		/\{\{(\w+)\}\}/g,
		(_, key) => variables[key] ?? `{{${key}}}`,
	);
}

export function renderTemplate(
	template: Template,
	variables: Record<string, string>,
): RenderResult {
	// Check for missing required variables
	const missing = template.variables
		.filter((v) => v.required && !variables[v.name] && !v.default)
		.map((v) => v.name);

	// Merge defaults for non-provided optional vars
	const merged: Record<string, string> = {};
	for (const v of template.variables) {
		merged[v.name] = variables[v.name] ?? v.default ?? "";
	}
	// Include any extra variables passed in
	for (const [k, val] of Object.entries(variables)) {
		merged[k] = val;
	}

	const content = interpolate(template.content, merged);
	const output_path = template.output_path
		? interpolate(template.output_path, merged)
		: "";

	return {
		content,
		output_path,
		missing,
		template_id: template.id,
	};
}
