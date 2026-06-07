import { Router } from "express";
import type { RequestHandler } from "express";
import type { GetEngineStatsUseCase } from "../use-cases/engine-stats/get-engine-stats.js";
import type { UpdateElectricityRateUseCase } from "../use-cases/engine-stats/update-electricity-rate.js";
import type { UpdateCloudPriceUseCase } from "../use-cases/engine-stats/update-cloud-price.js";

export function createEngineStatsRouter(
  getEngineStats: GetEngineStatsUseCase,
  updateElectricityRate: UpdateElectricityRateUseCase,
  updateCloudPrice: UpdateCloudPriceUseCase,
  authMiddleware: RequestHandler
) {
  const router = Router();

  router.get("/api/engine-stats", authMiddleware, (_req, res) => {
    res.json(getEngineStats.execute());
  });

  router.post("/api/engine-stats/electricity-rate", authMiddleware, (req, res) => {
    const { rateARS } = req.body;
    if (typeof rateARS !== "number" || rateARS < 0) {
      return res.status(400).json({
        error: { message: "rateARS debe ser un numero >= 0", type: "invalid_request_error" },
      });
    }
    res.json(updateElectricityRate.execute(rateARS));
  });

  router.post("/api/engine-stats/cloud-price", authMiddleware, (req, res) => {
    const { pricePerMToken } = req.body;
    if (typeof pricePerMToken !== "number" || pricePerMToken < 0) {
      return res.status(400).json({
        error: { message: "pricePerMToken debe ser >= 0", type: "invalid_request_error" },
      });
    }
    res.json(updateCloudPrice.execute(pricePerMToken));
  });

  return router;
}
