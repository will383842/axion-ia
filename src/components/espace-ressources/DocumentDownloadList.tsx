// Liste de documents téléchargeables. Les téléchargements passent par des
// liens <a href> vers une route serveur qui contrôle l'accès, signe l'URL R2
// et redirige (302) — navigation réelle, immunisée aux bloqueurs de pop-up.
// Composant rendable côté serveur (pas de state), donc pas de "use client".

import { buildRessourceDownloadHref } from "@/server/ressources/routes";

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
      {Array.from(groups.entries()).map(([slug, g]) => (
        <section key={slug}>
          <h2 className="text-mocha text-sm font-semibold">
            {g.label}
            <span className="text-fg-muted ml-2 text-xs font-normal">
              {FAMILLE_LABEL[g.famille] ?? g.famille}
            </span>
          </h2>
          <ul className="mt-2 space-y-2">
            {g.docs.map((d) => (
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
                    <a
                      href={buildRessourceDownloadHref(d.versionId, "pdf")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-terracotta rounded px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      PDF
                    </a>
                  ) : null}
                  {d.hasSource ? (
                    <a
                      href={buildRessourceDownloadHref(d.versionId, "source")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-terracotta text-terracotta rounded border px-3 py-1.5 text-xs font-semibold"
                    >
                      Source{d.sourceFormat ? ` (${d.sourceFormat})` : ""}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
