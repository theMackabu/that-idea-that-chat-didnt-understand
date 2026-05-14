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
  ShieldCheck,
  Square,
  Terminal,
  TerminalSquare,
  WandSparkles
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import type { GeneratedField, GeneratedUi, ToolOutputEvent } from "../../shared/schema";
import { TerminalEntry, TerminalPane } from "./components/TerminalPane";
import { cn } from "./lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const suggestions = [
  "I want to download some videos",
  "Make a small image resize tool",
  "Create a batch file renamer",
  "Pull audio from a video"
];

export function App() {
  const [prompt, setPrompt] = useState("");
  const [taskTitle, setTaskTitle] = useState("Untitled task");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ui, setUi] = useState<GeneratedUi | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean | undefined>>({});
  const [logs, setLogs] = useState<TerminalEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState("Idle");
  const [composing, setComposing] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    return window.uiterm.onToolOutput((event) => {
      if (event.type === "start") {
        setLogs([{ id: crypto.randomUUID(), text: `$ ${event.command}\n` }]);
        setStatus("Running");
        return;
      }

      setLogs((current) => [...current, toTerminalEntry(event)]);

      if (event.type === "exit") {
        setRunning(false);
        setRunId(null);
        setStatus(event.code === 0 ? "Completed" : `Exited ${event.code ?? event.signal ?? "unknown"}`);
      }
    });
  }, []);

  const commandPreview = useMemo(() => {
    if (!ui) return "No executable command";

    if (ui.tool === "shell.run") {
      return renderCommandTemplate(ui.command || ui.previewCommand || "", values) || "No command generated";
    }

    if (ui.tool !== "yt-dlp.download") return ui.previewCommand ?? "No executable command";

    const urls = String(values.urls || "<urls>").split(/\r?\n/).filter(Boolean).length;
    const quality = String(values.quality || "best");
    const outputDir = String(values.outputDir || "<output folder>");
    return `yt-dlp -P ${quotePreview(outputDir)} -f ${quality} ${urls > 1 ? `${urls} urls` : "<url>"}`;
  }, [ui, values]);

  async function compose(event?: FormEvent) {
    event?.preventDefault();
    if (!prompt.trim() || composing) return;

    const userText = prompt.trim();
    setComposing(true);
    setPrompt("");
    setUi(null);
    setValues({});
    setLogs([]);
    setShowOutput(false);
    setStatus("Generating");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: userText }]);

    try {
      const nextUi = await window.uiterm.composeUi(userText);
      setUi(nextUi);
      setTaskTitle(nextUi.title);
      setValues(inferDefaults(nextUi.fields));
      setLogs([]);
      setStatus("Ready");
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `${nextUi.title}: ${nextUi.summary}`
        }
      ]);
    } finally {
      setComposing(false);
    }
  }

  async function runAction() {
    if (!ui || ui.action.tool === "noop" || running) return;
    setRunning(true);
    setStatus("Starting");
    const result = await window.uiterm.runAction({ tool: ui.action.tool, values, command: ui.command || ui.previewCommand });
    setRunId(result.runId);
  }

  async function cancelRun() {
    if (!runId) return;
    await window.uiterm.cancelRun(runId);
    setStatus("Cancelling");
  }

  function startNewTask() {
    setPrompt("");
    setTaskTitle("Untitled task");
    setMessages([]);
    setUi(null);
    setValues({});
    setLogs([]);
    setRunId(null);
    setRunning(false);
    setStatus("Idle");
    setShowOutput(false);
  }

  return (
    <main className="scheme-only-dark flex h-screen flex-col bg-[#0a0a0b] text-neutral-100">
      <header className="app-drag flex h-12 shrink-0 select-none items-center justify-between border-b border-white/8 bg-[#101012] pr-4 pl-24">
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <TerminalSquare size={17} className="text-neutral-500" />
          <span>UITerm</span>
          <span className="text-neutral-700">/</span>
          <span className="font-medium text-neutral-200">{taskTitle}</span>
        </div>
        <div className="app-no-drag flex items-center gap-2">
          <div className="flex items-center gap-2 px-2 text-sm text-neutral-500">
            {status === "Completed" ? (
              <span className="size-1.5 rounded-full bg-emerald-400" />
            ) : (
              <span className="size-1.5 rounded-full bg-neutral-600" />
            )}
            {status}
          </div>
          <button
            type="button"
            className="flex size-8 select-none items-center justify-center rounded-md text-neutral-500 transition hover:bg-white/[0.04] hover:text-neutral-300"
            title="Toggle details"
          >
            <PanelRight size={17} />
          </button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={cn("mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 pt-10", ui ? "pb-24" : "pb-28")}>
            {ui ? (
              <div className="space-y-7">
                <TaskTranscript messages={messages} />
                <ToolForm
                  ui={ui}
                  values={values}
                  setValues={setValues}
                  commandPreview={commandPreview}
                  running={running}
                  logs={logs}
                  showOutput={showOutput}
                  onToggleOutput={() => setShowOutput((current) => !current)}
                  onRun={runAction}
                  onCancel={cancelRun}
                />
              </div>
            ) : composing ? (
              <GeneratingUi messages={[...messages, { id: "pending", role: "user", content: prompt || "Generating interface..." }]} />
            ) : (
              <InitialTaskDraft title={taskTitle} prompt={prompt} setPrompt={setPrompt} onSubmit={compose} />
            )}
          </div>
        </div>

        {ui ? (
          <Composer prompt={prompt} setPrompt={setPrompt} composing={composing} onSubmit={compose} onNewTask={startNewTask} />
        ) : (
          <InitialCommandBar prompt={prompt} setPrompt={setPrompt} composing={composing} onSubmit={compose} />
        )}
      </section>
    </main>
  );
}

function TaskTranscript({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <div key={message.id} className="group flex gap-3">
          <div className="mt-1 flex size-6 shrink-0 select-none items-center justify-center rounded-md bg-white/5 text-neutral-400 ring-1 ring-white/8">
            {message.role === "user" ? <WandSparkles size={14} /> : <TerminalSquare size={14} />}
          </div>
          <div>
            <div className="text-sm font-medium text-neutral-200">{message.role === "user" ? "Task" : "UITerm"}</div>
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
      <TaskTranscript messages={messages.filter((message) => message.id !== "pending" || message.content !== "Generating interface...")} />

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
      <SkeletonLine className={cn("h-4", wide ? "w-36" : "w-28")} />
      <SkeletonLine className={cn("rounded-lg", wide ? "h-24 w-full" : "h-10 w-full")} />
    </div>
  );
}

function SkeletonLine({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-md bg-white/[0.075]", className)} />;
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
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => submitOnCommandEnter(event, onSubmit)}
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
                onClick={() => setPrompt("")}
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
  prompt: string;
  setPrompt: (prompt: string) => void;
  onSubmit: (event?: FormEvent) => void;
}) {
  const { title, prompt, setPrompt, onSubmit } = props;

  return (
    <div className="flex flex-1 flex-col pt-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-neutral-100">{title}</h1>
        <textarea
          id="initial-intent"
          name="initial-intent"
          aria-label="Task"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => submitOnCommandEnter(event, onSubmit)}
          rows={4}
          placeholder="Describe the tool you want to make"
          className="mt-5 min-h-36 w-full resize-none bg-transparent text-xl text-neutral-100 outline-none placeholder:text-neutral-500 max-sm:text-base"
        />
      </div>

      <div className="mt-auto pb-6">
        <div className="flex max-w-2xl flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setPrompt(suggestion)}
              className="app-no-drag select-none rounded-full bg-white/[0.04] px-3 py-1.5 text-sm text-neutral-400 ring-1 ring-white/10 transition hover:bg-white/[0.07] hover:text-neutral-200"
            >
              {suggestion}
            </button>
          ))}
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
          onClick={() => setPrompt("")}
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
  if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return;
  event.preventDefault();
  onSubmit();
}

function ToolForm(props: {
  ui: GeneratedUi;
  values: Record<string, string | boolean | undefined>;
  setValues: (next: Record<string, string | boolean | undefined>) => void;
  commandPreview: string;
  running: boolean;
  logs: TerminalEntry[];
  showOutput: boolean;
  onToggleOutput: () => void;
  onRun: () => void;
  onCancel: () => void;
}) {
  const { ui, values, setValues, commandPreview, running, logs, showOutput, onToggleOutput, onRun, onCancel } = props;

  function setValue(name: string, value: string | boolean) {
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
        {ui.aiNote ? <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-sm leading-6 text-amber-200 ring-1 ring-amber-300/20">{ui.aiNote}</p> : null}
      </div>

      {ui.fields.length > 0 ? (
        <div className="space-y-4 rounded-xl bg-[#18191b] p-5 ring-1 ring-white/8">
          {ui.fields.map((field) => (
            <FieldRenderer key={field.name} field={field} value={values[field.name]} onChange={(value) => setValue(field.name, value)} />
          ))}
        </div>
      ) : null}

      <div className="rounded-xl bg-white/[0.035] p-3 ring-1 ring-white/8">
        <div className="mb-2 select-none text-sm font-medium text-neutral-400">Command preview</div>
        <code className="block break-words font-mono text-sm leading-6 text-neutral-300">{commandPreview}</code>
      </div>

      {ui.safety.length > 0 ? (
        <div className="space-y-2">
          {ui.safety.map((item) => (
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
          disabled={ui.action.tool === "noop" || running}
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

function FieldRenderer(props: {
  field: GeneratedField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const { field, value, onChange } = props;
  const inputId = `field-${field.name}`;

  return (
    <label htmlFor={inputId} className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-neutral-200">{field.label}</span>
        {field.required ? <span className="text-sm text-neutral-500">Required</span> : null}
      </div>

      {field.type === "textarea" ? (
        <textarea
          id={inputId}
          name={field.name}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={5}
          className="w-full resize-none rounded-lg bg-[#202124] px-3 py-2 text-sm text-neutral-100 ring-1 ring-white/10 outline-none transition placeholder:text-neutral-600 focus:ring-2 focus:ring-neutral-500 max-sm:text-base"
        />
      ) : null}

      {field.type === "text" ? (
        <input
          id={inputId}
          name={field.name}
          type="text"
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="h-10 w-full rounded-lg bg-[#202124] px-3 text-sm text-neutral-100 ring-1 ring-white/10 outline-none transition placeholder:text-neutral-600 focus:ring-2 focus:ring-neutral-500 max-sm:text-base"
        />
      ) : null}

      {field.type === "select" ? (
        <select
          id={inputId}
          name={field.name}
          value={String(value ?? field.defaultValue ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-lg bg-[#202124] px-3 text-sm text-neutral-100 ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-neutral-500 max-sm:text-base"
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {field.type === "checkbox" ? (
        <div className="flex h-10 items-center justify-between rounded-lg bg-[#202124] px-3 ring-1 ring-white/10">
          <span className="text-sm text-neutral-400">{Boolean(value) ? "Enabled" : "Disabled"}</span>
          <span className={cn("relative inline-flex w-10 rounded-full p-0.5 transition", value ? "bg-emerald-500" : "bg-white/14")}>
            <span className={cn("block aspect-square w-1/2 rounded-full bg-white shadow-sm transition", value ? "translate-x-full" : "translate-x-0")} />
            <input
              id={inputId}
              name={field.name}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
              className="absolute inset-0 size-full appearance-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
              aria-label={field.label}
            />
          </span>
        </div>
      ) : null}

      {field.type === "folder" ? (
        <div className="flex gap-2">
          <input
            id={inputId}
            name={field.name}
            type="text"
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
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

function inferDefaults(fields: GeneratedField[]) {
  return Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? (field.type === "checkbox" ? false : "")]));
}

function toTerminalEntry(event: ToolOutputEvent): TerminalEntry {
  if (event.type === "chunk") {
    return { id: crypto.randomUUID(), text: event.text, stream: event.stream };
  }

  if (event.type === "exit") {
    const label = event.code === 0 ? "process completed" : `process exited with ${event.code ?? event.signal ?? "unknown"}`;
    return { id: crypto.randomUUID(), text: `\n${label}\n` };
  }

  return { id: crypto.randomUUID(), text: "" };
}

function quotePreview(value: string) {
  return /\s/.test(value) ? `"${value}"` : value;
}

function renderCommandTemplate(template: string, values: Record<string, string | boolean | undefined>) {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (typeof value === "boolean") return value ? "true" : "false";
    return quotePreview(String(value ?? ""));
  });
}
