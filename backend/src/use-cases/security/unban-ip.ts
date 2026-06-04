import type { OllamaService } from "../../ollama/ollama.service.js";

export class UnbanIpUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  execute(ip: string) {
    this.ollamaService.unbanIp(ip);
    return { message: `IP ${ip} unbanned` };
  }
}
