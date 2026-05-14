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
      theme: {
        background: "#171717",
        foreground: "#e7e5e4",
        blue: "#d6d3d1",
        brightBlack: "#78716c",
        cyan: "#d6d3d1",
        green: "#86efac",
        red: "#fca5a5",
        yellow: "#fde68a"
      }
    });

    term.open(hostRef.current);
    term.write("\u001b[2mwaiting for a run...\u001b[0m\r\n");
    termRef.current = term;

    return () => {
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

  return <div ref={hostRef} className="h-full min-h-[230px] overflow-hidden rounded-lg bg-neutral-900 p-2 ring-1 ring-black/10" />;
}
