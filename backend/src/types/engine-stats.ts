import { z } from "zod";

export const ElectricityRateSchema = z.object({
  rateARS: z.number().min(0, "rateARS must be >= 0"),
});

export type ElectricityRateRequest = z.infer<typeof ElectricityRateSchema>;

export const CloudPriceSchema = z.object({
  pricePerMToken: z.number().min(0, "pricePerMToken must be >= 0"),
});

export type CloudPriceRequest = z.infer<typeof CloudPriceSchema>;
