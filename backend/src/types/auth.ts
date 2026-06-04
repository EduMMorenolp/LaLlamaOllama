import { z } from "zod";

export const ToggleAuthSchema = z.object({
  enabled: z.boolean(),
});

export type ToggleAuthRequest = z.infer<typeof ToggleAuthSchema>;

export const ToggleToolSchema = z.object({
  enabled: z.boolean(),
});

export type ToggleToolRequest = z.infer<typeof ToggleToolSchema>;
