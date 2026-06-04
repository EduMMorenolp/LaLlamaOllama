import { z } from "zod";

export const AutoUnloadSchema = z.object({
  minutes: z.number().min(0, "minutes must be >= 0"),
});

export type AutoUnloadRequest = z.infer<typeof AutoUnloadSchema>;

export const NumCtxSchema = z.object({
  numCtx: z.number().int().min(512, "numCtx must be >= 512"),
});

export type NumCtxRequest = z.infer<typeof NumCtxSchema>;
