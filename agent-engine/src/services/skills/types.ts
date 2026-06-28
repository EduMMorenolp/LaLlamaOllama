export interface SkillMetadata {
	name: string;
	description: string;
	version: string;
	platforms?: string[];
	tags?: string[];
	category?: string;
	requires_toolsets?: string[];
	requires_env?: string[];
	config?: Array<{
		key: string;
		description: string;
		default: string;
		prompt: string;
	}>;
	author?: string;
	created_at?: string;
	updated_at?: string;
}

export interface Skill {
	metadata: SkillMetadata;
	content: string;
	path: string;
	filename: string;
	size: number;
}

export interface SkillProposal {
	metadata: SkillMetadata;
	content: string;
	sourceRunId?: string;
	createdAt: string;
}

export type SkillListEntry = Pick<SkillMetadata, "name" | "description" | "category" | "version">;
