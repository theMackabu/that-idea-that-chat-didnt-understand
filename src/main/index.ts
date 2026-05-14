import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generatedUiSchema, type GeneratedUi, type ToolRunRequest } from "../shared/schema";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const activeRuns = new Map<string, ChildProcessWithoutNullStreams>();

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: "UITerm",
    backgroundColor: "#0a0a0b",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 17 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("ai:compose-ui", async (_event, userPrompt: string): Promise<GeneratedUi> => {
  const fallback = createFallbackUi(userPrompt);
  const localEnv = readLocalEnv();
  const openaiApiKey = localEnv.OPENAI_API_KEY?.trim();

  if (!openaiApiKey) {
    return {
      ...fallback,
      aiNote: "OPENAI_API_KEY is not set in .env, so this came from the local fallback composer."
    };
  }

  try {
    const openai = createOpenAI({ apiKey: openaiApiKey });

    const result = await generateObject({
      model: openai(localEnv.OPENAI_MODEL?.trim() || "gpt-4.1-mini"),
      schema: generatedUiSchema,
      system: [
        "You create schema-driven utility UIs for a local Electron app called UITerm.",
        "Create a compact UI for any local command-line task the user asks for.",
        "Use tool shell.run for executable tasks. Use noop only when there is genuinely nothing local to run.",
        "For shell.run, include a command template in command. Use {{fieldName}} placeholders for user inputs.",
        "Keep fields practical and typed. Prefer text, textarea, select, checkbox, and folder fields that map to command arguments.",
        "The app shell-quotes placeholder values before execution, so do not wrap placeholders in quotes.",
        "For video download requests you may use yt-dlp.download, but shell.run is valid for everything else including ssh, git, ffmpeg, python, npm, docker, rsync, find, grep, tar, zip, database CLIs, network diagnostics, and system tools.",
        "When useful, generate multiple fields so the user can safely adjust hostnames, folders, flags, formats, services, ports, and filters before running."
      ].join(" "),
      prompt: `User request: ${userPrompt}`
    });

    return generatedUiSchema.parse(result.object);
  } catch (error) {
    return {
      ...fallback,
      aiNote: `AI composition failed, so UITerm used the local fallback. ${(error as Error).message}`
    };
  }
});

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    defaultPath: app.getPath("downloads")
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("tool:run", async (event, request: ToolRunRequest) => {
  const runId = randomUUID();
  const commandConfig = buildCommand(request);
  const sender = event.sender;

  sender.send("tool:output", { runId, type: "start", command: commandConfig.command });

  const child = spawn(commandConfig.file, commandConfig.args, {
    cwd: commandConfig.cwd,
    env: {
      ...process.env,
      PATH: expandGuiPath(process.env.PATH)
    },
    shell: commandConfig.shell
  });

  activeRuns.set(runId, child);

  child.stdout.on("data", (chunk: Buffer) => {
    sender.send("tool:output", { runId, type: "chunk", stream: "stdout", text: chunk.toString() });
  });

  child.stderr.on("data", (chunk: Buffer) => {
    sender.send("tool:output", { runId, type: "chunk", stream: "stderr", text: chunk.toString() });
  });

  child.on("error", (error) => {
    sender.send("tool:output", { runId, type: "chunk", stream: "stderr", text: `${error.message}\n` });
  });

  child.on("exit", (code, signal) => {
    activeRuns.delete(runId);
    sender.send("tool:output", { runId, type: "exit", code, signal });
  });

  return { runId, command: commandConfig.command };
});

ipcMain.handle("tool:cancel", async (_event, runId: string) => {
  const child = activeRuns.get(runId);
  if (!child) return false;
  child.kill("SIGTERM");
  return true;
});

function createFallbackUi(userPrompt: string): GeneratedUi {
  const lower = userPrompt.toLowerCase();
  const looksLikeVideoDownload =
    lower.includes("download") ||
    lower.includes("video") ||
    lower.includes("youtube") ||
    lower.includes("yt-dlp");

  if (!looksLikeVideoDownload) {
    return {
      title: "Local Command",
      summary: "A generic command runner for this task. Edit the command before running it.",
      tool: "shell.run",
      fields: [
        {
          name: "command",
          label: "Command",
          type: "textarea",
          defaultValue: userPrompt,
          description: "Runs locally in your home folder."
        }
      ],
      action: { label: "Run command", tool: "shell.run" },
      command: "{{command}}",
      previewCommand: "{{command}}",
      safety: ["Command is shown before execution.", "Runs are cancellable."]
    };
  }

  return {
    title: "Video Downloader",
    summary: "A focused yt-dlp wrapper generated from your chat request.",
    tool: "yt-dlp.download",
    fields: [
      {
        name: "urls",
        label: "Video URLs",
        type: "textarea",
        placeholder: "https://www.youtube.com/watch?v=...",
        required: true,
        description: "One URL per line."
      },
      {
        name: "quality",
        label: "Quality",
        type: "select",
        defaultValue: "best",
        options: [
          { label: "Best available", value: "best" },
          { label: "1080p cap", value: "1080p" },
          { label: "720p cap", value: "720p" },
          { label: "Audio only MP3", value: "audio" }
        ]
      },
      {
        name: "outputDir",
        label: "Output folder",
        type: "folder",
        defaultValue: app.getPath("downloads")
      },
      {
        name: "subtitles",
        label: "Write auto subtitles",
        type: "checkbox",
        defaultValue: false
      }
    ],
    action: { label: "Download", tool: "yt-dlp.download" },
    previewCommand: "yt-dlp -P <output folder> -f <quality> <urls>",
    safety: ["Command arguments are assembled by the app, not by generated shell text.", "Runs are cancellable."]
  };
}

function buildCommand(request: ToolRunRequest): {
  file: string;
  args: string[];
  cwd: string;
  shell: boolean;
  command: string;
} {
  if (request.tool === "yt-dlp.download") {
    const { args, outputDir } = buildYtDlpArgs(request.values);
    return {
      file: "yt-dlp",
      args,
      cwd: outputDir,
      shell: false,
      command: `yt-dlp ${args.map(shellQuote).join(" ")}`
    };
  }

  if (request.tool === "shell.run") {
    const command = renderCommandTemplate(request.command || "", request.values).trim();
    if (!command) throw new Error("No command was generated.");

    return {
      file: command,
      args: [],
      cwd: app.getPath("home"),
      shell: true,
      command
    };
  }

  throw new Error("No executable tool was generated for this task.");
}

function buildYtDlpArgs(values: ToolRunRequest["values"]): { args: string[]; outputDir: string } {
  const urls = String(values.urls || "")
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    throw new Error("Add at least one video URL.");
  }

  const outputDir = String(values.outputDir || app.getPath("downloads"));
  const quality = String(values.quality || "best");
  const args = ["--newline", "-P", outputDir, "-o", "%(title).200B [%(id)s].%(ext)s"];

  if (quality === "audio") {
    args.push("-x", "--audio-format", "mp3");
  } else if (quality === "1080p") {
    args.push("-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best");
  } else if (quality === "720p") {
    args.push("-f", "bestvideo[height<=720]+bestaudio/best[height<=720]/best");
  } else {
    args.push("-f", "bestvideo*+bestaudio/best");
  }

  if (values.subtitles === true) {
    args.push("--write-auto-subs", "--sub-langs", "all");
  }

  args.push(...urls);
  return { args, outputDir };
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function renderCommandTemplate(template: string, values: ToolRunRequest["values"]): string {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (typeof value === "boolean") return value ? "true" : "false";
    return shellQuote(String(value ?? ""));
  });
}

function expandGuiPath(currentPath = ""): string {
  const home = app.getPath("home");
  const likelyPaths = [join(home, ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
  const existing = likelyPaths.filter((path) => existsSync(path));
  return [...existing, currentPath].filter(Boolean).join(":");
}

function readLocalEnv(): Record<string, string> {
  const candidates = [join(process.cwd(), ".env"), join(__dirname, "../../.env")];
  const envPath = candidates.find((path, index) => candidates.indexOf(path) === index && existsSync(path));
  if (!envPath) return {};
  return parseDotEnv(readFileSync(envPath, "utf8"));
}

function parseDotEnv(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    const quote = value[0];

    if ((quote === `"` || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }

    if (key) values[key] = quote === `"` ? value.replaceAll("\\n", "\n") : value;
  }

  return values;
}
