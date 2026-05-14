import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { app, BrowserWindow, dialog, ipcMain, type WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
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

    const modelName = localEnv.OPENAI_MODEL?.trim() || 'gpt-5.2';
    const result = await generateObject({
      model: openai(modelName),
      schema: generatedUiSchema,
      system: [
        'You create schema-driven utility UIs for a local Electron app called Workbench.',
        'The app runs on macOS. Use macOS commands such as open, pbcopy, and osascript where appropriate. Do not use Linux-only commands like xdg-open.',
        'Create a compact UI for any local command-line task the user asks for.',
        'Use tool shell.run for executable tasks. Use noop only when there is genuinely nothing local to run.',
        'For shell.run, include a command template in command. Use {{fieldName}} placeholders for user inputs.',
        'Keep fields practical and typed. Use text, textarea, select, checkbox, file, folder, number, slider, and color fields that map to command arguments.',
        'Use file fields for source files, config files, archives, media files, PDFs, logs, and explicit output files. Use folder fields only for directories.',
        'Prefer picker-backed file/folder fields over asking the user to type paths.',
        'Use blocks for generated non-input UI: box for notes/status panels, image for image previews, metric for single values, and barChart for simple graphs.',
        'When a request benefits from richer UI, include blocks before fields, such as metrics for counts, bar charts for comparisons, boxes for warnings/instructions, and image blocks for preview URLs or generated file outputs.',
        'The app shell-quotes placeholder values before execution, so do not wrap placeholders in quotes.',
        'Use shell.run for executable tasks, including video downloads, ssh, git, ffmpeg, python, npm, docker, rsync, find, grep, tar, zip, database CLIs, network diagnostics, and system tools.',
        'When useful, generate multiple fields so the user can safely adjust hostnames, folders, flags, formats, services, ports, and filters before running.',
        'The user may be iterating on a previous generated tool. Use the provided conversation context, current UI values, command preview, and recent run output to resolve references like "that", "it", "the downloaded file", "same folder", or "the previous command".',
        'When the user asks to modify a previous artifact or result, preserve and prefill relevant paths, URLs, folders, formats, and options from context instead of asking for them again.',
        'For follow-up requests like "convert that downloaded file", use the concrete producedFiles path from context as the file field defaultValue and command input. Do not re-run the previous download or generation step.',
        'For follow-up requests like "play it", "open it", or "watch it", generate a one-click opener using open and the concrete producedFiles path from context.',
        'Never hardcode guessed filenames like video.mp4, output.mp4, result.txt, or %(title)s as later input paths. If a later step needs a file path, expose an explicit file field or use a concrete path from recent output.',
        'Use sparse UI copy: titles should be 2 to 5 words, summaries should be one short sentence, field descriptions should be omitted unless truly helpful, and any description should be under 8 words.',
        'Avoid explanatory box blocks for obvious workflows. Prefer concise controls over paragraphs.',
        'Do not add safety text telling the user to ensure a CLI is installed or works. Workbench checks missing executables before running.'
      ].join(' '),
      prompt: buildComposePrompt(composeRequest)
    });

    const draftUi = generatedUiSchema.parse(result.object);
    const reviewedUi = await reviewGeneratedUi(openai, localEnv.OPENAI_REVIEW_MODEL?.trim() || modelName, composeRequest, draftUi);
    return generatedUiSchema.parse(reviewedUi);
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
  const currentRunOutput = (request.recentLogs ?? []).slice(-120);
  const previousTools = (request.previousTools ?? []).slice(-5).map(tool => {
    const recentLogs = tool.recentLogs.slice(-120);
    return {
      title: tool.title,
      summary: tool.summary,
      values: tool.values,
      commandPreview: tool.commandPreview,
      recentRunOutput: recentLogs,
      producedFiles: extractExistingOutputPaths(recentLogs.join('\n'), app.getPath('home'))
    };
  });
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
    recentRunOutput: currentRunOutput,
    producedFiles: extractExistingOutputPaths(currentRunOutput.join('\n'), app.getPath('home')),
    previousTools
  };

  return [
    `Latest user request: ${request.prompt}`,
    'Context from the current Workbench thread follows. Use it to preserve continuity and resolve pronouns/deictic references.',
    JSON.stringify(context, null, 2)
  ].join('\n\n');
}

async function reviewGeneratedUi(
  openai: ReturnType<typeof createOpenAI>,
  modelName: string,
  request: ComposeUiRequest,
  draftUi: GeneratedUi
): Promise<GeneratedUi> {
  const toolAvailability = inspectGeneratedUiToolAvailability(draftUi);
  const result = await generateObject({
    model: openai(modelName),
    schema: generatedUiSchema,
    system: [
      'You are a command correctness reviewer for Workbench.',
      'Return the corrected UI object only.',
      'Preserve the user intent and concise UI style, but fix command mistakes before the UI reaches the user.',
      'Every {{placeholder}} in command or previewCommand must correspond to a field name.',
      'Every field that affects execution should be represented in the command.',
      'Do not invent hardcoded local paths unless supplied by the user context.',
      'Use file fields for individual input/output paths and folder fields for directories; prefer picker-backed fields over plain text path inputs.',
      'When context contains producedFiles and the latest request refers to that prior output, the UI must use a file field defaultValue set to the matching producedFiles path and the command must operate on that field.',
      'For follow-up transforms, do not include the old download/generation command again unless the user explicitly asked to redo it.',
      'For requests to play, open, or watch an existing produced file, use macOS open against that file. Do not redownload or transform it.',
      'Do not use an output template, glob, CLI-specific placeholder, or generated filename pattern as if it were a concrete file path in a later command.',
      'Reject guessed filenames such as video.mp4, output.mp4, result.txt, and %(title)s whenever the real produced filename can differ.',
      'If a command must use a later output file, add an explicit output file/path field and reference that field consistently.',
      'If the request depends on an external CLI, keep it as a shell.run command. The runtime will check whether the CLI exists.',
      'Use the tool availability report. If the generated UI says a tool is missing but the report has installed alternatives, convert the UI back into a runnable shell.run tool using the installed alternative.',
      'If the generated command uses a missing executable, replace it with an installed equivalent from alternatives when one fits the intent.',
      'Do not return noop for a missing executable when an installed equivalent appears in alternatives.',
      'The app runs on macOS. Replace Linux-only openers such as xdg-open with open.',
      'Use valid shell option syntax. For strict mode use set -euo pipefail, not set -euo errexit.',
      'Remove safety notes that only say to ensure a CLI is installed or available.',
      'If the command cannot be made reasonably correct or safe, return a noop UI explaining the missing information in one short sentence.'
    ].join(' '),
    prompt: [
      `Latest user request: ${request.prompt}`,
      'Context:',
      buildComposePrompt(request),
      'Tool availability report:',
      JSON.stringify(toolAvailability, null, 2),
      'Draft UI to review:',
      JSON.stringify(draftUi, null, 2)
    ].join('\n\n')
  });

  return generatedUiSchema.parse(result.object);
}

function inspectGeneratedUiToolAvailability(ui: GeneratedUi) {
  const values = Object.fromEntries(ui.fields.map(field => [field.name, field.defaultValue ?? '']));
  const command = renderCommandTemplate(ui.command || ui.previewCommand || '', values).trim();
  const executableReferences = new Set<string>([
    ...extractExecutableTokens(command),
    ...extractMissingExecutableReferences(JSON.stringify(ui))
  ]);

  return [...executableReferences].map(executable => ({
    executable,
    installed: executableAvailable(executable),
    alternatives: executableAvailable(executable) ? [] : findExecutableAlternatives(executable)
  }));
}

function extractMissingExecutableReferences(text: string): string[] {
  const references = new Set<string>();
  const patterns = [
    /\b([A-Za-z0-9][A-Za-z0-9._+-]*)\s+tool\s+is\s+not\s+installed/gi,
    /\b([A-Za-z0-9][A-Za-z0-9._+-]*)\s+is\s+not\s+installed/gi,
    /cannot\s+find\s+["'`]?([A-Za-z0-9][A-Za-z0-9._+-]*)["'`]?/gi,
    /install\s+["'`]?([A-Za-z0-9][A-Za-z0-9._+-]*)["'`]?/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const reference = match[1]?.trim();
      if (reference && reference.includes('-')) references.add(reference);
    }
  }

  return [...references];
}

ipcMain.handle('dialog:select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    defaultPath: app.getPath('downloads')
  });

  return result.canceled ? null : result.filePaths[0];
});

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
  void runWithOneRepairAttempt(runId, sender, request, commandConfig);

  return { runId, command: commandConfig.command };
});

ipcMain.handle('tool:cancel', async (_event, runId: string) => {
  const child = activeRuns.get(runId);
  if (!child) return false;
  child.kill('SIGTERM');
  return true;
});

async function runWithOneRepairAttempt(
  runId: string,
  sender: WebContents,
  request: ToolRunRequest,
  initialCommand: ReturnType<typeof buildCommand>
) {
  const first = await runCommandProcess(runId, sender, initialCommand);
  if ((first.code ?? 0) === 0 || first.cancelled) {
    sender.send('tool:output', { runId, type: 'exit', code: first.code, signal: first.signal });
    return;
  }

  const revisedCommand = await reviseFailedCommand(request, initialCommand.command, first.output);
  const reconciledCommand = revisedCommand
    ? reconcileCommandWithProducedFiles(revisedCommand, first.output, initialCommand.cwd)
    : null;
  if (!reconciledCommand || reconciledCommand.trim() === initialCommand.command.trim()) {
    sender.send('tool:output', {
      runId,
      type: 'chunk',
      stream: 'stderr',
      text: '\nWorkbench could not produce a safer revised command. Please review the error above.\n'
    });
    sender.send('tool:output', { runId, type: 'exit', code: first.code, signal: first.signal });
    return;
  }

  let revisedConfig: ReturnType<typeof buildCommand>;
  try {
    revisedConfig = buildCommand({ ...request, tool: 'shell.run', command: reconciledCommand });
  } catch (error) {
    sender.send('tool:output', {
      runId,
      type: 'chunk',
      stream: 'stderr',
      text: `\nWorkbench proposed a revised command, but it could not be run: ${(error as Error).message}\n`
    });
    sender.send('tool:output', { runId, type: 'exit', code: first.code, signal: first.signal });
    return;
  }

  sender.send('tool:output', {
    runId,
    type: 'retry',
    command: revisedConfig.command,
    reason: 'The command failed, so Workbench revised it and is trying once more.'
  });

  const second = await runCommandProcess(runId, sender, revisedConfig);
  if ((second.code ?? 0) !== 0 && !second.cancelled) {
    sender.send('tool:output', {
      runId,
      type: 'chunk',
      stream: 'stderr',
      text: '\nThe revised command also failed. Please review Run details before trying again.\n'
    });
  }
  sender.send('tool:output', { runId, type: 'exit', code: second.code, signal: second.signal });
}

function runCommandProcess(
  runId: string,
  sender: WebContents,
  commandConfig: ReturnType<typeof buildCommand>
): Promise<{ code: number | null; signal: NodeJS.Signals | null; output: string; cancelled: boolean }> {
  return new Promise(resolve => {
    const chunks: string[] = [];
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
      const text = chunk.toString();
      chunks.push(text);
      sender.send('tool:output', { runId, type: 'chunk', stream: 'stdout', text });
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      chunks.push(text);
      sender.send('tool:output', { runId, type: 'chunk', stream: 'stderr', text });
    });

    child.on('error', error => {
      const text = `${error.message}\n`;
      chunks.push(text);
      sender.send('tool:output', { runId, type: 'chunk', stream: 'stderr', text });
    });

    child.on('exit', (code, signal) => {
      activeRuns.delete(runId);
      resolve({
        code,
        signal,
        output: chunks.join('').slice(-8000),
        cancelled: signal === 'SIGTERM'
      });
    });
  });
}

async function reviseFailedCommand(request: ToolRunRequest, failedCommand: string, output: string): Promise<string | null> {
  const localEnv = readLocalEnv();
  const openaiApiKey = localEnv.OPENAI_API_KEY?.trim();
  if (!openaiApiKey) return null;

  try {
    const openai = createOpenAI({ apiKey: openaiApiKey });
    const modelName = localEnv.OPENAI_REVIEW_MODEL?.trim() || localEnv.OPENAI_MODEL?.trim() || 'gpt-5.2';
    const result = await generateObject({
      model: openai(modelName),
      schema: z.object({
        command: z.string().nullable(),
        reason: z.string()
      }),
      system: [
        'You repair failed macOS shell commands for Workbench.',
        'Return one corrected command string, or null if retrying would be unsafe.',
        'Do not repeat a command that already failed unless the correction is meaningful.',
        'Use macOS commands. For opening files use open, not xdg-open.',
        'If output shows a downloaded or generated concrete path, use that concrete path rather than a template like %(title)s.',
        'Do not shorten or normalize a generated filename. If output says video.mp4.webm, use video.mp4.webm exactly, not video.mp4.',
        'Do not redownload or redo expensive completed work if the failure happened after the output file was created; prefer the shortest follow-up command that completes the user intent.',
        'Keep user-provided paths and URLs intact.'
      ].join(' '),
      prompt: [
        'Original run request:',
        JSON.stringify(request, null, 2),
        'Failed command:',
        failedCommand,
        'Recent output:',
        output
      ].join('\n\n')
    });

    return result.object.command?.trim() || null;
  } catch {
    return null;
  }
}

function reconcileCommandWithProducedFiles(command: string, output: string, cwd: string): string {
  const producedPaths = extractExistingOutputPaths(output, cwd);
  if (producedPaths.length === 0) return command;

  let revised = command;
  for (const missingPath of extractMissingFilePaths(output)) {
    const missingAbsolutePath = resolveOutputPath(missingPath, cwd);
    if (existsSync(missingAbsolutePath)) continue;

    const replacement = producedPaths.find(path => isLikelyReplacementForMissingPath(path, missingAbsolutePath));
    if (!replacement) continue;

    revised = replacePathReference(revised, missingPath, replacement);
    if (missingPath !== missingAbsolutePath) {
      revised = replacePathReference(revised, missingAbsolutePath, replacement);
    }
  }

  return revised;
}

function extractExistingOutputPaths(output: string, cwd: string): string[] {
  const candidates = new Set<string>();
  const pathPattern =
    /"([^"\n]*(?:(?:\/|\.\/)[^"\n]*|\.[A-Za-z0-9]{1,8}))"|'([^'\n]*(?:(?:\/|\.\/)[^'\n]*|\.[A-Za-z0-9]{1,8}))'|((?:\.{1,2}\/|\/|~\/)[^\s,;:)]+)/g;
  for (const match of output.matchAll(pathPattern)) {
    const rawPath = match[1] ?? match[2] ?? match[3];
    if (!rawPath) continue;
    const resolvedPath = resolveOutputPath(rawPath.replace(/[.。]+$/, ''), cwd);
    if (existsSync(resolvedPath)) candidates.add(resolvedPath);
  }

  return [...candidates];
}

function extractMissingFilePaths(output: string): string[] {
  const paths = new Set<string>();
  const patterns = [
    /Cannot open file ['"]([^'"\n]+)['"][^\n]*(?:No such file|does not exist)/gi,
    /The file ['"]?([^'"\n]+?)['"]?\s+does not exist/gi,
    /Failed to open ['"]?([^'"\n]+?)['"]?(?:\.|\n|$)/gi
  ];

  for (const pattern of patterns) {
    for (const match of output.matchAll(pattern)) {
      const rawPath = match[1]?.trim().replace(/[.。]+$/, '');
      if (rawPath) paths.add(rawPath);
    }
  }

  return [...paths];
}

function resolveOutputPath(path: string, cwd: string): string {
  if (path.startsWith('~/')) return join(app.getPath('home'), path.slice(2));
  if (isAbsolute(path)) return path;
  return resolve(cwd, path);
}

function isLikelyReplacementForMissingPath(producedPath: string, missingPath: string): boolean {
  if (producedPath.startsWith(`${missingPath}.`)) return true;
  return dirname(producedPath) === dirname(missingPath) && basename(producedPath).startsWith(`${basename(missingPath)}.`);
}

function replacePathReference(command: string, fromPath: string, toPath: string): string {
  let revised = command;
  const replacement = shellQuote(toPath);
  for (const quoted of [`'${fromPath}'`, `"${fromPath}"`]) {
    revised = revised.replaceAll(quoted, replacement);
  }
  return revised.replaceAll(fromPath, replacement);
}

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
    const executable = extractExecutableTokens(command)[0] ?? findExecutableToCheck(argv);
    if (executable) ensureExecutableAvailable(executable);

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

function findExecutableToCheck(argv: string[]): string | null {
  return findExecutableInTokens(argv);
}

function extractExecutableTokens(command: string): string[] {
  const tokens = splitCommandLine(command.replace(/\r?\n/g, ' ; '));
  const executables: string[] = [];
  let segment: string[] = [];

  function flushSegment() {
    const executable = findExecutableInTokens(segment);
    if (executable) executables.push(executable);
    segment = [];
  }

  for (const token of tokens) {
    if (shellControlTokens.has(token)) {
      flushSegment();
      continue;
    }
    segment.push(token);
  }

  flushSegment();
  return [...new Set(executables)];
}

function findExecutableInTokens(argv: string[]): string | null {
  let skipNext = false;
  let skipUntilControlToken = false;

  for (const token of argv) {
    if (shellControlTokens.has(token)) {
      skipUntilControlToken = false;
      continue;
    }

    if (skipUntilControlToken) continue;

    if (skipNext) {
      skipNext = false;
      continue;
    }

    if (shellOptionBuiltins.has(token)) {
      skipUntilControlToken = true;
      continue;
    }

    if (pathArgumentBuiltins.has(token)) {
      skipNext = true;
      continue;
    }

    if (!token || token.includes('=') || shellControlTokens.has(token) || shellBuiltins.has(token)) continue;
    if (token.startsWith('-')) continue;
    return token;
  }

  return null;
}

function ensureExecutableAvailable(executable: string) {
  if (executable.includes('/')) {
    if (isExecutable(executable)) return;
    throw new Error(`Cannot find ${executable}. Check the path or install the tool before running this command.`);
  }

  const pathValue = expandGuiPath(process.env.PATH);
  const found = pathValue
    .split(':')
    .filter(Boolean)
    .some(directory => isExecutable(join(directory, executable)));

  if (found) return;

  throw new Error(
    `Cannot find "${executable}" on this Mac. Install it first, then try again. If you use Homebrew, the command is usually: brew install ${executable}`
  );
}

function executableAvailable(executable: string) {
  if (executable.includes('/')) return isExecutable(executable);
  return expandGuiPath(process.env.PATH)
    .split(':')
    .filter(Boolean)
    .some(directory => isExecutable(join(directory, executable)));
}

function findExecutableAlternatives(executable: string): string[] {
  const names = listPathExecutables();
  const targetParts = executableParts(executable);
  return names
    .map(name => ({ name, score: executableSimilarityScore(targetParts, executableParts(name), executable, name) }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 12)
    .map(candidate => candidate.name);
}

function listPathExecutables() {
  const names = new Set<string>();
  for (const directory of expandGuiPath(process.env.PATH).split(':').filter(Boolean)) {
    try {
      for (const name of readdirSync(directory)) {
        if (isExecutable(join(directory, name))) names.add(name);
      }
    } catch {
      // Ignore unreadable PATH entries.
    }
  }
  return [...names];
}

function executableParts(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function executableSimilarityScore(targetParts: string[], candidateParts: string[], target: string, candidate: string) {
  const normalizedTarget = targetParts.join('');
  const normalizedCandidate = candidateParts.join('');
  if (!normalizedTarget || !normalizedCandidate) return 0;
  if (normalizedCandidate === normalizedTarget) return 100;
  if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) return 80;

  let score = 0;
  for (const targetPart of targetParts) {
    for (const candidatePart of candidateParts) {
      if (candidatePart === targetPart) score += 20;
      else if (candidatePart.startsWith(targetPart) || targetPart.startsWith(candidatePart)) score += 12;
    }
  }

  if (candidate.includes(target) || target.includes(candidate)) score += 20;
  return score;
}

function isExecutable(path: string) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

const shellControlTokens = new Set(['&&', '||', '|', ';', '&', '(', ')']);
const pathArgumentBuiltins = new Set(['.', 'cd', 'source']);
const shellOptionBuiltins = new Set(['set', 'unset', 'ulimit', 'umask']);
const shellBuiltins = new Set([
  '.',
  'alias',
  'bg',
  'break',
  'cd',
  'command',
  'continue',
  'echo',
  'eval',
  'exec',
  'exit',
  'export',
  'false',
  'fg',
  'hash',
  'jobs',
  'pwd',
  'read',
  'set',
  'shift',
  'source',
  'test',
  'true',
  'type',
  'ulimit',
  'umask',
  'unalias',
  'unset',
  'wait'
]);

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
