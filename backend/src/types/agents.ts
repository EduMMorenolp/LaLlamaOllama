import { z } from "zod";

export const AnalyzeProjectSchema = z.object({
	model: z.string().min(1),
	projectName: z.string().min(1),
	structure: z.any(),
	configFiles: z.record(z.any()).optional(),
});

export type AnalyzeProjectRequest = z.infer<typeof AnalyzeProjectSchema>;
