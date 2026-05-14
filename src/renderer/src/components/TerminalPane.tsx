import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";

export type TerminalEntry = {
  id: string;
  text: string;
  stream?: "stdout" | "stderr";
};

type Props = {
  entries: TerminalEntry[];
};

function readThemeValue(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function buildTerminalTheme() {
  const foreground = readThemeValue("--terminal-fg", "#37352f");
  const muted = readThemeValue("--text-faint", "rgba(55, 53, 47, 0.42)");
  const accent = readThemeValue("--accent", "#85827d");

  return {
    background: readThemeValue("--terminal-bg", "#f3f2ef"),
    foreground,
    blue: accent,
    brightBlack: muted,
    cyan: accent,
    green: readThemeValue("--success", "#4d7c0f"),
    red: readThemeValue("--warning-text", "#7c4a03"),
    yellow: readThemeValue("--warning-text", "#7c4a03")
  };
}

export function TerminalPane({ entries }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const writtenRef = useRef(0);

  useEffect(() => {
    if (!hostRef.current || termRef.current) return;

    const term = new Terminal({
      cursorBlink: false,
      disableStdin: true,
      fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      lineHeight: 1.25,
      theme: buildTerminalTheme()
    });

    term.open(hostRef.current);
    term.write("\u001b[2mwaiting for a run...\u001b[0m\r\n");
    termRef.current = term;

    const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      term.options.theme = buildTerminalTheme();
      term.refresh(0, term.rows - 1);
    };
    themeQuery.addEventListener("change", updateTheme);

    return () => {
      themeQuery.removeEventListener("change", updateTheme);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    if (entries.length === 0) {
      term.clear();
      term.write("\u001b[2mwaiting for a run...\u001b[0m\r\n");
      writtenRef.current = 0;
      return;
    }

    const nextEntries = entries.slice(writtenRef.current);
    for (const entry of nextEntries) {
      const color = entry.stream === "stderr" ? "\u001b[31m" : "";
      const reset = entry.stream === "stderr" ? "\u001b[0m" : "";
      term.write(`${color}${entry.text.replace(/\n/g, "\r\n")}${reset}`);
    }
    writtenRef.current = entries.length;
  }, [entries]);

  return <div ref={hostRef} className="h-full min-h-[230px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--terminal-bg)] p-2" />;
}
