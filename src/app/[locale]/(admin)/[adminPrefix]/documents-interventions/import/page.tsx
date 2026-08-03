// Documents interventions — Import en masse d'un kit de formation (ZIP).
// Tu déposes le .zip du kit → un job range automatiquement chaque document à sa
// place (idempotent : les inchangés sont sautés, les modifiés versionnés).

import { prisma } from "@/lib/prisma";
import { KitImporter } from "@/components/admin/documents-interventions/KitImporter";
import { TriangleAlert } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

const STATUT_LABEL: Record<string, string> = {
  en_attente: "En attente…",
  en_cours: "En cours…",
  termine: "Terminé",
  erreur: "Erreur",
};

const FAMILLE_LABEL: Record<string, string> = {
  formation: "Formations",
  un_a_un: "1-to-1",
  audit: "Audit",
};

interface Summary {
  created?: number;
  updated?: number;
  unchanged?: number;
  unmappedFolders?: string[];
  errors?: string[];
}

export default async function ImportKitPage(): Promise<React.ReactElement> {
  const runs = await prisma.kitImportRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      statut: true,
      famille: true,
      fileName: true,
      summary: true,
      error: true,
      createdAt: true,
      finishedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-mocha mb-1 text-xl font-semibold">Importer un kit</h1>
        <p className="text-fg-muted text-sm">
          Choisis le <strong>type de kit</strong>, puis dépose son <strong>.zip</strong>. Tout se
          range automatiquement à la bonne place. <strong>Relançable sans risque</strong> : les
          documents inchangés sont sautés, ceux que tu as modifiés créent une nouvelle version («
          Quoi de neuf »).
        </p>
        <ul className="text-fg-muted mt-2 list-disc space-y-0.5 pl-5 text-xs">
          <li>
            <strong>Formations</strong> : un dossier par formation, avec <em>Documents_DOCX</em>,{" "}
            <em>Documents_PDF</em> et <em>00_Presentation</em>.
          </li>
          <li>
            <strong>1-to-1 / Coaching AFEST</strong> : dossiers <em>Dirigeant/</em> et{" "}
            <em>Collaborateur/</em> (chacun avec <em>Documents_DOCX</em>) — la même trame alimente
            les formats 1 jour et 2 jours.
          </li>
        </ul>
      </div>

      <KitImporter />

      <section>
        <h2 className="text-mocha mb-2 text-sm font-semibold">Imports récents</h2>
        {runs.length === 0 ? (
          <p className="text-fg-muted text-sm">Aucun import pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => {
              const s = (r.summary ?? {}) as Summary;
              return (
                <li
                  key={r.id}
                  className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)] text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-mocha font-medium">
                      {r.fileName ?? "kit.zip"}
                      <span className="bg-sand text-fg-muted ml-2 rounded px-1.5 py-0.5 text-[11px] font-normal">
                        {FAMILLE_LABEL[r.famille] ?? r.famille}
                      </span>
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        r.statut === "termine"
                          ? "bg-sage-soft text-success"
                          : r.statut === "erreur"
                            ? "bg-error/10 text-error"
                            : "bg-sand text-fg-muted"
                      }`}
                    >
                      {STATUT_LABEL[r.statut] ?? r.statut}
                    </span>
                  </div>
                  <div className="text-fg-muted mt-1 text-xs">
                    {dateFmt.format(r.createdAt)}
                    {r.statut === "termine" ? (
                      <>
                        {" "}
                        · <strong className="text-success">{s.created ?? 0}</strong> créé
                        {(s.created ?? 0) > 1 ? "s" : ""} · <strong>{s.updated ?? 0}</strong> mis à
                        jour · <strong>{s.unchanged ?? 0}</strong> inchangé
                        {(s.unchanged ?? 0) > 1 ? "s" : ""}
                      </>
                    ) : null}
                  </div>
                  {r.error ? <p className="text-error mt-1 text-xs">{r.error}</p> : null}
                  {s.unmappedFolders && s.unmappedFolders.length > 0 ? (
                    <p className="text-fg-muted mt-1 text-xs">
                      <TriangleAlert
                        size={14}
                        aria-hidden="true"
                        className="inline-block shrink-0 align-[-0.125em]"
                      />{" "}
                      Dossiers non reconnus (ignorés) : {s.unmappedFolders.join(", ")}
                    </p>
                  ) : null}
                  {s.errors && s.errors.length > 0 ? (
                    <p className="text-error mt-1 text-xs">{s.errors.join(" · ")}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
