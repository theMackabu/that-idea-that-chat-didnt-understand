import {
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Download,
  FolderOpen,
  Loader2,
  MessageSquare,
  Play,
  Send,
  ShieldCheck,
  Square,
  Terminal,
  TerminalSquare,
  WandSparkles
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { GeneratedField, GeneratedUi, ToolOutputEvent } from "../../shared/schema";
import { TerminalEntry, TerminalPane } from "./components/TerminalPane";
import { cn } from "./lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const starterPrompt = "I want to download some videos";

export function App() {
  const [prompt, setPrompt] = useState(starterPrompt);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Tell me what you want to do. I will turn it into a small safe UI when the tool exists."
    }
  ]);
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
    if (!ui || ui.tool !== "yt-dlp.download") return ui?.previewCommand ?? "No executable command";
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
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: userText }]);

    try {
      const nextUi = await window.uiterm.composeUi(userText);
      setUi(nextUi);
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
    const result = await window.uiterm.runAction({ tool: ui.action.tool, values });
    setRunId(result.runId);
  }

  async function cancelRun() {
    if (!runId) return;
    await window.uiterm.cancelRun(runId);
    setStatus("Cancelling");
  }

  return (
    <main className="grid h-screen grid-cols-[360px_minmax(0,1fr)] bg-[#f7f7f4] text-neutral-950">
      <aside className="flex min-h-0 flex-col border-r border-neutral-950/10 bg-white">
        <div className="border-b border-neutral-950/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-950 text-white">
              <TerminalSquare size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">UITerm</h1>
              <p className="text-sm text-neutral-500">Chat in, tools out</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-xl px-3 py-2.5 text-sm leading-6",
                message.role === "user"
                  ? "ml-8 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-900/10"
                  : "mr-8 bg-neutral-100 text-neutral-800 ring-1 ring-neutral-950/5"
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-neutral-500">
                {message.role === "user" ? <MessageSquare size={13} /> : <Bot size={13} />}
                {message.role === "user" ? "You" : "UITerm"}
              </div>
              {message.content}
            </div>
          ))}
        </div>

        <form onSubmit={compose} className="border-t border-neutral-950/10 bg-white p-4">
          <label htmlFor="intent" className="mb-2 block text-sm font-medium text-neutral-700">
            What should this do?
          </label>
          <textarea
            id="intent"
            name="intent"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm ring-1 ring-black/10 outline-none transition placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-950/80 max-sm:text-base"
          />
          <button
            type="submit"
            disabled={composing}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-3 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {composing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            Create UI
          </button>
        </form>
      </aside>

      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <header className="flex items-center justify-between border-b border-neutral-950/10 bg-white/90 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <WandSparkles size={14} />
              Generated workspace
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-balance">{ui?.title ?? "No UI generated yet"}</h2>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-950/5">
            {status === "Completed" ? <CheckCircle2 size={16} className="text-emerald-600" /> : <ShieldCheck size={16} className="text-neutral-500" />}
            {status}
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-6 py-8">
            {ui ? (
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
            ) : (
              <EmptyState onCompose={compose} />
            )}
          </div>
        </div>
      </section>
    </main>
  );
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
        <p className="max-w-[68ch] text-base leading-7 text-pretty text-neutral-700">{ui.summary}</p>
        {ui.aiNote ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950 ring-1 ring-amber-900/10">{ui.aiNote}</p> : null}
      </div>

      <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-950/10">
        {ui.fields.map((field) => (
          <FieldRenderer key={field.name} field={field} value={values[field.name]} onChange={(value) => setValue(field.name, value)} />
        ))}
      </div>

      <div className="rounded-xl bg-neutral-100 p-3 ring-1 ring-neutral-950/5">
        <div className="mb-2 text-sm font-medium text-neutral-600">Command preview</div>
        <code className="block break-words font-mono text-sm leading-6 text-neutral-900">{commandPreview}</code>
      </div>

      {ui.safety.length > 0 ? (
        <div className="space-y-2">
          {ui.safety.map((item) => (
            <div key={item} className="flex gap-2 text-sm leading-6 text-neutral-600">
              <ShieldCheck size={15} className="mt-1 shrink-0 text-emerald-600" />
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
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
          {ui.action.label}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!running}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm ring-1 ring-black/10 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Square size={15} />
          Stop
        </button>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-neutral-950/10">
        <button
          type="button"
          onClick={onToggleOutput}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
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
          <div className="border-t border-neutral-950/10 p-3">
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
        <span className="text-sm font-medium text-neutral-800">{field.label}</span>
        {field.required ? <span className="text-sm text-emerald-700">Required</span> : null}
      </div>

      {field.type === "textarea" ? (
        <textarea
          id={inputId}
          name={field.name}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={5}
          className="w-full resize-none rounded-lg bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm ring-1 ring-black/10 outline-none transition placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-950/80 max-sm:text-base"
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
          className="h-10 w-full rounded-lg bg-white px-3 text-sm text-neutral-950 shadow-sm ring-1 ring-black/10 outline-none transition placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-950/80 max-sm:text-base"
        />
      ) : null}

      {field.type === "select" ? (
        <select
          id={inputId}
          name={field.name}
          value={String(value ?? field.defaultValue ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-lg bg-white px-3 text-sm text-neutral-950 shadow-sm ring-1 ring-black/10 outline-none transition focus:ring-2 focus:ring-neutral-950/80 max-sm:text-base"
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {field.type === "checkbox" ? (
        <div className="flex h-10 items-center justify-between rounded-lg bg-neutral-100 px-3 ring-1 ring-neutral-950/5">
          <span className="text-sm text-neutral-700">{Boolean(value) ? "Enabled" : "Disabled"}</span>
          <span className={cn("relative inline-flex w-10 rounded-full p-0.5 transition", value ? "bg-emerald-600" : "bg-neutral-300")}>
            <span className={cn("block aspect-square w-1/2 rounded-full bg-white shadow-sm transition", value ? "translate-x-full" : "translate-x-0")} />
            <input
              id={inputId}
              name={field.name}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
              className="absolute inset-0 size-full appearance-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
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
            className="h-10 min-w-0 flex-1 rounded-lg bg-white px-3 text-sm text-neutral-950 shadow-sm ring-1 ring-black/10 outline-none transition focus:ring-2 focus:ring-neutral-950/80 max-sm:text-base"
          />
          <button
            type="button"
            onClick={async () => {
              const folder = await window.uiterm.selectFolder();
              if (folder) onChange(folder);
            }}
            className="flex h-10 w-11 items-center justify-center rounded-lg bg-white text-neutral-700 shadow-sm ring-1 ring-black/10 transition hover:bg-neutral-50"
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

function EmptyState({ onCompose }: { onCompose: () => void }) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-neutral-950/10">
        <Download size={24} />
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-balance text-neutral-950">Start with an intent</h3>
      <p className="mt-2 max-w-sm text-base leading-7 text-pretty text-neutral-600">Try the default prompt to generate a friendly tool UI with safe execution.</p>
      <button
        type="button"
        onClick={onCompose}
        className="mt-5 flex h-10 items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
      >
        <WandSparkles size={16} />
        Generate Example
      </button>
    </div>
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
