import { z } from "zod";

export const BanIpSchema = z.object({
	ip: z.string().min(1, "IP is required"),
});

export type BanIpRequest = z.infer<typeof BanIpSchema>;
