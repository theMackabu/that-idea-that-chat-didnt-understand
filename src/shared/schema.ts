import { z } from "zod";

export const fieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "select", "checkbox", "folder"]),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.boolean()]).optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional()
});

export const generatedUiSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  tool: z.enum(["yt-dlp.download", "noop"]),
  fields: z.array(fieldSchema).min(1).max(12),
  action: z.object({
    label: z.string().min(1),
    tool: z.enum(["yt-dlp.download", "noop"])
  }),
  safety: z.array(z.string()).default([]),
  previewCommand: z.string().optional(),
  aiNote: z.string().optional()
});

export type GeneratedField = z.infer<typeof fieldSchema>;
export type GeneratedUi = z.infer<typeof generatedUiSchema>;

export type ToolRunRequest = {
  tool: GeneratedUi["tool"];
  values: Record<string, string | boolean | undefined>;
};

export type ToolOutputEvent =
  | { runId: string; type: "start"; command: string }
  | { runId: string; type: "chunk"; stream: "stdout" | "stderr"; text: string }
  | { runId: string; type: "exit"; code: number | null; signal: NodeJS.Signals | null };
