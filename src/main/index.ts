import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedUiSchema, type ComposeUiRequest, type GeneratedUi, type ToolRunRequest } from '../shared/schema';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const activeRuns = new Map<string, ChildProcessWithoutNullStreams>();

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: 'Workbench',
    backgroundColor: '#0a0a0b',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 13 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.meta || input.key !== ',') return;
    event.preventDefault();
    mainWindow.webContents.send('app:toggle-sidebar');
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('ai:compose-ui', async (_event, request: ComposeUiRequest | string): Promise<GeneratedUi> => {
  const composeRequest = normalizeComposeRequest(request);
  const fallback = createFallbackUi(composeRequest.prompt);
  const localEnv = readLocalEnv();
  const openaiApiKey = localEnv.OPENAI_API_KEY?.trim();

  if (!openaiApiKey) {
    return {
      ...fallback,
      aiNote: 'OPENAI_API_KEY is not set in .env, so this came from the local fallback composer.'
    };
  }

  try {
    const openai = createOpenAI({ apiKey: openaiApiKey });

    const result = await generateObject({
      model: openai(localEnv.OPENAI_MODEL?.trim() || 'gpt-4.1-mini'),
      schema: generatedUiSchema,
      system: [
        'You create schema-driven utility UIs for a local Electron app called Workbench.',
        'Create a compact UI for any local command-line task the user asks for.',
        'Use tool shell.run for executable tasks. Use noop only when there is genuinely nothing local to run.',
        'For shell.run, include a command template in command. Use {{fieldName}} placeholders for user inputs.',
        'Keep fields practical and typed. Use text, textarea, select, checkbox, folder, number, slider, and color fields that map to command arguments.',
        'Use blocks for generated non-input UI: box for notes/status panels, image for image previews, metric for single values, and barChart for simple graphs.',
        'When a request benefits from richer UI, include blocks before fields, such as metrics for counts, bar charts for comparisons, boxes for warnings/instructions, and image blocks for preview URLs or generated file outputs.',
        'The app shell-quotes placeholder values before execution, so do not wrap placeholders in quotes.',
        'Use shell.run for executable tasks, including video downloads, ssh, git, ffmpeg, python, npm, docker, rsync, find, grep, tar, zip, database CLIs, network diagnostics, and system tools.',
        'When useful, generate multiple fields so the user can safely adjust hostnames, folders, flags, formats, services, ports, and filters before running.',
        'The user may be iterating on a previous generated tool. Use the provided conversation context, current UI values, command preview, and recent run output to resolve references like "that", "it", "the downloaded file", "same folder", or "the previous command".',
        'When the user asks to modify a previous artifact or result, preserve and prefill relevant paths, URLs, folders, formats, and options from context instead of asking for them again.'
      ].join(' '),
      prompt: buildComposePrompt(composeRequest)
    });

    return generatedUiSchema.parse(result.object);
  } catch (error) {
    return {
      ...fallback,
      aiNote: `AI composition failed, so Workbench used the local fallback. ${(error as Error).message}`
    };
  }
});

function normalizeComposeRequest(request: ComposeUiRequest | string): ComposeUiRequest {
  return typeof request === 'string' ? { prompt: request } : request;
}

function buildComposePrompt(request: ComposeUiRequest): string {
  const context = {
    recentMessages: (request.messages ?? []).slice(-10),
    currentUi: request.currentUi
      ? {
          title: request.currentUi.title,
          summary: request.currentUi.summary,
          tool: request.currentUi.tool,
          fields: request.currentUi.fields.map(field => ({
            name: field.name,
            label: field.label,
            type: field.type,
            description: field.description,
            defaultValue: field.defaultValue
          })),
          command: request.currentUi.command,
          previewCommand: request.currentUi.previewCommand
        }
      : null,
    currentValues: request.values ?? {},
    currentCommandPreview: request.commandPreview,
    recentRunOutput: (request.recentLogs ?? []).slice(-20)
  };

  return [
    `Latest user request: ${request.prompt}`,
    'Context from the current Workbench thread follows. Use it to preserve continuity and resolve pronouns/deictic references.',
    JSON.stringify(context, null, 2)
  ].join('\n\n');
}

ipcMain.handle('dialog:select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: app.getPath('downloads')
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('tool:run', async (event, request: ToolRunRequest) => {
  const runId = randomUUID();
  const commandConfig = buildCommand(request);
  const sender = event.sender;

  sender.send('tool:output', { runId, type: 'start', command: commandConfig.command });

  const child = spawn(commandConfig.file, commandConfig.args, {
    cwd: commandConfig.cwd,
    env: {
      ...process.env,
      PATH: expandGuiPath(process.env.PATH)
    },
    shell: commandConfig.shell
  });

  activeRuns.set(runId, child);

  child.stdout.on('data', (chunk: Buffer) => {
    sender.send('tool:output', { runId, type: 'chunk', stream: 'stdout', text: chunk.toString() });
  });

  child.stderr.on('data', (chunk: Buffer) => {
    sender.send('tool:output', { runId, type: 'chunk', stream: 'stderr', text: chunk.toString() });
  });

  child.on('error', error => {
    sender.send('tool:output', { runId, type: 'chunk', stream: 'stderr', text: `${error.message}\n` });
  });

  child.on('exit', (code, signal) => {
    activeRuns.delete(runId);
    sender.send('tool:output', { runId, type: 'exit', code, signal });
  });

  return { runId, command: commandConfig.command };
});

ipcMain.handle('tool:cancel', async (_event, runId: string) => {
  const child = activeRuns.get(runId);
  if (!child) return false;
  child.kill('SIGTERM');
  return true;
});

function createFallbackUi(userPrompt: string): GeneratedUi {
  return {
    title: 'Local Command',
    summary: 'A generic command runner for this task. Edit the command before running it.',
    tool: 'shell.run',
    fields: [
      {
        name: 'command',
        label: 'Command',
        type: 'textarea',
        defaultValue: userPrompt,
        description: 'Runs locally in your home folder.'
      }
    ],
    action: { label: 'Run command', tool: 'shell.run' },
    command: '{{command}}',
    previewCommand: '{{command}}',
    safety: ['Command is shown before execution.', 'Runs are cancellable.']
  };
}

function buildCommand(request: ToolRunRequest): {
  file: string;
  args: string[];
  cwd: string;
  shell: boolean;
  command: string;
} {
  if (request.tool === 'shell.run') {
    const command = renderCommandTemplate(request.command || '', request.values).trim();
    if (!command) throw new Error('No command was generated.');
    const argv = splitCommandLine(command);

    if (argv.length > 0 && !needsShell(command)) {
      return {
        file: argv[0],
        args: argv.slice(1),
        cwd: app.getPath('home'),
        shell: false,
        command
      };
    }

    return {
      file: '/bin/zsh',
      args: ['-f', '-c', 'unsetopt nomatch; eval -- "$1"', 'uiterm-shell', command],
      cwd: app.getPath('home'),
      shell: false,
      command
    };
  }

  throw new Error('No executable tool was generated for this task.');
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function splitCommandLine(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaping = true;
      continue;
    }

    if ((char === "'" || char === '"') && !quote) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = null;
      continue;
    }

    if (/\s/.test(char) && !quote) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) args.push(current);
  return args;
}

function needsShell(command: string): boolean {
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaping = true;
      continue;
    }

    if ((char === "'" || char === '"') && !quote) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = null;
      continue;
    }

    if (!quote && '|&;<>$`(){}*?[]!~'.includes(char)) return true;
  }

  return false;
}

function renderCommandTemplate(template: string, values: ToolRunRequest['values']): string {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return shellQuote(String(value ?? ''));
  });
}

function expandGuiPath(currentPath = ''): string {
  const home = app.getPath('home');
  const likelyPaths = [join(home, '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
  const existing = likelyPaths.filter(path => existsSync(path));
  return [...existing, currentPath].filter(Boolean).join(':');
}

function readLocalEnv(): Record<string, string> {
  const candidates = [join(process.cwd(), '.env'), join(__dirname, '../../.env')];
  const envPath = candidates.find((path, index) => candidates.indexOf(path) === index && existsSync(path));
  if (!envPath) return {};
  return parseDotEnv(readFileSync(envPath, 'utf8'));
}

function parseDotEnv(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    const quote = value[0];

    if ((quote === `"` || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }

    if (key) values[key] = quote === `"` ? value.replaceAll('\\n', '\n') : value;
  }

  return values;
}
