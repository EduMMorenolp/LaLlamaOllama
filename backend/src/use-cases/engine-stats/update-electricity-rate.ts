import type { OllamaService } from "../../ollama/ollama.service.js";

export class UpdateElectricityRateUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  execute(rateARS: number) {
    this.ollamaService.updateElectricityRate(rateARS);
    return { message: `Tarifa actualizada: ${rateARS} ARS/kWh` };
  }
}
