import { z } from "zod";

export const PullModelSchema = z.object({
	model: z.string().min(1, "model is required"),
});

export type PullModelRequest = z.infer<typeof PullModelSchema>;
