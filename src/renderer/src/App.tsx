import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Code2,
  Database,
  Eraser,
  Trash2,
  FileArchive,
  FileText,
  FolderOpen,
  Globe2,
  Image,
  Loader2,
  Music2,
  Network,
  PanelRight,
  Play,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Palette,
  Square,
  Terminal,
  TerminalSquare,
  Video,
  WandSparkles,
  X
} from 'lucide-react';
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import type { GeneratedBlock, GeneratedField, GeneratedUi, ToolOutputEvent } from '../../shared/schema';
import { TerminalEntry, TerminalPane } from './components/TerminalPane';
import { cn } from './lib/utils';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ToolHistoryItem = {
  id: string;
  title: string;
  summary: string;
  request: string;
  ui: GeneratedUi;
  values: Record<string, FieldValue>;
};

type ToolSnapshot = {
  id: string;
  ui: GeneratedUi;
  values: Record<string, FieldValue>;
  commandPreview: string;
};

type ParsedProgress = {
  percent: number;
  label: string;
};

type FieldValue = string | number | boolean | undefined;

type ToolExample = {
  title: string;
  description: string;
  prompt: string;
  category: string;
};

const suggestions = [
  { label: 'Download videos', title: 'Video Downloader', prompt: 'I want to download some videos' },
  { label: 'Resize images', title: 'Image Resizer', prompt: 'Make a small image resize tool' },
  { label: 'Batch rename', title: 'Batch Renamer', prompt: 'Create a batch file renamer' }
];

const featuredExample: ToolExample = {
  title: 'Server log watcher',
  description: 'SSH into a host, choose a log file, and stream matching lines.',
  prompt: 'SSH into a server and tail logs with fields for host, user, log path, and search filter',
  category: 'Remote'
};

const toolExamples: ToolExample[] = [
  featuredExample,
  {
    title: 'Video downloader',
    description: 'Download videos with quality, folder, subtitle, and audio options.',
    prompt: 'Create a video downloader with URL list, quality selector, output folder, subtitles, and audio-only toggle',
    category: 'Media'
  },
  {
    title: 'Image resizer',
    description: 'Resize batches with width, format, quality, and color options.',
    prompt: 'Make a batch image resize tool with folder picker, width slider, output format, quality slider, and background color',
    category: 'Media'
  },
  {
    title: 'Audio extractor',
    description: 'Pull audio from videos into MP3, WAV, or AAC.',
    prompt: 'Build an audio extractor for video files with format, bitrate, input folder, and output folder controls',
    category: 'Media'
  },
  {
    title: 'Video converter',
    description: 'Convert MOV, MKV, or AVI files to MP4 with preset controls.',
    prompt: 'Convert videos to MP4 with input folder, output folder, codec preset, CRF slider, and overwrite toggle',
    category: 'Media'
  },
  {
    title: 'Frame extractor',
    description: 'Export video frames at a chosen interval.',
    prompt: 'Extract frames from a video with source file path, output folder, frame interval, and image format',
    category: 'Media'
  },
  {
    title: 'Thumbnail generator',
    description: 'Generate thumbnails for a folder of videos.',
    prompt: 'Generate thumbnails for videos with input folder, output folder, timestamp, width slider, and JPEG quality slider',
    category: 'Media'
  },
  {
    title: 'Batch renamer',
    description: 'Rename files using prefixes, dates, counters, and extensions.',
    prompt: 'Create a batch file renamer with folder picker, filename pattern, starting number, extension filter, and dry-run checkbox',
    category: 'Files'
  },
  {
    title: 'Large file finder',
    description: 'Find and graph the largest files in a folder.',
    prompt: 'Find large files in a folder with minimum size slider, extension filter, max results, and a bar chart summary',
    category: 'Files'
  },
  {
    title: 'Folder zipper',
    description: 'Compress folders with optional password and exclude patterns.',
    prompt: 'Compress a folder into a zip archive with source folder, destination folder, archive name, and exclude patterns',
    category: 'Files'
  },
  {
    title: 'Rsync sync',
    description: 'Sync two folders with delete, dry-run, and exclude options.',
    prompt: 'Sync two folders with rsync using source, destination, delete toggle, dry-run toggle, and exclude patterns',
    category: 'Files'
  },
  {
    title: 'Duplicate finder',
    description: 'Find duplicate files by checksum.',
    prompt: 'Find duplicate files in a folder by checksum with minimum size, extension filter, and output report path',
    category: 'Files'
  },
  {
    title: 'Git cleanup',
    description: 'Prune merged branches and clean stale refs.',
    prompt: 'Create a git cleanup tool for merged branches with repo folder, base branch, dry-run toggle, and remote prune option',
    category: 'Code'
  },
  {
    title: 'Test runner',
    description: 'Run npm install, lint, tests, and build with toggles.',
    prompt: 'Run npm install and tests for a project with project folder, package manager select, lint toggle, test toggle, and build toggle',
    category: 'Code'
  },
  {
    title: 'Python environment',
    description: 'Create a venv and install requirements.',
    prompt: 'Create a Python virtualenv and install packages with project folder, Python version, requirements file, and extra packages',
    category: 'Code'
  },
  {
    title: 'Docker stack',
    description: 'Start, stop, rebuild, and inspect compose services.',
    prompt: 'Start a Docker compose stack with project folder, compose file, service selector, rebuild toggle, and logs toggle',
    category: 'DevOps'
  },
  {
    title: 'Docker logs',
    description: 'Follow service logs with search and line count controls.',
    prompt: 'Show Docker logs for a service with container or compose service, tail count slider, follow toggle, and grep filter',
    category: 'DevOps'
  },
  {
    title: 'Host pinger',
    description: 'Ping a list of hosts and summarize packet loss.',
    prompt: 'Ping a list of hosts with count slider, timeout slider, and a bar chart for packet loss',
    category: 'Network'
  },
  {
    title: 'Port scanner',
    description: 'Check common or custom ports on a host.',
    prompt: 'Check open ports for a host with hostname, port range, timeout, and only-open toggle',
    category: 'Network'
  },
  {
    title: 'DNS lookup',
    description: 'Run DNS queries with record type and resolver controls.',
    prompt: 'Create a DNS lookup tool with domain, record type select, resolver field, and trace toggle',
    category: 'Network'
  },
  {
    title: 'Log search',
    description: 'Search logs by date range, severity, and text.',
    prompt: 'Search logs for errors by date range with log folder, severity select, search text, since date, and max results',
    category: 'Logs'
  },
  {
    title: 'Archive extractor',
    description: 'Extract zip, tar, and gz archives safely.',
    prompt: 'Extract an archive with archive path, destination folder, overwrite toggle, and list-only toggle',
    category: 'Files'
  },
  {
    title: 'Database backup',
    description: 'Run a configurable local database backup command.',
    prompt: 'Run a database backup command with database type, host, port, database name, output folder, and gzip toggle',
    category: 'Data'
  },
  {
    title: 'CSV sampler',
    description: 'Preview and sample large CSV files.',
    prompt: 'Create a CSV sampler with file path, row count slider, delimiter select, and output path',
    category: 'Data'
  },
  {
    title: 'JSON formatter',
    description: 'Format, validate, or compact JSON files.',
    prompt: 'Build a JSON formatter with input file, output file, compact toggle, sort keys toggle, and validation-only toggle',
    category: 'Data'
  },
  {
    title: 'Markdown downloader',
    description: 'Download a webpage and save it as markdown.',
    prompt: 'Download a webpage as markdown with URL, output folder, filename, include images toggle, and readability mode',
    category: 'Web'
  },
  {
    title: 'Screenshot capture',
    description: 'Capture webpages with viewport and output controls.',
    prompt: 'Capture a webpage screenshot with URL, viewport width, viewport height, output folder, full-page toggle, and image format',
    category: 'Web'
  },
  {
    title: 'Clipboard cleaner',
    description: 'Transform pasted text using local shell tools.',
    prompt: 'Create a text cleanup tool with textarea input, transform select, case conversion, and copy output command',
    category: 'Text'
  },
  {
    title: 'PDF splitter',
    description: 'Split or extract selected pages from PDFs.',
    prompt: 'Split a PDF with input file, page range, output folder, and filename pattern',
    category: 'Documents'
  },
  {
    title: 'OCR runner',
    description: 'Run OCR on images or PDFs using local tools.',
    prompt: 'Run OCR on a folder of images with language select, output folder, PDF toggle, and confidence report metric',
    category: 'Documents'
  }
];

const toolHistoryStorageKey = 'uiterm.generatedTools.v1';
const maxStoredTools = 50;

export function App() {
  const [prompt, setPrompt] = useState('');
  const [taskTitle, setTaskTitle] = useState('Untitled task');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ui, setUi] = useState<GeneratedUi | null>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [logs, setLogs] = useState<TerminalEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState('Idle');
  const [composing, setComposing] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolHistory, setToolHistory] = useState<ToolHistoryItem[]>(readStoredToolHistory);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [taskTitleEdited, setTaskTitleEdited] = useState(false);
  const [previousTools, setPreviousTools] = useState<ToolSnapshot[]>([]);

  useEffect(() => {
    return window.uiterm.onToolOutput(event => {
      if (event.type === 'start') {
        setLogs([{ id: crypto.randomUUID(), text: `$ ${event.command}\n` }]);
        setStatus('Running');
        return;
      }

      setLogs(current => [...current, toTerminalEntry(event)]);

      if (event.type === 'exit') {
        setRunning(false);
        setRunId(null);
        setStatus(event.code === 0 ? 'Completed' : `Exited ${event.code ?? event.signal ?? 'unknown'}`);
      }
    });
  }, []);

  useEffect(() => {
    writeStoredToolHistory(toolHistory);
  }, [toolHistory]);

  useEffect(() => {
    return window.uiterm.onToggleSidebar(() => {
      setSidebarOpen(current => !current);
    });
  }, []);

  const commandPreview = useMemo(() => {
    if (!ui) return 'No executable command';
    if (ui.tool !== 'shell.run') return ui.previewCommand ?? 'No executable command';
    return renderCommandTemplate(ui.command || ui.previewCommand || '', values) || 'No command generated';
  }, [ui, values]);

  async function compose(event?: FormEvent) {
    event?.preventDefault();
    if (!prompt.trim() || composing) return;

    const userText = prompt.trim();
    const composeRequest = {
      prompt: userText,
      messages: [...messages, { role: 'user' as const, content: userText }].slice(-10),
      currentUi: ui,
      values,
      commandPreview,
      recentLogs: logs
        .slice(-20)
        .map(entry => entry.text)
        .join('')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .slice(-20)
    };
    if (ui) {
      const snapshotId = activeToolId ?? crypto.randomUUID();
      setPreviousTools(current =>
        current.some(tool => tool.id === snapshotId)
          ? current
          : [
              ...current,
              {
                id: snapshotId,
                ui,
                values: { ...values },
                commandPreview
              }
            ]
      );
    }
    setComposing(true);
    setPrompt('');
    setUi(null);
    setValues({});
    setActiveToolId(null);
    setLogs([]);
    setShowOutput(false);
    setStatus('Generating');
    setMessages(current => [...current, { id: crypto.randomUUID(), role: 'user', content: userText }]);

    try {
      const nextUi = await window.uiterm.composeUi(composeRequest);
      const nextValues = inferDefaults(nextUi.fields);
      const nextToolId = crypto.randomUUID();
      const nextTaskTitle = taskTitleEdited && taskTitle.trim() ? taskTitle.trim() : nextUi.title;
      setUi(nextUi);
      setTaskTitle(nextTaskTitle);
      setValues(nextValues);
      setActiveToolId(nextToolId);
      setToolHistory(current =>
        [
          {
            id: nextToolId,
            title: nextTaskTitle,
            summary: nextUi.summary,
            request: userText,
            ui: nextUi,
            values: nextValues
          },
          ...current
        ].slice(0, maxStoredTools)
      );
      setLogs([]);
      setStatus('Ready');
      setMessages(current => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `${nextUi.title}: ${nextUi.summary}`
        }
      ]);
    } finally {
      setComposing(false);
    }
  }

  async function runAction() {
    if (!ui || ui.action.tool === 'noop' || running) return;
    setRunning(true);
    setStatus('Starting');
    try {
      const result = await window.uiterm.runAction({ tool: ui.action.tool, values, command: ui.command || ui.previewCommand });
      setRunId(result.runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunning(false);
      setRunId(null);
      setStatus('Failed');
      setLogs(current => [
        ...current,
        {
          id: crypto.randomUUID(),
          stream: 'stderr',
          text: `${message}\n`
        }
      ]);
    }
  }

  async function cancelRun() {
    if (!runId) return;
    await window.uiterm.cancelRun(runId);
    setStatus('Cancelling');
  }

  function startNewTask() {
    setPrompt('');
    setTaskTitle('Untitled task');
    setTaskTitleEdited(false);
    setMessages([]);
    setUi(null);
    setPreviousTools([]);
    setValues({});
    setActiveToolId(null);
    setLogs([]);
    setRunId(null);
    setRunning(false);
    setStatus('Idle');
    setShowOutput(false);
  }

  function updateValues(nextValues: Record<string, FieldValue>) {
    setValues(nextValues);
    setToolHistory(current => current.map(item => (item.id === activeToolId ? { ...item, values: nextValues } : item)));
  }

  function restoreTool(item: ToolHistoryItem) {
    setPrompt('');
    setUi(item.ui);
    setValues(item.values);
    setTaskTitle(item.title);
    setTaskTitleEdited(true);
    setActiveToolId(item.id);
    setLogs([]);
    setRunId(null);
    setRunning(false);
    setStatus('Ready');
    setShowOutput(false);
    setMessages([
      { id: `${item.id}-request`, role: 'user', content: item.request },
      { id: `${item.id}-response`, role: 'assistant', content: `${item.title}: ${item.summary}` }
    ]);
    setPreviousTools([]);
    setSidebarOpen(false);
  }

  function deleteTool(id: string) {
    setToolHistory(current => current.filter(item => item.id !== id));
    setPreviousTools(current => current.filter(item => item.id !== id));

    if (id === activeToolId) {
      startNewTask();
    }
  }

  function renameDraftTitle(nextTitle: string) {
    setTaskTitle(nextTitle);
    setTaskTitleEdited(true);
  }

  return (
    <main className="flex h-screen flex-col bg-[var(--app-bg)] text-[var(--text)] transition-colors duration-200">
      <header className="app-drag flex h-10 shrink-0 select-none items-center justify-between border-b border-[var(--border)] bg-[var(--chrome-bg)] pr-3 pl-24">
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
          <button
            type="button"
            onClick={startNewTask}
            className="app-no-drag flex select-none items-center gap-2 rounded-md px-1.5 py-1 text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)]"
            title="New task"
          >
            <Palette size={15} className="text-[var(--text-faint)]" />
            <span>Workbench</span>
          </button>
          <span className="text-[var(--text-faint)]">/</span>
          <span className="font-medium text-[var(--text-strong)]">{taskTitle}</span>
        </div>
        <div className="app-no-drag flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(current => !current)}
            className="flex size-7 select-none items-center justify-center rounded-md text-[var(--text-faint)] transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)]"
            title="Toggle generated tools"
          >
            <PanelRight size={15} />
          </button>
        </div>
      </header>

      <section className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto">
            <div className={cn('mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 pt-10', ui ? 'pb-64' : 'pb-28')}>
              {ui ? (
                <div className="space-y-7">
                  <TaskTranscript messages={messages} />
                  <PreviousToolStack tools={previousTools} />
                  <ToolForm
                    ui={ui}
                    values={values}
                    setValues={updateValues}
                    commandPreview={commandPreview}
                    running={running}
                    logs={logs}
                    showOutput={showOutput}
                    onToggleOutput={() => setShowOutput(current => !current)}
                    onRun={runAction}
                    onCancel={cancelRun}
                  />
                </div>
              ) : composing ? (
                <GeneratingUi
                  messages={[...messages, { id: 'pending', role: 'user', content: prompt || 'Generating interface...' }]}
                  previousTools={previousTools}
                />
              ) : (
                <InitialTaskDraft title={taskTitle} setTitle={renameDraftTitle} prompt={prompt} setPrompt={setPrompt} onSubmit={compose} />
              )}
            </div>
          </div>

          {ui ? (
            <Composer prompt={prompt} setPrompt={setPrompt} composing={composing} onSubmit={compose} onNewTask={startNewTask} />
          ) : (
            <InitialCommandBar prompt={prompt} setPrompt={setPrompt} composing={composing} onSubmit={compose} />
          )}
        </div>

        {sidebarOpen ? <ToolSidebar items={toolHistory} activeId={activeToolId} onSelect={restoreTool} onDelete={deleteTool} /> : null}
      </section>
    </main>
  );
}

function ToolSidebar(props: {
  items: ToolHistoryItem[];
  activeId: string | null;
  onSelect: (item: ToolHistoryItem) => void;
  onDelete: (id: string) => void;
}) {
  const { items, activeId, onSelect, onDelete } = props;

  return (
    <aside className="app-no-drag absolute inset-y-0 right-0 z-20 flex w-80 select-none flex-col border-l border-[var(--border)] bg-[var(--chrome-bg)] shadow-[-8px_0_18px_rgba(0,0,0,0.12)]">
      {items.length > 0 ? (
        <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {items.map(item => (
            <div
              key={item.id}
              className={cn(
                'group grid grid-cols-[1fr_auto] items-start gap-2 rounded-md transition',
                item.id === activeId ? 'bg-[var(--active)]' : 'hover:bg-[var(--hover)]'
              )}
            >
              <button type="button" onClick={() => onSelect(item)} className="min-w-0 px-3 py-2.5 text-left">
                <div className="truncate text-sm font-medium text-[var(--text-strong)]">{item.title}</div>
                <div className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--text-faint)]">{item.summary}</div>
              </button>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  onDelete(item.id);
                }}
                className="mt-2 mr-2 flex size-7 items-center justify-center rounded-md text-[var(--text-faint)] opacity-0 transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)] group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 text-sm leading-6 text-[var(--text-faint)]">Generated tools will show up here after you send a task.</div>
      )}
    </aside>
  );
}

function TaskTranscript({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-3">
      {messages.map(message => (
        <div key={message.id} className="group flex gap-3">
          <div className="mt-1 flex size-6 shrink-0 select-none items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
            {message.role === 'user' ? <WandSparkles size={14} /> : <TerminalSquare size={14} />}
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--text-strong)]">{message.role === 'user' ? 'Task' : 'Workbench'}</div>
            <p className="mt-1 max-w-[68ch] text-sm leading-6 text-pretty text-[var(--text-muted)]">{message.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviousToolStack({ tools }: { tools: ToolSnapshot[] }) {
  if (tools.length === 0) return null;

  return (
    <div className="space-y-5">
      {tools.map(tool => (
        <PreviousToolSnapshot key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

function PreviousToolSnapshot({ tool }: { tool: ToolSnapshot }) {
  return (
    <div className="pointer-events-none select-none space-y-4 border-y border-[var(--border)] py-5 opacity-45">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
          <WandSparkles size={15} />
          Previous interface
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-strong)]">{tool.ui.title}</h2>
        <p className="mt-2 max-w-[68ch] text-sm leading-6 text-pretty text-[var(--text-muted)]">{tool.ui.summary}</p>
      </div>

      {tool.ui.blocks && tool.ui.blocks.length > 0 ? <GeneratedBlocks blocks={tool.ui.blocks} /> : null}

      {tool.ui.fields.length > 0 ? (
        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          {tool.ui.fields.map(field => (
            <FieldRenderer key={field.name} field={field} value={tool.values[field.name]} onChange={() => undefined} />
          ))}
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
        <div className="mb-2 text-sm font-medium text-[var(--text-muted)]">Command preview</div>
        <code className="block break-words font-mono text-sm leading-6 text-[var(--text)]">{tool.commandPreview}</code>
      </div>
    </div>
  );
}

function GeneratingUi({ messages, previousTools }: { messages: ChatMessage[]; previousTools: ToolSnapshot[] }) {
  return (
    <div className="space-y-7">
      <TaskTranscript messages={messages.filter(message => message.id !== 'pending' || message.content !== 'Generating interface...')} />
      <PreviousToolStack tools={previousTools} />

      <div className="space-y-6">
        <div className="flex select-none items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-25" />
            <span className="relative inline-flex size-3 rounded-full bg-[var(--accent)]" />
          </span>
          Generating interface
        </div>

        <div className="space-y-3">
          <SkeletonLine className="h-8 w-64" />
          <SkeletonLine className="h-4 w-full max-w-xl" />
          <SkeletonLine className="h-4 w-2/3" />
        </div>

        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
          <SkeletonField wide />
          <SkeletonField />
          <SkeletonField />
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
          <SkeletonLine className="mb-3 h-4 w-32" />
          <SkeletonLine className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
}

function SkeletonField({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-2">
      <SkeletonLine className={cn('h-4', wide ? 'w-36' : 'w-28')} />
      <SkeletonLine className={cn('rounded-lg', wide ? 'h-24 w-full' : 'h-10 w-full')} />
    </div>
  );
}

function SkeletonLine({ className }: { className: string }) {
  return <div className={cn('animate-pulse rounded-md bg-[var(--surface-subtle)]', className)} />;
}

function Composer(props: {
  prompt: string;
  setPrompt: (prompt: string) => void;
  composing: boolean;
  onSubmit: (event?: FormEvent) => void;
  onNewTask: () => void;
}) {
  const { prompt, setPrompt, composing, onSubmit, onNewTask } = props;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[var(--app-bg)] via-[var(--app-bg)] to-transparent px-6 pb-7 pt-12">
      <div className="pointer-events-auto mx-auto w-full max-w-2xl">
        <form
          onSubmit={onSubmit}
          className="app-no-drag rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-soft)]"
        >
          <textarea
            id="intent"
            name="intent"
            aria-label="Task"
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            onKeyDown={event => submitOnCommandEnter(event, onSubmit)}
            rows={1}
            placeholder="Ask for a change or describe another tool"
            className="max-h-24 min-h-10 w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-6 text-[var(--text-strong)] outline-none placeholder:text-[var(--text-faint)]"
          />
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-2 pt-2">
            <div className="flex items-center gap-2 text-sm text-[var(--text-faint)]">
              <button
                type="button"
                onClick={onNewTask}
                className="flex select-none items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)]"
              >
                <RotateCcw size={14} />
                New task
              </button>
              <span className="h-4 w-px bg-[var(--border)]" />
              <button
                type="button"
                onClick={() => setPrompt('')}
                disabled={!prompt}
                className="flex select-none items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)] disabled:text-[var(--text-faint)] disabled:opacity-45 disabled:hover:bg-transparent"
              >
                <Eraser size={14} />
                Clear
              </button>
            </div>
            <button
              type="submit"
              disabled={!prompt.trim() || composing}
              className="flex h-8 select-none items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-2.5 text-sm font-medium text-[var(--primary-contrast)] transition hover:bg-[var(--primary-hover)] disabled:bg-[var(--surface-subtle)] disabled:text-[var(--text-faint)]"
              title="Send with Cmd+Enter"
            >
              {composing ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <>
                  <span>Send</span>
                  <span className="opacity-55">⌘↵</span>
                  <ArrowUp size={15} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InitialTaskDraft(props: {
  title: string;
  setTitle: (title: string) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  onSubmit: (event?: FormEvent) => void;
}) {
  const { title, setTitle, prompt, setPrompt, onSubmit } = props;
  const [showMoreIdeas, setShowMoreIdeas] = useState(false);

  function chooseIdea(idea: { title: string; prompt: string }) {
    setTitle(idea.title);
    setPrompt(idea.prompt);
    setShowMoreIdeas(false);
  }

  return (
    <div className="flex flex-1 flex-col pt-4">
      <div className="flex min-h-0 w-full max-w-2xl flex-1 flex-col">
        <input
          id="task-title"
          name="task-title"
          aria-label="Task title"
          value={title}
          onChange={event => setTitle(event.target.value)}
          className="block h-8 w-full bg-transparent p-0 text-[25px] font-semibold leading-8 tracking-tight text-[var(--text-strong)] outline-none placeholder:text-[var(--text-faint)]"
          placeholder="Untitled task"
        />
        <textarea
          id="initial-intent"
          name="initial-intent"
          aria-label="Task"
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
          onKeyDown={event => submitOnCommandEnter(event, onSubmit)}
          rows={1}
          placeholder="What do you want to run?"
          className="mt-5 min-h-0 flex-1 resize-none bg-transparent text-[15px] leading-6 text-[var(--text-strong)] outline-none placeholder:text-[var(--text-faint)]"
        />
      </div>

      <div className="mt-auto flex justify-center pb-3">
        <div className="flex select-none flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          <span className="text-[var(--text-faint)]">Try</span>
          {suggestions.map(suggestion => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => chooseIdea(suggestion)}
              className="app-no-drag text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
            >
              {suggestion.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowMoreIdeas(true)}
            className="app-no-drag rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)]"
          >
            More
          </button>
        </div>
      </div>

      {showMoreIdeas ? <IdeasDialog onClose={() => setShowMoreIdeas(false)} onChoose={chooseIdea} /> : null}
    </div>
  );
}

function IdeasDialog(props: { onClose: () => void; onChoose: (idea: { title: string; prompt: string }) => void }) {
  const { onClose, onChoose } = props;
  const [activeTab, setActiveTab] = useState<'examples' | 'gallery'>('examples');
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const galleryCategories = useMemo(() => ['All', ...Array.from(new Set(toolExamples.map(example => example.category)))], []);
  const filteredExamples = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return toolExamples;

    return toolExamples.filter(example =>
      [example.title, example.description, example.category, example.prompt].some(value => value.toLowerCase().includes(normalizedQuery))
    );
  }, [query]);
  const visibleGalleryExamples = useMemo(() => {
    if (activeCategory === 'All') return filteredExamples;
    return filteredExamples.filter(example => example.category === activeCategory);
  }, [activeCategory, filteredExamples]);

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 bg-[var(--app-bg)]">
      <div className="flex h-full flex-col">
        <div className="app-drag flex h-10 shrink-0 select-none items-center justify-between border-b border-[var(--border)] bg-[var(--chrome-bg)] pr-3 pl-24">
          <div className="flex items-center gap-1 text-sm text-[var(--text-muted)]" role="tablist" aria-label="Gallery sections">
            {(['examples', 'gallery'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'app-no-drag rounded-md px-3 py-1 font-medium transition',
                  activeTab === tab
                    ? 'bg-[var(--surface-subtle)] text-[var(--text-strong)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-strong)]'
                )}
              >
                {tab === 'examples' ? 'Examples' : 'Tool gallery'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-no-drag flex size-7 select-none items-center justify-center rounded-md text-[var(--text-faint)] transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)]"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="app-no-drag stable-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto w-full max-w-6xl">
            {activeTab === 'examples' ? (
              <div className="mx-auto max-w-5xl">
                <div className="flex items-end justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Examples</h2>
                    <p className="mt-2 max-w-[58ch] text-sm leading-6 text-[var(--text-muted)]">
                      A few polished starting points for common local workflows.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('gallery')}
                    className="hidden rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)] sm:block"
                  >
                    Browse all
                  </button>
                </div>

                <div className="mt-8 grid gap-3">
                  {[featuredExample, ...toolExamples.slice(1, 3)].map(example => (
                    <button
                      key={`starter-${example.title}`}
                      type="button"
                      onClick={() => onChoose({ title: example.title, prompt: example.prompt })}
                      className="group grid select-none grid-cols-[auto_1fr_auto] items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
                    >
                      <span className="flex size-9 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--text-muted)]">
                        <CategoryIcon category={example.category} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-base font-medium text-[var(--text-strong)]">{example.title}</span>
                          <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-sm text-[var(--text-faint)]">
                            {example.category}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-sm leading-6 text-[var(--text-muted)]">{example.description}</span>
                      </span>
                      <span className="rounded-md px-2 py-1 text-sm font-medium text-[var(--text-faint)] transition group-hover:bg-[var(--surface-subtle)] group-hover:text-[var(--text-strong)]">
                        Use
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-10 flex select-none items-center justify-between border-b border-[var(--border)] pb-3">
                  <div className="text-lg font-medium text-[var(--text-strong)]">More from the gallery</div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('gallery')}
                    className="rounded-md px-2 py-1 text-sm font-medium text-[var(--text-faint)] transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)]"
                  >
                    View all
                  </button>
                </div>

                <div className="grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-3">
                  {toolExamples.slice(3, 9).map(example => (
                    <button
                      key={`example-preview-${example.category}-${example.title}`}
                      type="button"
                      onClick={() => onChoose({ title: example.title, prompt: example.prompt })}
                      className="group flex min-h-32 select-none flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--text-muted)]">
                          <CategoryIcon category={example.category} />
                        </span>
                        <span className="text-sm text-[var(--text-faint)]">{example.category}</span>
                      </span>
                      <span className="mt-4 text-sm font-medium text-[var(--text-strong)]">{example.title}</span>
                      <span className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">{example.description}</span>
                      <span className="mt-auto pt-3 text-sm font-medium text-[var(--text-faint)] transition group-hover:text-[var(--text-strong)]">
                        Use template
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Tool gallery</h2>
                    <p className="mt-2 max-w-[56ch] text-sm leading-6 text-[var(--text-muted)]">
                      Search the full collection of local workflow templates.
                    </p>
                  </div>
                  <div className="hidden select-none rounded-full bg-[var(--surface-muted)] px-3 py-1 text-sm text-[var(--text-faint)] sm:block">
                    {visibleGalleryExamples.length} shown
                  </div>
                </div>

                <div className="mt-7 flex items-center gap-3">
                  <div className="grid h-11 flex-1 grid-cols-[auto_1fr] items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 shadow-[0_1px_2px_rgba(15,15,15,0.03)]">
                    <Search size={18} className="text-[var(--text-faint)]" />
                    <input
                      value={query}
                      onChange={event => setQuery(event.target.value)}
                      placeholder="Search examples"
                      className="h-full bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-faint)]"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {galleryCategories.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-sm font-medium transition',
                        activeCategory === category
                          ? 'bg-[var(--primary)] text-[var(--primary-contrast)]'
                          : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-strong)]'
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleGalleryExamples.map(example => (
                    <button
                      key={`${example.category}-${example.title}`}
                      type="button"
                      onClick={() => onChoose({ title: example.title, prompt: example.prompt })}
                      className="group flex min-h-44 select-none flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex size-9 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--text-muted)]">
                          <CategoryIcon category={example.category} />
                        </span>
                        <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-sm text-[var(--text-faint)]">{example.category}</span>
                      </span>
                      <span className="mt-6 text-base font-medium text-[var(--text-strong)]">{example.title}</span>
                      <span className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">{example.description}</span>
                      <span className="mt-auto pt-4 text-sm font-medium text-[var(--text-faint)] transition group-hover:text-[var(--text-strong)]">
                        Use template
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const iconProps = { size: 17, strokeWidth: 1.8 };

  if (category === 'Media') return <Video {...iconProps} />;
  if (category === 'Files') return <FileArchive {...iconProps} />;
  if (category === 'Code') return <Code2 {...iconProps} />;
  if (category === 'DevOps') return <Server {...iconProps} />;
  if (category === 'Network') return <Network {...iconProps} />;
  if (category === 'Data') return <Database {...iconProps} />;
  if (category === 'Web') return <Globe2 {...iconProps} />;
  if (category === 'Text' || category === 'Documents') return <FileText {...iconProps} />;
  if (category === 'Logs' || category === 'Remote') return <Terminal {...iconProps} />;
  if (category === 'Images') return <Image {...iconProps} />;
  if (category === 'Audio') return <Music2 {...iconProps} />;

  return <WandSparkles {...iconProps} />;
}

function InitialCommandBar(props: {
  prompt: string;
  setPrompt: (prompt: string) => void;
  composing: boolean;
  onSubmit: (event?: FormEvent) => void;
}) {
  const { prompt, setPrompt, composing, onSubmit } = props;
  const canSubmit = Boolean(prompt.trim());

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[var(--app-bg)] via-[var(--app-bg)] to-transparent px-6 pb-7 pt-14">
      <div className="pointer-events-auto mx-auto flex h-12 w-fit select-none items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-faint)] shadow-[var(--shadow-soft)]">
        <span className="px-2 text-[var(--text-muted)]">Tool draft</span>
        <span className="h-5 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => setPrompt('')}
          disabled={!prompt}
          className="app-no-drag flex select-none items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)] disabled:opacity-45 disabled:hover:bg-transparent"
        >
          <Eraser size={14} />
          Clear
        </button>
        <span className="h-5 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => onSubmit()}
          disabled={!canSubmit || composing}
          className="app-no-drag flex select-none items-center gap-2 rounded-md px-2 py-1 font-medium text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)] disabled:opacity-45 disabled:hover:bg-transparent"
        >
          {composing ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <>
              <span>Send</span>
              <span className="text-[var(--text-faint)]">⌘↵</span>
              <ArrowUp size={15} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function submitOnCommandEnter(event: KeyboardEvent<HTMLTextAreaElement>, onSubmit: (event?: FormEvent) => void) {
  if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return;
  event.preventDefault();
  onSubmit();
}

function readStoredToolHistory(): ToolHistoryItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const rawHistory = localStorage.getItem(toolHistoryStorageKey);
    if (!rawHistory) return [];

    const parsed: unknown = JSON.parse(rawHistory);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isToolHistoryItem).slice(0, maxStoredTools);
  } catch {
    return [];
  }
}

function writeStoredToolHistory(items: ToolHistoryItem[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(toolHistoryStorageKey, JSON.stringify(items.slice(0, maxStoredTools)));
  } catch {
    // Ignore storage failures, for example private mode quota errors.
  }
}

function isToolHistoryItem(value: unknown): value is ToolHistoryItem {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.request === 'string' &&
    isGeneratedUi(value.ui) &&
    isRecord(value.values)
  );
}

function isGeneratedUi(value: unknown): value is GeneratedUi {
  if (!isRecord(value) || !isRecord(value.action)) return false;

  return (
    typeof value.title === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.tool === 'string' &&
    Array.isArray(value.fields) &&
    typeof value.action.label === 'string' &&
    typeof value.action.tool === 'string' &&
    Array.isArray(value.safety)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function GeneratedBlocks({ blocks }: { blocks: GeneratedBlock[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {blocks.map((block, index) => (
        <GeneratedBlockRenderer key={`${block.type}-${index}`} block={block} />
      ))}
    </div>
  );
}

function GeneratedBlockRenderer({ block }: { block: GeneratedBlock }) {
  if (block.type === 'image') {
    return (
      <figure className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] sm:col-span-2">
        {block.url ? <img src={block.url} alt={block.alt ?? block.title ?? ''} className="max-h-80 w-full object-cover" /> : null}
        {block.title || block.text ? (
          <figcaption className="space-y-1 p-4">
            {block.title ? <div className="text-sm font-medium text-[var(--text-strong)]">{block.title}</div> : null}
            {block.text ? <div className="text-sm leading-6 text-[var(--text-faint)]">{block.text}</div> : null}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (block.type === 'metric') {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="text-sm text-[var(--text-faint)]">{block.label ?? block.title ?? 'Metric'}</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">{block.value ?? '--'}</div>
        {block.text ? <div className="mt-2 text-sm leading-6 text-[var(--text-faint)]">{block.text}</div> : null}
      </div>
    );
  }

  if (block.type === 'barChart') {
    const data = block.data ?? [];
    const maxValue = Math.max(1, ...data.map(item => item.value));

    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:col-span-2">
        {block.title ? <div className="mb-4 text-sm font-medium text-[var(--text-strong)]">{block.title}</div> : null}
        <div className="space-y-3">
          {data.map(item => (
            <div key={item.label} className="grid grid-cols-[minmax(88px,0.32fr)_1fr_auto] items-center gap-3 text-sm">
              <div className="truncate text-[var(--text-faint)]">{item.label}</div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }} />
              </div>
              <div className="font-mono text-[var(--text-muted)]">{item.value}</div>
            </div>
          ))}
        </div>
        {block.text ? <div className="mt-4 text-sm leading-6 text-[var(--text-faint)]">{block.text}</div> : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:col-span-2">
      {block.title ? <div className="text-sm font-medium text-[var(--text-strong)]">{block.title}</div> : null}
      {block.text ? <div className={cn('text-sm leading-6 text-[var(--text-faint)]', block.title ? 'mt-2' : '')}>{block.text}</div> : null}
    </div>
  );
}

function ToolForm(props: {
  ui: GeneratedUi;
  values: Record<string, FieldValue>;
  setValues: (next: Record<string, FieldValue>) => void;
  commandPreview: string;
  running: boolean;
  logs: TerminalEntry[];
  showOutput: boolean;
  onToggleOutput: () => void;
  onRun: () => void;
  onCancel: () => void;
}) {
  const { ui, values, setValues, commandPreview, running, logs, showOutput, onToggleOutput, onRun, onCancel } = props;
  const progress = useMemo(() => parseTerminalProgress(logs), [logs]);
  const terminalPreview = useMemo(() => getTerminalPreviewLines(logs), [logs]);

  function setValue(name: string, value: string | number | boolean) {
    setValues({ ...values, [name]: value });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex select-none items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
          <WandSparkles size={15} />
          Generated interface
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-[var(--text-strong)]">{ui.title}</h1>
        <p className="mt-2 max-w-[68ch] text-sm leading-6 text-pretty text-[var(--text-muted)]">{ui.summary}</p>
        {ui.aiNote ? (
          <p className="mt-3 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm leading-6 text-[var(--warning-text)]">
            {ui.aiNote}
          </p>
        ) : null}
      </div>

      {ui.blocks && ui.blocks.length > 0 ? <GeneratedBlocks blocks={ui.blocks} /> : null}

      {ui.fields.length > 0 ? (
        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
          {ui.fields.map(field => (
            <FieldRenderer key={field.name} field={field} value={values[field.name]} onChange={value => setValue(field.name, value)} />
          ))}
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
        <div className="mb-2 select-none text-sm font-medium text-[var(--text-muted)]">Command preview</div>
        <code className="block break-words font-mono text-sm leading-6 text-[var(--text)]">{commandPreview}</code>
      </div>

      {ui.safety.length > 0 ? (
        <div className="space-y-2">
          {ui.safety.map(item => (
            <div key={item} className="flex gap-2 text-sm leading-6 text-[var(--text-faint)]">
              <ShieldCheck size={15} className="mt-1 shrink-0 select-none text-[var(--success)]" />
              {item}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={ui.action.tool === 'noop' || running}
          className="flex h-9 flex-1 select-none items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-contrast)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {running ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
          {ui.action.label}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!running}
          className="flex h-9 select-none items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Square size={15} />
          Stop
        </button>
      </div>

      {progress ? <TerminalProgress progress={progress} /> : null}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/80">
        <button
          type="button"
          onClick={onToggleOutput}
          className="flex w-full select-none items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <span className="flex items-center gap-2">
            <Terminal size={14} />
            Run details
          </span>
          <span className="flex items-center gap-2 text-[var(--text-faint)]">
            {showOutput ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {!showOutput && terminalPreview.length > 0 ? <TerminalPreview lines={terminalPreview} /> : null}
        {showOutput ? (
          <div className="border-t border-[var(--border)] p-3">
            <TerminalPane entries={logs} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldRenderer(props: { field: GeneratedField; value: FieldValue; onChange: (value: string | number | boolean) => void }) {
  const { field, value, onChange } = props;
  const inputId = `field-${field.name}`;
  const fieldControlClass =
    'rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-sm text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:bg-[var(--surface)] max-sm:text-base';

  return (
    <label htmlFor={inputId} className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--text-strong)]">{field.label}</span>
        {field.required ? <span className="text-sm text-[var(--text-faint)]">Required</span> : null}
      </div>

      {field.type === 'textarea' ? (
        <textarea
          id={inputId}
          name={field.name}
          value={String(value ?? '')}
          onChange={event => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={5}
          className={cn('w-full resize-none px-3 py-2', fieldControlClass)}
        />
      ) : null}

      {field.type === 'text' ? (
        <input
          id={inputId}
          name={field.name}
          type="text"
          value={String(value ?? '')}
          onChange={event => onChange(event.target.value)}
          placeholder={field.placeholder}
          className={cn('h-10 w-full px-3', fieldControlClass)}
        />
      ) : null}

      {field.type === 'select' ? (
        <select
          id={inputId}
          name={field.name}
          value={String(value ?? field.defaultValue ?? '')}
          onChange={event => onChange(event.target.value)}
          className={cn('h-10 w-full px-3', fieldControlClass)}
        >
          {(field.options ?? []).map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {field.type === 'number' ? (
        <input
          id={inputId}
          name={field.name}
          type="number"
          value={String(value ?? '')}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={event => onChange(event.target.value === '' ? '' : event.target.valueAsNumber)}
          placeholder={field.placeholder}
          className={cn('h-10 w-full px-3', fieldControlClass)}
        />
      ) : null}

      {field.type === 'slider' ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--text-faint)]">
              {field.min ?? 0} - {field.max ?? 100}
            </span>
            <span className="font-mono text-sm text-[var(--text)]">{String(value ?? field.defaultValue ?? field.min ?? 0)}</span>
          </div>
          <input
            id={inputId}
            name={field.name}
            type="range"
            value={Number(value ?? field.defaultValue ?? field.min ?? 0)}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onChange={event => onChange(event.target.valueAsNumber)}
            className="w-full accent-[var(--accent)]"
          />
        </div>
      ) : null}

      {field.type === 'color' ? (
        <div className="flex h-10 items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3">
          <input
            id={inputId}
            name={field.name}
            type="color"
            value={String(value ?? field.defaultValue ?? '#85827d')}
            onChange={event => onChange(event.target.value)}
            className="size-6 cursor-pointer appearance-none rounded border-0 bg-transparent p-0"
          />
          <span className="font-mono text-sm text-[var(--text)]">{String(value ?? field.defaultValue ?? '#85827d')}</span>
        </div>
      ) : null}

      {field.type === 'checkbox' ? (
        <div className="flex h-10 items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3">
          <span className="text-sm text-[var(--text-muted)]">{Boolean(value) ? 'Enabled' : 'Disabled'}</span>
          <span
            className={cn('relative inline-flex w-10 rounded-full p-0.5 transition', value ? 'bg-[var(--primary)]' : 'bg-[var(--surface-subtle)]')}
          >
            <span
              className={cn(
                'block aspect-square w-1/2 rounded-full bg-[var(--surface)] shadow-sm transition',
                value ? 'translate-x-full' : 'translate-x-0'
              )}
            />
            <input
              id={inputId}
              name={field.name}
              type="checkbox"
              checked={Boolean(value)}
              onChange={event => onChange(event.target.checked)}
              className="absolute inset-0 size-full appearance-none rounded-full"
              aria-label={field.label}
            />
          </span>
        </div>
      ) : null}

      {field.type === 'folder' ? (
        <div className="flex gap-2">
          <input
            id={inputId}
            name={field.name}
            type="text"
            value={String(value ?? '')}
            onChange={event => onChange(event.target.value)}
            className={cn('h-10 min-w-0 flex-1 px-3', fieldControlClass)}
          />
          <button
            type="button"
            onClick={async () => {
              const folder = await window.uiterm.selectFolder();
              if (folder) onChange(folder);
            }}
            className="flex h-10 w-11 select-none items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text-strong)]"
            title="Choose folder"
          >
            <FolderOpen size={16} />
          </button>
        </div>
      ) : null}

      {field.description ? <p className="mt-1 text-sm leading-6 text-[var(--text-faint)]">{field.description}</p> : null}
    </label>
  );
}

function TerminalProgress({ progress }: { progress: ParsedProgress }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-[var(--text-muted)]">{progress.label}</span>
        <span className="font-mono text-[var(--text-faint)]">{Math.round(progress.percent)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200" style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}

function TerminalPreview({ lines }: { lines: string[] }) {
  return (
    <div className="relative border-t border-[var(--border)] px-3 py-2">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--surface)] to-transparent" />
      <div className="max-h-16 overflow-hidden font-mono text-[12px] leading-5 text-[var(--text-faint)]">
        {lines.map((line, index) => (
          <div key={`${index}-${line}`} className={cn('truncate', index === lines.length - 1 ? 'text-[var(--text-muted)]' : 'opacity-55')}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function inferDefaults(fields: GeneratedField[]): Record<string, FieldValue> {
  return Object.fromEntries(
    fields.map(field => [
      field.name,
      field.defaultValue ??
        (field.type === 'checkbox'
          ? false
          : field.type === 'slider' || field.type === 'number'
            ? (field.min ?? 0)
            : field.type === 'color'
              ? '#85827d'
              : '')
    ])
  );
}

function toTerminalEntry(event: ToolOutputEvent): TerminalEntry {
  if (event.type === 'chunk') {
    return { id: crypto.randomUUID(), text: event.text, stream: event.stream };
  }

  if (event.type === 'exit') {
    const label = event.code === 0 ? 'process completed' : `process exited with ${event.code ?? event.signal ?? 'unknown'}`;
    return { id: crypto.randomUUID(), text: `\n${label}\n` };
  }

  return { id: crypto.randomUUID(), text: '' };
}

function parseTerminalProgress(entries: TerminalEntry[]): ParsedProgress | null {
  const text = entries
    .slice(-80)
    .map(entry => entry.text)
    .join('');
  const cleaned = stripAnsi(text).replace(/\r/g, '\n');
  const matches = [...cleaned.matchAll(/(?:^|[^\d])(\d{1,3}(?:\.\d+)?)\s?%/g)];
  const latest = matches.at(-1);
  if (!latest) return null;

  const percent = Math.max(0, Math.min(100, Number(latest[1])));
  if (!Number.isFinite(percent)) return null;

  const lines = cleaned
    .split(/\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const progressLine = [...lines].reverse().find(line => line.includes(latest[0].trim())) ?? 'Progress';
  const label = progressLine.length > 72 ? `${progressLine.slice(0, 69)}...` : progressLine;

  return { percent, label };
}

function getTerminalPreviewLines(entries: TerminalEntry[]) {
  return stripAnsi(
    entries
      .slice(-20)
      .map(entry => entry.text.replace(/\r/g, '\n'))
      .join('')
  )
    .split(/\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-3);
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}

function quotePreview(value: string) {
  return /\s/.test(value) ? `"${value}"` : value;
}

function renderCommandTemplate(template: string, values: Record<string, FieldValue>) {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return quotePreview(String(value ?? ''));
  });
}
