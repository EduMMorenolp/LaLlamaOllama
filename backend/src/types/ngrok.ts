import { z } from "zod";

export const NgrokAuthtokenSchema = z.object({
  authtoken: z.string().min(10, "authtoken must be at least 10 characters"),
});

export type NgrokAuthtokenRequest = z.infer<typeof NgrokAuthtokenSchema>;
