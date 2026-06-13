"use client";
// use-client: liste de documents téléchargeables (useTransition + open URL signée).

import { useState, useTransition } from "react";
import { getRessourceDownloadUrlAction } from "@/server/actions/ressources/download.actions";

interface Doc {
  documentId: string;
  versionId: string;
  interventionSlug: string;
  interventionLabel: string;
  famille: string;
  titre: string;
  version: number;
  sourceFormat: string | null;
  hasSource: boolean;
  hasPdf: boolean;
  changeNote: string | null;
  publishedAt: string | null;
}

const FAMILLE_LABEL: Record<string, string> = {
  formation: "Formations",
  un_a_un: "1-to-1",
  audit: "Audits",
};

export function DocumentDownloadList({ documents }: { documents: Doc[] }): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function download(versionId: string, kind: "source" | "pdf") {
    setError(null);
    setBusyKey(`${versionId}:${kind}`);
    startTransition(async () => {
      const res = await getRessourceDownloadUrlAction({ versionId, kind });
      setBusyKey(null);
      if (!res.ok || !res.url) {
        setError(res.error ?? "Téléchargement indisponible.");
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  }

  if (documents.length === 0) {
    return (
      <p className="text-fg-muted text-sm">
        Aucun document disponible pour votre périmètre pour l&apos;instant.
      </p>
    );
  }

  // Regroupe par prestation.
  const groups = new Map<string, { label: string; famille: string; docs: Doc[] }>();
  for (const d of documents) {
    const g = groups.get(d.interventionSlug) ?? {
      label: d.interventionLabel,
      famille: d.famille,
      docs: [],
    };
    g.docs.push(d);
    groups.set(d.interventionSlug, g);
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-error text-sm">{error}</p> : null}
      {Array.from(groups.entries()).map(([slug, g]) => (
        <section key={slug}>
          <h2 className="text-mocha text-sm font-semibold">
            {g.label}
            <span className="text-fg-muted ml-2 text-xs font-normal">
              {FAMILLE_LABEL[g.famille] ?? g.famille}
            </span>
          </h2>
          <ul className="mt-2 space-y-2">
            {g.docs.map((d) => {
              const sourceKey = `${d.versionId}:source`;
              const pdfKey = `${d.versionId}:pdf`;
              return (
                <li
                  key={d.documentId}
                  className="border-border bg-cream flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <span className="text-mocha text-sm font-medium">{d.titre}</span>
                    <span className="text-fg-muted ml-2 text-xs">v{d.version}</span>
                    {d.changeNote ? <p className="text-fg-muted text-xs">{d.changeNote}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    {d.hasPdf ? (
                      <button
                        type="button"
                        disabled={pending && busyKey === pdfKey}
                        onClick={() => download(d.versionId, "pdf")}
                        className="bg-terracotta rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {busyKey === pdfKey ? "…" : "PDF"}
                      </button>
                    ) : null}
                    {d.hasSource ? (
                      <button
                        type="button"
                        disabled={pending && busyKey === sourceKey}
                        onClick={() => download(d.versionId, "source")}
                        className="border-terracotta text-terracotta rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        {busyKey === sourceKey
                          ? "…"
                          : `Source${d.sourceFormat ? ` (${d.sourceFormat})` : ""}`}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
