import Docker from "dockerode";

export class DockerContainerRepository {
  private readonly docker: Docker;

  constructor(socketPath = "/var/run/docker.sock") {
    this.docker = new Docker({ socketPath });
  }

  async getContainer(name: string) {
    try {
      return this.docker.getContainer(name);
    } catch {
      return null;
    }
  }

  async isRunning(name: string): Promise<boolean> {
    const container = await this.getContainer(name);
    if (!container) return false;
    try {
      const info = await container.inspect();
      return info.State?.Running === true;
    } catch {
      return false;
    }
  }

  async startContainer(name: string): Promise<void> {
    const container = await this.getContainer(name);
    if (!container) throw new Error(`Container ${name} not found`);
    await container.start();
  }

  async stopContainer(name: string): Promise<void> {
    const container = await this.getContainer(name);
    if (!container) throw new Error(`Container ${name} not found`);
    await container.stop();
  }

  async restartContainer(name: string): Promise<void> {
    const container = await this.getContainer(name);
    if (!container) throw new Error(`Container ${name} not found`);
    await container.restart();
  }

  async execCommand(name: string, cmd: string[]): Promise<void> {
    const container = await this.getContainer(name);
    if (!container) throw new Error(`Container ${name} not found`);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ hijack: true, stdin: false });
    await new Promise<void>((resolve, reject) => {
      stream.on("end", () => resolve());
      stream.on("error", (err) => reject(err));
    });
    const result = await exec.inspect();
    if (result.ExitCode !== 0) {
      throw new Error(`Command failed (exit=${result.ExitCode})`);
    }
  }
}
