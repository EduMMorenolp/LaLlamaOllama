import { z } from "zod";

export const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().nullable(),
  tool_calls: z.array(z.record(z.unknown())).optional(),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
}).passthrough();

export const ChatOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  num_ctx: z.number().int().min(128).max(131072).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().min(0).max(100).optional(),
});

export const ChatRequestSchema = z.object({
  model: z.string().min(1, "model is required"),
  messages: z.array(MessageSchema).min(1, "messages is required"),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  num_ctx: z.number().int().min(128).max(131072).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().min(0).max(100).optional(),
  tools: z.array(z.record(z.unknown())).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
