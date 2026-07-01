"use client";
// use-client: EventSource SSE + useState/useEffect pour stream live logs job —
// API navigateur (EventSource) inutilisable côté serveur.

/**
 * Content Generator — SSE log stream viewer (Fix P1-15 audit opérationnel
 * 2026-05-14).
 *
 * § 12.4 master prompt — consomme `/api/content-gen/jobs/[id]/stream`
 * (EventSource natif). Auto-scroll bas par défaut, pause sur scroll up,
 * close si le job termine (status published/failed/cancelled).
 */

import { useEffect, useRef, useState } from "react";

interface LogEvent {
  type: "log" | "status" | "ready" | "done" | "timeout" | "error";
  id?: string;
  level?: string;
  step?: string;
  message?: string;
  timestamp?: string;
  status?: string;
  qualityScore?: number | null;
  durationMs?: number | null;
  reason?: string;
  initialCount?: number;
}

interface LogLine {
  readonly id: string;
  readonly level: string;
  readonly step: string;
  readonly message: string;
  readonly timestamp: string;
}

export function JobLogStream({ jobId }: { readonly jobId: string }) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<string>("…");
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const url = `/api/content-gen/jobs/${jobId}/stream`;
    const es = new EventSource(url, { withCredentials: true });
    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      es.close();
    };
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data as string) as LogEvent;
        if (evt.type === "log" && evt.id && evt.step && evt.message && evt.timestamp) {
          setLogs((prev) => [
            ...prev,
            {
              id: evt.id!,
              level: evt.level ?? "info",
              step: evt.step!,
              message: evt.message!,
              timestamp: evt.timestamp!,
            },
          ]);
        } else if (evt.type === "status" && evt.status) {
          setStatus(evt.status);
        } else if (evt.type === "done") {
          setDone(true);
          es.close();
        } else if (evt.type === "timeout") {
          setDone(true);
          es.close();
        }
      } catch {
        // ignore malformed SSE event
      }
    };
    return () => es.close();
  }, [jobId]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span>
          Live :{" "}
          <strong
            style={{
              color: connected ? "var(--color-success, green)" : "var(--color-muted, gray)",
            }}
          >
            {connected ? (done ? "fermé" : "connecté") : "déconnecté"}
          </strong>{" "}
          · statut <strong>{status}</strong>
        </span>
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />{" "}
          Défilement auto
        </label>
      </div>
      <div
        ref={containerRef}
        style={{
          maxHeight: 400,
          overflowY: "auto",
          background: "rgba(0,0,0,0.04)",
          padding: 8,
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        {logs.length === 0 ? (
          <em>En attente de logs…</em>
        ) : (
          logs.map((l) => (
            <div key={l.id} style={{ marginBottom: 4 }}>
              <span style={{ color: "var(--color-muted, gray)" }}>{l.timestamp.slice(11, 19)}</span>{" "}
              <span
                style={{
                  color:
                    l.level === "error"
                      ? "var(--color-terracotta)"
                      : l.level === "warn"
                        ? "var(--color-warn, darkorange)"
                        : "var(--color-ink, currentColor)",
                  fontWeight: l.level === "error" ? "bold" : "normal",
                }}
              >
                [{l.step}]
              </span>{" "}
              {l.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
