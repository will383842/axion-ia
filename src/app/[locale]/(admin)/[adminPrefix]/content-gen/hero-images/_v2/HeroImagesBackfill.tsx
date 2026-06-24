// use-client: useState + useTransition pour piloter aperçu/lancement du rattrapage hero + feedback.
"use client";

import { useState, useTransition } from "react";
import { AdminBadge } from "@/components/admin/ui";
import {
  previewHeroBackfill,
  runHeroBackfill,
  type HeroBackfillPreview,
  type HeroBackfillRunResult,
} from "@/server/actions/content-gen/hero-backfill";

type Status = { kind: "error"; message: string } | { kind: "info"; message: string } | null;

export function HeroImagesBackfill() {
  const [pending, startTransition] = useTransition();
  const [replaceBank, setReplaceBank] = useState(true);
  const [preview, setPreview] = useState<HeroBackfillPreview | null>(null);
  const [lastRun, setLastRun] = useState<HeroBackfillRunResult | null>(null);
  const [status, setStatus] = useState<Status>(null);

  function handlePreview() {
    setStatus(null);
    setLastRun(null);
    startTransition(async () => {
      const res = await previewHeroBackfill({ replaceBank });
      if ("error" in res) {
        setStatus({ kind: "error", message: res.error });
        return;
      }
      setPreview(res);
      setStatus({
        kind: "info",
        message:
          res.remaining === 0
            ? "Aucun article à rattraper : tout est déjà en Unsplash. ✅"
            : `${res.remaining} article(s) à rattraper. Aperçu ci-dessous (10 max).`,
      });
    });
  }

  function handleRun() {
    setStatus(null);
    startTransition(async () => {
      const res = await runHeroBackfill({ replaceBank });
      if ("error" in res) {
        setStatus({ kind: "error", message: res.error });
        return;
      }
      setLastRun(res);
      setPreview(null);
      setStatus({
        kind: "info",
        message:
          res.remaining > 0
            ? `${res.updated} illustré(s), ${res.skipped} ignoré(s). Il reste ${res.remaining} article(s) → recliquez « Lancer » pour continuer.`
            : `Terminé ✅ ${res.updated} illustré(s), ${res.skipped} ignoré(s). Plus aucun article à rattraper.`,
      });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="admin-card flex items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={replaceBank}
          onChange={(e) => setReplaceBank(e.target.checked)}
          disabled={pending}
          className="mt-1"
        />
        <span>
          <strong>Remplacer aussi les anciennes images de la banque interne</strong>
          <br />
          <small className="admin-meta">
            Recommandé : convertit les héros image-bank existants en photos Unsplash. Les photos
            Unsplash déjà posées ne sont jamais retouchées.
          </small>
        </span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="admin-button"
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
          disabled={pending}
          aria-busy={pending}
        >
          {pending
            ? "Traitement…"
            : `Lancer le rattrapage (par lot de ${preview?.batchLimit ?? 25})`}
        </button>
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
          <p className="admin-meta mb-2">Aperçu des photos qui seraient posées :</p>
          <ResultList items={preview.sample} />
        </div>
      ) : null}

      {lastRun && lastRun.items.length > 0 ? (
        <div className="admin-card p-4">
          <p className="admin-meta mb-2">Dernier lot traité :</p>
          <ResultList items={lastRun.items} />
        </div>
      ) : null}
    </div>
  );
}

function ResultList({
  items,
}: {
  items: Array<{ slug: string; action: string; photographer?: string | null; reason?: string }>;
}) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {items.map((it) => (
        <li key={it.slug} className="flex flex-wrap items-center gap-2">
          <AdminBadge tone={it.action === "skip" ? "neutral" : "success"}>
            {it.action === "new" ? "nouveau" : it.action === "replace" ? "remplacé" : "ignoré"}
          </AdminBadge>
          <code>{it.slug}</code>
          {it.photographer ? <small className="admin-meta">📷 {it.photographer}</small> : null}
          {it.reason ? <small className="admin-meta">({it.reason})</small> : null}
        </li>
      ))}
    </ul>
  );
}
