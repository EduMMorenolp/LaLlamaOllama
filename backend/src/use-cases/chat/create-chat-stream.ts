import type { Response } from "express";
import type { OllamaService } from "../../ollama/ollama.service.js";
import type { ChatRequest } from "../../types/chat.js";
import logger from "../../utils/logger.js";

export class CreateChatStreamUseCase {
  private readonly log = logger.child({ component: "chat-stream" });

  constructor(private readonly ollamaService: OllamaService) {}

  async execute(input: ChatRequest, res: Response): Promise<void> {
    const { model, messages, stream: _stream, user, ...options } = input;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const streamStartMs = Date.now();
    const streamResponse = await this.ollamaService.chatStream(
      model,
      messages,
      {
        temperature: options.temperature,
        num_ctx: options.num_ctx,
        top_p: options.top_p,
        top_k: options.top_k,
      },
      "5m",
      user,
      options.tools
    );

    let _fullResponse = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let firstTokenReceived = false;
    let ttftMs = 0;
    let hadToolCalls = false;

    streamResponse.data.on("data", (chunk: Buffer) => {
      try {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          if (!line || !line.trim()) continue;
          const data = JSON.parse(line);

          const hasToolCalls = data.message?.tool_calls && data.message.tool_calls.length > 0;
          const hasContent = data.message?.content?.length > 0;

          if (hasContent) {
            if (!firstTokenReceived) {
              ttftMs = Date.now() - streamStartMs;
              firstTokenReceived = true;
              this.log.info({ model, ttftMs }, "stream-ttft");
            }
            _fullResponse += data.message.content;
            completionTokens = data.eval_count || 0;
            promptTokens = data.prompt_eval_count || 0;
          }

          const delta: Record<string, unknown> = {};
          if (hasContent) {
            delta.content = data.message.content;
          }
          if (hasToolCalls) {
            hadToolCalls = true;
            delta.tool_calls = data.message.tool_calls.map(
              (tc: Record<string, unknown>, i: number) => {
                const fn = tc.function as Record<string, unknown> | undefined;
                const args = fn?.arguments;
                return {
                  index: i,
                  id: (tc.id as string) || "call_" + (fn?.name || i),
                  type: "function",
                  function: {
                    name: fn?.name || tc.name || "",
                    arguments:
                      typeof args === "object"
                        ? JSON.stringify(args)
                        : typeof args === "string"
                          ? args
                          : "",
                  },
                };
              }
            );
            promptTokens = data.prompt_eval_count || 0;
          }

          const sseData = {
            id: "chatcmpl-" + Date.now(),
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                index: 0,
                delta,
                finish_reason: null,
              },
            ],
          };
          res.write("data: " + JSON.stringify(sseData) + "\n\n");
        }
      } catch {
        /* ignore parse errors */
      }
    });

    streamResponse.data.on("end", () => {
      const totalDurationMs = Date.now() - streamStartMs;
      const tokensPerSec = completionTokens > 0 ? (completionTokens / totalDurationMs) * 1000 : 0;

      if (ttftMs > 0) {
        const stats = this.ollamaService.getStats();
        if (!Array.isArray(stats.ttftHistory)) stats.ttftHistory = [];
        stats.ttftHistory.push(ttftMs);
        if (stats.ttftHistory.length > 100) stats.ttftHistory.shift();

        if (!Array.isArray(stats.tokensPerSecHistor)) stats.tokensPerSecHistor = [];
        stats.tokensPerSecHistor.push(tokensPerSec);
        if (stats.tokensPerSecHistor.length > 100) stats.tokensPerSecHistor.shift();
      }

      this.log.info({ model, totalDurationMs, tokensPerSec: tokensPerSec.toFixed(2), ttftMs }, "stream-final");

      const finalData = {
        id: "chatcmpl-" + Date.now(),
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: hadToolCalls ? "tool_calls" : "stop",
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      };
      res.write("data: " + JSON.stringify(finalData) + "\n\n");
      res.write("data: [DONE]\n\n");
      res.end();
    });

    streamResponse.data.on("error", (err: Error) => {
      this.log.error(err, "stream-error");
      res.write("data: " + JSON.stringify({ error: { message: err.message, type: "server_error" } }) + "\n\n");
      res.end();
    });
  }
}