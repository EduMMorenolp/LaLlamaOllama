export class GetNgrokConfigUseCase {
  constructor(
    private readonly containerName: string,
    private readonly appPort: string,
    private readonly authtokenConfigured: boolean
  ) {}

  execute() {
    return {
      containerName: this.containerName,
      targetService: "mcp-server",
      targetPort: this.appPort,
      dashboardApiUrl: "http://mcp-ngrok-tunnel:4040/api/tunnels",
      authtokenConfigured: this.authtokenConfigured,
    };
  }
}
