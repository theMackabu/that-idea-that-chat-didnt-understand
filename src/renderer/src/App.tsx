import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eraser,
  FolderOpen,
  Loader2,
  PanelRight,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Square,
  Terminal,
  TerminalSquare,
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

type FieldValue = string | number | boolean | undefined;

type ToolExample = {
  title: string;
  description: string;
  prompt: string;
  category: string;
};

const suggestions = [
  { label: 'Download videos', prompt: 'I want to download some videos' },
  { label: 'Resize images', prompt: 'Make a small image resize tool' },
  { label: 'Batch rename', prompt: 'Create a batch file renamer' }
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

  const commandPreview = useMemo(() => {
    if (!ui) return 'No executable command';

    if (ui.tool === 'shell.run') {
      return renderCommandTemplate(ui.command || ui.previewCommand || '', values) || 'No command generated';
    }

    if (ui.tool !== 'yt-dlp.download') return ui.previewCommand ?? 'No executable command';

    const urls = String(values.urls || '<urls>')
      .split(/\r?\n/)
      .filter(Boolean).length;
    const quality = String(values.quality || 'best');
    const outputDir = String(values.outputDir || '<output folder>');
    return `yt-dlp -P ${quotePreview(outputDir)} -f ${quality} ${urls > 1 ? `${urls} urls` : '<url>'}`;
  }, [ui, values]);

  async function compose(event?: FormEvent) {
    event?.preventDefault();
    if (!prompt.trim() || composing) return;

    const userText = prompt.trim();
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
      const nextUi = await window.uiterm.composeUi(userText);
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
    const result = await window.uiterm.runAction({ tool: ui.action.tool, values, command: ui.command || ui.previewCommand });
    setRunId(result.runId);
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
  }

  function renameDraftTitle(nextTitle: string) {
    setTaskTitle(nextTitle);
    setTaskTitleEdited(true);
  }

  return (
    <main className="scheme-only-dark flex h-screen flex-col bg-[#0a0a0b] text-neutral-100">
      <header className="app-drag flex h-12 shrink-0 select-none items-center justify-between border-b border-white/8 bg-[#101012] pr-4 pl-24">
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <button
            type="button"
            onClick={startNewTask}
            className="app-no-drag flex select-none items-center gap-3 rounded-md px-1 py-1 text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
            title="New task"
          >
            <TerminalSquare size={17} className="text-neutral-500" />
            <span>UITerm</span>
          </button>
          <span className="text-neutral-700">/</span>
          <span className="font-medium text-neutral-200">{taskTitle}</span>
        </div>
        <div className="app-no-drag flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(current => !current)}
            className="flex size-8 select-none items-center justify-center rounded-md text-neutral-500 transition hover:bg-white/[0.04] hover:text-neutral-300"
            title="Toggle generated tools"
          >
            <PanelRight size={17} />
          </button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className={cn('mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 pt-10', ui ? 'pb-64' : 'pb-28')}>
              {ui ? (
                <div className="space-y-7">
                  <TaskTranscript messages={messages} />
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
                <GeneratingUi messages={[...messages, { id: 'pending', role: 'user', content: prompt || 'Generating interface...' }]} />
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

        {sidebarOpen ? <ToolSidebar items={toolHistory} activeId={activeToolId} onSelect={restoreTool} /> : null}
      </section>
    </main>
  );
}

function ToolSidebar(props: { items: ToolHistoryItem[]; activeId: string | null; onSelect: (item: ToolHistoryItem) => void }) {
  const { items, activeId, onSelect } = props;

  return (
    <aside className="app-no-drag relative z-20 flex w-80 shrink-0 select-none flex-col border-l border-white/8 bg-[#101012]">
      <div className="border-b border-white/8 px-4 py-3">
        <div className="text-sm font-medium text-neutral-200">Generated tools</div>
        <div className="mt-1 text-sm text-neutral-600">{items.length === 1 ? '1 tool' : `${items.length} tools`}</div>
      </div>

      {items.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={cn('w-full rounded-lg px-3 py-2.5 text-left', item.id === activeId ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')}
            >
              <div className="truncate text-sm font-medium text-neutral-200">{item.title}</div>
              <div className="mt-1 line-clamp-2 text-sm leading-5 text-neutral-500">{item.summary}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 py-5 text-sm leading-6 text-neutral-500">Generated tools will show up here after you send a task.</div>
      )}
    </aside>
  );
}

function TaskTranscript({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-3">
      {messages.map(message => (
        <div key={message.id} className="group flex gap-3">
          <div className="mt-1 flex size-6 shrink-0 select-none items-center justify-center rounded-md bg-white/5 text-neutral-400 ring-1 ring-white/8">
            {message.role === 'user' ? <WandSparkles size={14} /> : <TerminalSquare size={14} />}
          </div>
          <div>
            <div className="text-sm font-medium text-neutral-200">{message.role === 'user' ? 'Task' : 'UITerm'}</div>
            <p className="mt-1 max-w-[68ch] text-sm leading-6 text-pretty text-neutral-400">{message.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function GeneratingUi({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-7">
      <TaskTranscript messages={messages.filter(message => message.id !== 'pending' || message.content !== 'Generating interface...')} />

      <div className="space-y-6">
        <div className="flex select-none items-center gap-2 text-sm font-medium text-neutral-400">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#6aa4ff] opacity-35" />
            <span className="relative inline-flex size-3 rounded-full bg-[#6aa4ff]" />
          </span>
          Generating interface
        </div>

        <div className="space-y-3">
          <SkeletonLine className="h-8 w-64" />
          <SkeletonLine className="h-4 w-full max-w-xl" />
          <SkeletonLine className="h-4 w-2/3" />
        </div>

        <div className="space-y-4 rounded-xl bg-[#18191b] p-5 ring-1 ring-white/8">
          <SkeletonField wide />
          <SkeletonField />
          <SkeletonField />
        </div>

        <div className="rounded-xl bg-white/[0.035] p-3 ring-1 ring-white/8">
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
  return <div className={cn('animate-pulse rounded-md bg-white/[0.075]', className)} />;
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b] to-transparent px-6 pb-7 pt-12">
      <div className="pointer-events-auto mx-auto w-full max-w-2xl">
        <form onSubmit={onSubmit} className="app-no-drag rounded-xl bg-[#202124] p-2 ring-1 ring-white/10">
          <textarea
            id="intent"
            name="intent"
            aria-label="Task"
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            onKeyDown={event => submitOnCommandEnter(event, onSubmit)}
            rows={1}
            placeholder="Ask for a change or describe another tool"
            className="max-h-24 min-h-10 w-full resize-none bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 max-sm:text-base"
          />
          <div className="flex items-center justify-between gap-3 border-t border-white/8 px-2 pt-2">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <button
                type="button"
                onClick={onNewTask}
                className="flex select-none items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-white/5 hover:text-neutral-300"
              >
                <RotateCcw size={14} />
                New task
              </button>
              <span className="h-4 w-px bg-white/10" />
              <button
                type="button"
                onClick={() => setPrompt('')}
                disabled={!prompt}
                className="flex select-none items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-white/5 hover:text-neutral-300 disabled:text-neutral-700 disabled:hover:bg-transparent"
              >
                <Eraser size={14} />
                Clear
              </button>
            </div>
            <button
              type="submit"
              disabled={!prompt.trim() || composing}
              className="flex h-8 select-none items-center justify-center gap-2 rounded-lg bg-neutral-100 px-2.5 text-sm font-medium text-neutral-950 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:bg-white/10 disabled:text-neutral-600"
              title="Send with Cmd+Enter"
            >
              {composing ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <>
                  <span>Send</span>
                  <span className="text-neutral-500">⌘↵</span>
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

  function chooseIdea(idea: string) {
    setPrompt(idea);
    setShowMoreIdeas(false);
  }

  return (
    <div className="flex flex-1 flex-col pt-4">
      <div className="w-full max-w-2xl">
        <input
          id="task-title"
          name="task-title"
          aria-label="Task title"
          value={title}
          onChange={event => setTitle(event.target.value)}
          className="block w-full bg-transparent p-0 text-[40px] font-semibold leading-none tracking-tight text-neutral-100 outline-none placeholder:text-neutral-600"
          placeholder="Untitled task"
        />
        <textarea
          id="initial-intent"
          name="initial-intent"
          aria-label="Task"
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
          onKeyDown={event => submitOnCommandEnter(event, onSubmit)}
          rows={4}
          placeholder="Describe the tool you want to make"
          className="mt-5 min-h-24 w-full resize-none bg-transparent text-xl text-neutral-100 outline-none placeholder:text-neutral-500 max-sm:text-base"
        />

        <div className="-mt-8 flex select-none flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-neutral-700">Try</span>
          {suggestions.map(suggestion => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => chooseIdea(suggestion.prompt)}
              className="app-no-drag text-neutral-500 transition hover:text-neutral-200"
            >
              {suggestion.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowMoreIdeas(true)}
            className="app-no-drag rounded-md bg-white/[0.035] px-2 py-1 text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-100"
          >
            More
          </button>
        </div>
      </div>

      {showMoreIdeas ? <IdeasDialog onClose={() => setShowMoreIdeas(false)} onChoose={chooseIdea} /> : null}
    </div>
  );
}

function IdeasDialog(props: { onClose: () => void; onChoose: (idea: string) => void }) {
  const { onClose, onChoose } = props;
  const [query, setQuery] = useState('');
  const filteredExamples = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return toolExamples;

    return toolExamples.filter(example =>
      [example.title, example.description, example.category, example.prompt].some(value => value.toLowerCase().includes(normalizedQuery))
    );
  }, [query]);

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 bg-[#0d0d0e]">
      <div className="app-no-drag flex h-full flex-col">
        <div className="flex h-12 shrink-0 select-none items-center justify-between border-b border-white/8 pr-4 pl-24">
          <div className="flex items-center gap-3 text-sm text-neutral-400">
            <span className="rounded-md bg-white/[0.06] px-2 py-1 text-neutral-100">Examples</span>
            <span>Tool gallery</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 select-none items-center justify-center rounded-md text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-10">
          <div className="mx-auto w-full max-w-5xl">
            <h2 className="text-center text-4xl font-medium tracking-tight text-neutral-100">Make UITerm work your way</h2>

            <div className="mx-auto mt-8 flex max-w-3xl items-center gap-3">
              <div className="grid h-10 flex-1 grid-cols-[auto_1fr] items-center gap-2 rounded-lg bg-[#202124] px-3 ring-1 ring-white/10">
                <Search size={18} className="text-neutral-500" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search examples"
                  className="h-full bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
                />
              </div>
              <div className="hidden h-10 select-none items-center rounded-lg bg-white/[0.05] px-3 text-sm text-neutral-300 ring-1 ring-white/8 sm:flex">
                {filteredExamples.length} ideas
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl bg-[#121724] ring-1 ring-white/10">
              <div className="flex min-h-64 flex-col items-center justify-center bg-[radial-gradient(circle_at_30%_15%,rgba(106,164,255,0.26),transparent_36%),radial-gradient(circle_at_78%_36%,rgba(168,85,247,0.2),transparent_34%)] px-6 py-10 text-center">
                <div className="rounded-full bg-black/50 px-4 py-2 text-sm text-neutral-300 ring-1 ring-white/10">
                  <span className="text-neutral-500">{featuredExample.category}</span>
                  <span className="mx-2 text-neutral-700">/</span>
                  {featuredExample.title}
                </div>
                <p className="mt-4 max-w-xl text-lg text-neutral-200">{featuredExample.description}</p>
                <button
                  type="button"
                  onClick={() => onChoose(featuredExample.prompt)}
                  className="mt-7 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white"
                >
                  Try in task
                </button>
              </div>
            </div>

            <div className="mt-10 flex select-none items-center justify-between border-b border-white/8 pb-3">
              <div className="text-lg font-medium text-neutral-100">Featured</div>
              <div className="text-sm text-neutral-600">Click an example to fill the prompt</div>
            </div>

            <div className="grid gap-x-14 gap-y-3 py-6 sm:grid-cols-2">
              {filteredExamples.map(example => (
                <button
                  key={`${example.category}-${example.title}`}
                  type="button"
                  onClick={() => onChoose(example.prompt)}
                  className="grid select-none grid-cols-[44px_1fr_auto] items-center gap-4 rounded-xl px-3 py-3 text-left hover:bg-white/[0.04]"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-medium text-neutral-200 ring-1 ring-white/10">
                    {example.category.slice(0, 2)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-100">{example.title}</span>
                    <span className="mt-1 block truncate text-sm text-neutral-500">{example.description}</span>
                  </span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-white/[0.05] text-xl text-neutral-400 ring-1 ring-white/8">+</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b] to-transparent px-6 pb-7 pt-14">
      <div className="pointer-events-auto mx-auto flex h-12 w-fit select-none items-center gap-3 rounded-xl bg-[#202124] px-3 text-sm text-neutral-500 ring-1 ring-white/10">
        <span className="px-2 text-neutral-400">Tool draft</span>
        <span className="h-5 w-px bg-white/10" />
        <button
          type="button"
          onClick={() => setPrompt('')}
          disabled={!prompt}
          className="app-no-drag flex select-none items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-white/5 hover:text-neutral-300 disabled:text-neutral-700 disabled:hover:bg-transparent"
        >
          <Eraser size={14} />
          Clear
        </button>
        <span className="h-5 w-px bg-white/10" />
        <button
          type="button"
          onClick={() => onSubmit()}
          disabled={!canSubmit || composing}
          className="app-no-drag flex select-none items-center gap-2 rounded-md px-2 py-1 font-medium text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200 disabled:text-neutral-600 disabled:hover:bg-transparent"
        >
          {composing ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <>
              <span>Send</span>
              <span className="text-neutral-600">⌘↵</span>
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
      <figure className="overflow-hidden rounded-xl bg-[#18191b] ring-1 ring-white/8 sm:col-span-2">
        {block.url ? <img src={block.url} alt={block.alt ?? block.title ?? ''} className="max-h-80 w-full object-cover" /> : null}
        {block.title || block.text ? (
          <figcaption className="space-y-1 p-4">
            {block.title ? <div className="text-sm font-medium text-neutral-100">{block.title}</div> : null}
            {block.text ? <div className="text-sm leading-6 text-neutral-500">{block.text}</div> : null}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (block.type === 'metric') {
    return (
      <div className="rounded-xl bg-[#18191b] p-4 ring-1 ring-white/8">
        <div className="text-sm text-neutral-500">{block.label ?? block.title ?? 'Metric'}</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-neutral-100">{block.value ?? '--'}</div>
        {block.text ? <div className="mt-2 text-sm leading-6 text-neutral-500">{block.text}</div> : null}
      </div>
    );
  }

  if (block.type === 'barChart') {
    const data = block.data ?? [];
    const maxValue = Math.max(1, ...data.map(item => item.value));

    return (
      <div className="rounded-xl bg-[#18191b] p-4 ring-1 ring-white/8 sm:col-span-2">
        {block.title ? <div className="mb-4 text-sm font-medium text-neutral-100">{block.title}</div> : null}
        <div className="space-y-3">
          {data.map(item => (
            <div key={item.label} className="grid grid-cols-[minmax(88px,0.32fr)_1fr_auto] items-center gap-3 text-sm">
              <div className="truncate text-neutral-500">{item.label}</div>
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-[#6aa4ff]" style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }} />
              </div>
              <div className="font-mono text-neutral-400">{item.value}</div>
            </div>
          ))}
        </div>
        {block.text ? <div className="mt-4 text-sm leading-6 text-neutral-500">{block.text}</div> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#18191b] p-4 ring-1 ring-white/8 sm:col-span-2">
      {block.title ? <div className="text-sm font-medium text-neutral-100">{block.title}</div> : null}
      {block.text ? <div className={cn('text-sm leading-6 text-neutral-500', block.title ? 'mt-2' : '')}>{block.text}</div> : null}
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

  function setValue(name: string, value: string | number | boolean) {
    setValues({ ...values, [name]: value });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex select-none items-center gap-2 text-sm font-medium text-neutral-400">
          <WandSparkles size={15} />
          Generated interface
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-neutral-100">{ui.title}</h1>
        <p className="mt-2 max-w-[68ch] text-sm leading-6 text-pretty text-neutral-400">{ui.summary}</p>
        {ui.aiNote ? (
          <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-sm leading-6 text-amber-200 ring-1 ring-amber-300/20">{ui.aiNote}</p>
        ) : null}
      </div>

      {ui.blocks && ui.blocks.length > 0 ? <GeneratedBlocks blocks={ui.blocks} /> : null}

      {ui.fields.length > 0 ? (
        <div className="space-y-4 rounded-xl bg-[#18191b] p-5 ring-1 ring-white/8">
          {ui.fields.map(field => (
            <FieldRenderer key={field.name} field={field} value={values[field.name]} onChange={value => setValue(field.name, value)} />
          ))}
        </div>
      ) : null}

      <div className="rounded-xl bg-white/[0.035] p-3 ring-1 ring-white/8">
        <div className="mb-2 select-none text-sm font-medium text-neutral-400">Command preview</div>
        <code className="block break-words font-mono text-sm leading-6 text-neutral-300">{commandPreview}</code>
      </div>

      {ui.safety.length > 0 ? (
        <div className="space-y-2">
          {ui.safety.map(item => (
            <div key={item} className="flex gap-2 text-sm leading-6 text-neutral-500">
              <ShieldCheck size={15} className="mt-1 shrink-0 select-none text-emerald-400" />
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
          className="flex h-9 flex-1 select-none items-center justify-center gap-2 rounded-lg bg-neutral-100 px-3 text-sm font-medium text-neutral-950 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
          {ui.action.label}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!running}
          className="flex h-9 select-none items-center justify-center gap-2 rounded-lg bg-white/[0.04] px-3 text-sm font-medium text-neutral-300 ring-1 ring-white/10 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Square size={15} />
          Stop
        </button>
      </div>

      <div className="rounded-xl bg-[#18191b] ring-1 ring-white/8">
        <button
          type="button"
          onClick={onToggleOutput}
          className="flex w-full select-none items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-300 transition hover:bg-white/[0.03]"
        >
          <span className="flex items-center gap-2">
            <Terminal size={16} />
            Run details
          </span>
          <span className="flex items-center gap-2 text-neutral-500">
            {logs.length} events
            {showOutput ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>
        {showOutput ? (
          <div className="border-t border-white/8 p-3">
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

  return (
    <label htmlFor={inputId} className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-neutral-200">{field.label}</span>
        {field.required ? <span className="text-sm text-neutral-500">Required</span> : null}
      </div>

      {field.type === 'textarea' ? (
        <textarea
          id={inputId}
          name={field.name}
          value={String(value ?? '')}
          onChange={event => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={5}
          className="w-full resize-none rounded-lg bg-[#202124] px-3 py-2 text-sm text-neutral-100 ring-1 ring-white/10 outline-none transition placeholder:text-neutral-600 focus:ring-2 focus:ring-neutral-500 max-sm:text-base"
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
          className="h-10 w-full rounded-lg bg-[#202124] px-3 text-sm text-neutral-100 ring-1 ring-white/10 outline-none transition placeholder:text-neutral-600 focus:ring-2 focus:ring-neutral-500 max-sm:text-base"
        />
      ) : null}

      {field.type === 'select' ? (
        <select
          id={inputId}
          name={field.name}
          value={String(value ?? field.defaultValue ?? '')}
          onChange={event => onChange(event.target.value)}
          className="h-10 w-full rounded-lg bg-[#202124] px-3 text-sm text-neutral-100 ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-neutral-500 max-sm:text-base"
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
          className="h-10 w-full rounded-lg bg-[#202124] px-3 text-sm text-neutral-100 ring-1 ring-white/10 outline-none transition placeholder:text-neutral-600 focus:ring-2 focus:ring-neutral-500 max-sm:text-base"
        />
      ) : null}

      {field.type === 'slider' ? (
        <div className="rounded-lg bg-[#202124] px-3 py-3 ring-1 ring-white/10">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-500">
              {field.min ?? 0} - {field.max ?? 100}
            </span>
            <span className="font-mono text-sm text-neutral-300">{String(value ?? field.defaultValue ?? field.min ?? 0)}</span>
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
            className="w-full accent-[#6aa4ff]"
          />
        </div>
      ) : null}

      {field.type === 'color' ? (
        <div className="flex h-10 items-center gap-3 rounded-lg bg-[#202124] px-3 ring-1 ring-white/10">
          <input
            id={inputId}
            name={field.name}
            type="color"
            value={String(value ?? field.defaultValue ?? '#6aa4ff')}
            onChange={event => onChange(event.target.value)}
            className="size-6 cursor-pointer appearance-none rounded border-0 bg-transparent p-0"
          />
          <span className="font-mono text-sm text-neutral-300">{String(value ?? field.defaultValue ?? '#6aa4ff')}</span>
        </div>
      ) : null}

      {field.type === 'checkbox' ? (
        <div className="flex h-10 items-center justify-between rounded-lg bg-[#202124] px-3 ring-1 ring-white/10">
          <span className="text-sm text-neutral-400">{Boolean(value) ? 'Enabled' : 'Disabled'}</span>
          <span className={cn('relative inline-flex w-10 rounded-full p-0.5 transition', value ? 'bg-emerald-500' : 'bg-white/14')}>
            <span
              className={cn('block aspect-square w-1/2 rounded-full bg-white shadow-sm transition', value ? 'translate-x-full' : 'translate-x-0')}
            />
            <input
              id={inputId}
              name={field.name}
              type="checkbox"
              checked={Boolean(value)}
              onChange={event => onChange(event.target.checked)}
              className="absolute inset-0 size-full appearance-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
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
            className="h-10 min-w-0 flex-1 rounded-lg bg-[#202124] px-3 text-sm text-neutral-100 ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-neutral-500 max-sm:text-base"
          />
          <button
            type="button"
            onClick={async () => {
              const folder = await window.uiterm.selectFolder();
              if (folder) onChange(folder);
            }}
            className="flex h-10 w-11 select-none items-center justify-center rounded-lg bg-white/[0.04] text-neutral-300 ring-1 ring-white/10 transition hover:bg-white/[0.07]"
            title="Choose folder"
          >
            <FolderOpen size={16} />
          </button>
        </div>
      ) : null}

      {field.description ? <p className="mt-1 text-sm leading-6 text-neutral-500">{field.description}</p> : null}
    </label>
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
            ? field.min ?? 0
            : field.type === 'color'
              ? '#6aa4ff'
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
