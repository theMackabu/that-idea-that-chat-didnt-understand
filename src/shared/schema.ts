import { z } from "zod";

export const fieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "select", "checkbox", "file", "folder", "number", "slider", "color"]),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.boolean(), z.number()]).optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional()
});

export const generatedBlockSchema = z.object({
  type: z.enum(["box", "image", "metric", "barChart"]),
  title: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
  alt: z.string().optional(),
  label: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  data: z.array(z.object({ label: z.string(), value: z.number() })).optional()
});

export const generatedUiSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  tool: z.enum(["shell.run", "noop"]),
  blocks: z.array(generatedBlockSchema).max(12).optional(),
  fields: z.array(fieldSchema).max(12),
  action: z.object({
    label: z.string().min(1),
    tool: z.enum(["shell.run", "noop"])
  }),
  safety: z.array(z.string()).default([]),
  command: z.string().optional(),
  previewCommand: z.string().optional(),
  aiNote: z.string().optional()
});

export type GeneratedField = z.infer<typeof fieldSchema>;
export type GeneratedBlock = z.infer<typeof generatedBlockSchema>;
export type GeneratedUi = z.infer<typeof generatedUiSchema>;

export type ToolRunRequest = {
  tool: GeneratedUi["tool"];
  values: Record<string, string | number | boolean | undefined>;
  command?: string;
};

export type ComposeUiRequest = {
  prompt: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  currentUi?: GeneratedUi | null;
  values?: Record<string, string | number | boolean | undefined>;
  commandPreview?: string;
  recentLogs?: string[];
};

export type ToolOutputEvent =
  | { runId: string; type: "start"; command: string }
  | { runId: string; type: "retry"; command: string; reason: string }
  | { runId: string; type: "chunk"; stream: "stdout" | "stderr"; text: string }
  | { runId: string; type: "exit"; code: number | null; signal: NodeJS.Signals | null };
