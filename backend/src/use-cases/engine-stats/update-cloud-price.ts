import type { OllamaService } from "../../ollama/ollama.service.js";

export class UpdateCloudPriceUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  execute(pricePerMToken: number) {
    this.ollamaService.updateCloudPrice(pricePerMToken);
    return { message: `Precio cloud actualizado: $${pricePerMToken} USD/1M tokens` };
  }
}
