import axios from "axios";
import { DockerContainerRepository } from "../../repositories/docker-container.repository.js";

export class GetNgrokStatusUseCase {
  constructor(
    private readonly dockerRepo: DockerContainerRepository,
    private readonly containerName: string
  ) {}

  async execute() {
    try {
      const container = await this.dockerRepo.getContainer(this.containerName);
      if (!container) return { running: false, url: null };
      const running = await this.dockerRepo.isRunning(this.containerName);
      let url: string | null = null;
      if (running) {
        try {
          const ngrokRes = await axios.get("http://mcp-ngrok-tunnel:4040/api/tunnels", { timeout: 2000 });
          url = ngrokRes.data?.tunnels?.[0]?.public_url || null;
        } catch {
          /* tunnel still starting */
        }
      }
      return { running, url };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { running: false, url: null, error: message };
    }
  }
}
