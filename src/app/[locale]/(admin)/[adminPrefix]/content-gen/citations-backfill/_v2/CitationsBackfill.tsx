// use-client: useState + useTransition pour piloter aperçu/lancement du backfill citations par lots + feedback.
"use client";

import { useState, useTransition } from "react";
import {
  previewCitationsBackfill,
  runCitationsBackfill,
  type CitationsBackfillPreview,
  type CitationsBackfillRunResult,
} from "@/server/actions/content-gen/citations-backfill";

type Status = { kind: "error"; message: string } | { kind: "info"; message: string } | null;

interface Cumul {
  batches: number;
  processed: number;
  updated: number;
  citations: number;
}

const ZERO: Cumul = { batches: 0, processed: 0, updated: 0, citations: 0 };

export function CitationsBackfill() {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<CitationsBackfillPreview | null>(null);
  const [lastRun, setLastRun] = useState<CitationsBackfillRunResult | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [cumul, setCumul] = useState<Cumul>(ZERO);
  const [status, setStatus] = useState<Status>(null);

  function handlePreview() {
    setStatus(null);
    setLastRun(null);
    startTransition(async () => {
      const res = await previewCitationsBackfill();
      if ("error" in res) {
        setStatus({ kind: "error", message: res.error });
        return;
      }
      setPreview(res);
      setStatus({
        kind: "info",
        message:
          res.totalArticles === 0
            ? "Aucun article FR à scanner."
            : `${res.totalArticles} article(s) FR à scanner. Sur les ${res.sample.length} premiers, ${res.sampleWithCitations} obtiendrai(en)t des sources. Lance le rattrapage par lot de ${res.batchLimit}.`,
      });
    });
  }

  function handleRun() {
    setStatus(null);
    startTransition(async () => {
      const res = await runCitationsBackfill({ cursor });
      if ("error" in res) {
        setStatus({ kind: "error", message: res.error });
        return;
      }
      setLastRun(res);
      setPreview(null);
      setCursor(res.nextCursor);
      const nextCumul: Cumul = {
        batches: cumul.batches + 1,
        processed: cumul.processed + res.processed,
        updated: cumul.updated + res.updated,
        citations: cumul.citations + res.citations,
      };
      setCumul(nextCumul);

      if (res.nextCursor === null) {
        setDone(true);
        setStatus({
          kind: "info",
          message: `Terminé ✅ — ${nextCumul.processed} article(s) scanné(s) sur ${nextCumul.batches} lot(s), ${nextCumul.updated} avec sources, ${nextCumul.citations} citation(s) écrite(s) au total.`,
        });
      } else {
        setStatus({
          kind: "info",
          message: `Lot ${nextCumul.batches} : ${res.processed} scanné(s), ${res.updated} avec sources, ${res.citations} citation(s) écrite(s). Il reste ${res.remaining} article(s) → recliquez « Continuer ».`,
        });
      }
    });
  }

  function handleReset() {
    setCursor(null);
    setDone(false);
    setCumul(ZERO);
    setLastRun(null);
    setPreview(null);
    setStatus(null);
  }

  const runLabel = done
    ? "Terminé"
    : cumul.batches === 0
      ? `Lancer le rattrapage (lot de ${preview?.batchLimit ?? 50})`
      : "Continuer le lot suivant";

  return (
    <div className="flex flex-col gap-5">
      <div className="admin-card p-4">
        <p className="admin-meta">
          Ce bouton rejoue la détection des sources sur l’historique : pour chaque article, seuls
          les liens présents dans le catalogue vérifié sont écrits comme citations (les liens
          hors-catalogue sont ignorés, jamais inventés). L’opération est idempotente — relançable
          sans risque de doublon.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="admin-button-ghost"
          onClick={handlePreview}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? "…" : "Aperçu (sans rien modifier)"}
        </button>
        <button
          type="button"
          className="admin-button-cta"
          onClick={handleRun}
          disabled={pending || done}
          aria-busy={pending}
        >
          {pending ? "Traitement…" : runLabel}
        </button>
        {(done || cumul.batches > 0) && (
          <button
            type="button"
            className="admin-button-ghost"
            onClick={handleReset}
            disabled={pending}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {status ? (
        <p
          className={status.kind === "error" ? "admin-alert-error" : "admin-meta"}
          role={status.kind === "error" ? "alert" : "status"}
        >
          {status.kind === "error" ? `Erreur : ${status.message}` : status.message}
        </p>
      ) : null}

      {preview && preview.sample.length > 0 ? (
        <div className="admin-card p-4">
          <p className="admin-meta mb-2">Aperçu des premiers articles (dry-run) :</p>
          <ResultList items={preview.sample} />
        </div>
      ) : null}

      {lastRun && lastRun.items.length > 0 ? (
        <div className="admin-card p-4">
          <p className="admin-meta mb-2">Dernier lot traité :</p>
          <ResultList items={lastRun.items} />
          {lastRun.hallucinatedCount > 0 ? (
            <p className="admin-meta mt-2">
              ⚠ {lastRun.hallucinatedCount} URL(s) hors-catalogue détectée(s) dans ce lot — ignorées
              (non persistées).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultList({ items }: { items: { slug: string; action: string; citations?: number }[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it) => (
        <li key={it.slug} className="admin-meta">
          <code>{it.slug}</code>
          {" — "}
          {it.action === "persisted"
            ? `${it.citations ?? 0} source(s)`
            : it.action === "already"
              ? "déjà fait"
              : "aucune source"}
        </li>
      ))}
    </ul>
  );
}
