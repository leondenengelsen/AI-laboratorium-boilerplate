import { z } from "zod";

const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

export const chatRequestSchema = z.object({
  provider: z.string().min(1, "provider is required"),
  model: z.string().min(1, "model is required"),
  systemMessage: z.string().default(""),
  tone: z.string().default(""),
  userMessage: z.string().default(""),
  messages: z.array(conversationMessageSchema).optional(),
  config: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
    })
    .optional(),
}).refine(
  (data) => (data.messages && data.messages.length > 0) || data.userMessage.length > 0,
  { message: "Either messages or userMessage is required" }
);

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

export const saveKeySchema = z.object({
  provider: z.string().min(1, "provider is required"),
  label: z.string().min(1, "label is required"),
  key: z.string().min(1, "key is required"),
});

export type SaveKeyBody = z.infer<typeof saveKeySchema>;

export const presetRequestSchema = z.object({
  name: z.string().min(1, "name is required"),
  systemMessage: z.string().default(""),
  tone: z.string().default(""),
  context: z.string().default(""),
});

export type PresetRequestBody = z.infer<typeof presetRequestSchema>;
