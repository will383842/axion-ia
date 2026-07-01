"use client";
// use-client: EventSource SSE + useState/useEffect — API navigateur uniquement.
//
// Sprint A-suite P6 — Item 5. Consomme la route SSE existante
// `/api/content-gen/jobs/[id]/stream` et affiche statut + progress bar +
// qualityScore en temps réel. Fallback polling 10s si EventSource indisponible.

import { useEffect, useRef, useState, useCallback } from "react";

interface StatusEvent {
  type: "status";
  status: string;
  qualityScore?: number | null;
  durationMs?: number | null;
}

interface DoneEvent {
  type: "done";
  status: string;
}

type SseEvent =
  | StatusEvent
  | DoneEvent
  | { type: "ready"; initialCount: number }
  | { type: "timeout"; reason: string }
  | { type: "error"; message: string }
  | { type: "log" };

// Statuts qui ont un progress bar (ordre de pipeline)
const STATUS_PROGRESS: Record<string, number> = {
  queued: 5,
  running: 15,
  generating_text: 40,
  generating_image: 60,
  running_qa: 70,
  quality_improving: 80,
  needs_review: 90,
  approved: 95,
  publishing: 97,
  published: 100,
  failed: 100,
  cancelled: 100,
  quarantined_critical: 100,
  quarantined_factcheck: 100,
};

// Libellés FR pour l'affichage des statuts (valeurs d'enum inchangées en interne).
const STATUS_LABEL_FR: Record<string, string> = {
  queued: "En file",
  running: "En cours",
  generating_text: "Génération du texte",
  generating_image: "Génération de l'image",
  running_qa: "Contrôle qualité",
  quality_improving: "Amélioration qualité",
  needs_review: "À relire",
  approved: "Approuvé",
  publishing: "Publication",
  published: "Publié",
  failed: "Échec",
  cancelled: "Annulé",
  quarantined_critical: "Quarantaine (critique)",
  quarantined_factcheck: "Quarantaine (vérification)",
};

function statusColor(status: string): string {
  if (status === "published") return "var(--color-admin-success)";
  if (
    status === "failed" ||
    status === "quarantined_critical" ||
    status === "quarantined_factcheck"
  )
    return "var(--color-admin-destructive)";
  if (status === "cancelled") return "var(--color-admin-fg-muted)";
  return "var(--color-admin-info)";
}

function qualityBadgeClass(score: number): string {
  if (score >= 75) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

interface Props {
  jobId: string;
  initialStatus: string;
}

function isTerminalStatus(s: string): boolean {
  return (
    s === "published" ||
    s === "failed" ||
    s === "cancelled" ||
    s === "quarantined_critical" ||
    s === "quarantined_factcheck"
  );
}

export function JobsLiveStream({ jobId, initialStatus }: Props): React.ReactElement {
  const [status, setStatus] = useState(initialStatus);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  // Initialiser `done` depuis initialStatus pour éviter l'effect setState.
  const [done, setDone] = useState(() => isTerminalStatus(initialStatus));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = STATUS_PROGRESS[status] ?? 50;

  const pollStatus = useCallback(async () => {
    // P0-12 Sprint correctif admin — la route SSE supporte désormais
    // Accept: application/json pour un snapshot one-shot. On parse la réponse
    // JSON pour mettre à jour le statut sans ouvrir un stream SSE.
    try {
      const res = await fetch(`/api/content-gen/jobs/${jobId}/stream`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        status: string;
        qualityScore?: number | null;
        durationMs?: number | null;
      };
      setStatus(data.status);
      if (data.qualityScore != null) setQualityScore(data.qualityScore);
      if (data.durationMs != null) setDurationMs(data.durationMs);
      if (isTerminalStatus(data.status)) {
        setDone(true);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch {
      // Silencieux
    }
  }, [jobId]);

  useEffect(() => {
    // Si le job est déjà dans un état terminal (depuis initialStatus), pas de stream.
    if (done) return;

    // Tentative EventSource natif
    if (typeof EventSource !== "undefined") {
      const url = `/api/content-gen/jobs/${jobId}/stream`;
      const es = new EventSource(url, { withCredentials: true });

      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es.close();
        // Fallback polling toutes les 10s
        if (!done) {
          pollingRef.current = setInterval(() => void pollStatus(), 10_000);
        }
      };
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data as string) as SseEvent;
          if (evt.type === "status") {
            setStatus(evt.status);
            if (evt.qualityScore != null) setQualityScore(evt.qualityScore);
            if (evt.durationMs != null) setDurationMs(evt.durationMs);
          } else if (evt.type === "done") {
            setStatus(evt.status);
            setDone(true);
            es.close();
          } else if (evt.type === "timeout") {
            setDone(true);
            es.close();
          } else if (evt.type === "error") {
            setErrorMsg(evt.message);
          }
        } catch {
          // ignore malformed
        }
      };

      return () => {
        es.close();
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    } else {
      // EventSource indisponible — polling toutes les 10s
      pollingRef.current = setInterval(() => void pollStatus(), 10_000);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return (
    <div className="space-y-[var(--space-admin-3)]">
      {/* En-tête statut */}
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--text-admin-sm)]">
          Statut :{" "}
          <strong style={{ color: statusColor(status) }}>
            {STATUS_LABEL_FR[status] ?? status}
          </strong>
        </span>
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {connected && !done ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
              En direct
            </span>
          ) : done ? (
            "Terminé"
          ) : (
            "Déconnecté"
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression : ${progress}%`}
        className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-admin-surface-hover)]"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${progress}%`,
            backgroundColor: statusColor(status),
          }}
        />
      </div>

      {/* Métriques */}
      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        {qualityScore !== null ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${qualityBadgeClass(qualityScore)}`}
          >
            Qualité : {qualityScore}/100
          </span>
        ) : null}
        {durationMs !== null ? (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Durée : {(durationMs / 1000).toFixed(1)} s
          </span>
        ) : null}
      </div>

      {/* Erreur */}
      {errorMsg ? (
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-destructive)]">
          Erreur stream : {errorMsg}
        </p>
      ) : null}
    </div>
  );
}
