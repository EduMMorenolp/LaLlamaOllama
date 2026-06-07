import type { OllamaService } from "../../ollama/ollama.service.js";

export class GetHardwareInfoUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  execute() {
    return {
      vram: this.ollamaService.getVramInfo(),
      autoUnloadMinutes: this.ollamaService.getAutoUnload(),
      globalNumCtx: this.ollamaService.getGlobalNumCtx(),
    };
  }
}
