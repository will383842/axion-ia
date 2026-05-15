"use client";
// use-client: EventSource SSE + useEffect/useState pour stream live geo events
// — API navigateur inutilisable côté serveur.

/**
 * Content Generator — Geo events live banner (Fix P1-15bis audit opérationnel
 * 2026-05-14).
 *
 * § 12.4 + § 15.1.2 master prompt — consomme `/api/content-gen/geo-events`
 * (EventSource natif). Affiche un fil des 10 derniers événements avec
 * ville/status/score + timestamp. V1.5 = re-coloriage carte sur événement.
 */

import { useEffect, useState } from "react";

interface GeoEvent {
  type: "geo-event" | "tick" | "ready" | "timeout" | "error";
  jobId?: string;
  villeSlug?: string | null;
  regionSlug?: string | null;
  status?: string;
  contentType?: string;
  score?: number | null;
  at?: string;
  message?: string;
  count?: number;
}

interface DisplayEvent {
  readonly key: string;
  readonly villeSlug: string | null;
  readonly status: string;
  readonly score: number | null;
  readonly at: string;
}

const MAX_DISPLAYED = 10;

export function GeoEventsBanner() {
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/content-gen/geo-events", { withCredentials: true });
    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      es.close();
    };
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data as string) as GeoEvent;
        if (evt.type === "geo-event" && evt.jobId && evt.status && evt.at) {
          setEvents((prev) => {
            const next: DisplayEvent = {
              key: evt.jobId!,
              villeSlug: evt.villeSlug ?? null,
              status: evt.status!,
              score: evt.score ?? null,
              at: evt.at!,
            };
            return [next, ...prev].slice(0, MAX_DISPLAYED);
          });
        } else if (evt.type === "timeout") {
          es.close();
          setConnected(false);
        }
      } catch {
        // ignore malformed
      }
    };
    return () => es.close();
  }, []);

  return (
    <div
      className="admin-card"
      style={{
        marginBottom: 12,
        padding: 8,
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong>Live geo events (§ 12.4)</strong>
        <span
          style={{
            color: connected ? "var(--color-success, green)" : "var(--color-muted, gray)",
          }}
        >
          {connected ? "● connecté" : "○ déconnecté"}
        </span>
      </div>
      {events.length === 0 ? (
        <em style={{ color: "var(--color-muted, gray)" }}>
          En attente d&apos;événements (poll toutes les 5 s)…
        </em>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {events.map((e, i) => (
            <li
              key={`${e.key}-${i}`}
              style={{ padding: "2px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}
            >
              <span style={{ color: "var(--color-muted, gray)" }}>{e.at.slice(11, 19)}</span>{" "}
              <strong>{e.villeSlug ?? "—"}</strong> · {e.status}
              {e.score != null ? ` · score ${e.score}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
