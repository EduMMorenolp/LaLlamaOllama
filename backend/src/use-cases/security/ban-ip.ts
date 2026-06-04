import type { OllamaService } from "../../ollama/ollama.service.js";

export class BanIpUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  execute(ip: string) {
    this.ollamaService.banIp(ip);
    return { message: `IP ${ip} banned` };
  }
}
