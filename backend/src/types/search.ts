import { z } from "zod";

export const SearchModelsSchema = z.object({
	q: z.string().optional().default(""),
	sort: z.string().optional().default(""),
});

export type SearchModelsRequest = z.infer<typeof SearchModelsSchema>;
