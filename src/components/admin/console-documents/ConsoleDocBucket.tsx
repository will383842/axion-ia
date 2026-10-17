// Bucket de documents console (server component) — liste + upload + actions.
// Utilisé par les pages Implémentations / Sites web / Autres.

import { auth } from "@/auth";
import { listConsoleDocsBySection } from "@/server/console-documents/queries";
import { vueArchivage } from "@/server/documents-organisme/documents-organisme";
import { horodatageParis } from "@/server/documents-organisme/documents-organisme-pur";
import { ActionsArchivageConsoleDoc } from "@/components/admin/documents-organisme/ActionsArchivageConsoleDoc";
import { getConsoleDocSection } from "@/server/console-documents/sections";
import type { ConsoleDocSection } from "../../../../prisma/generated/client";
import { ConsoleDocUploader } from "./ConsoleDocUploader";
import { ConsoleDocDeleteButton } from "./ConsoleDocDeleteButton";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface Props {
  section: ConsoleDocSection;
  adminPrefix: string;
}

export async function ConsoleDocBucket({
  section,
  adminPrefix,
}: Props): Promise<React.ReactElement> {
  const def = getConsoleDocSection(section);
  const docs = await listConsoleDocsBySection(section);
  // CHANTIER QNC, L13 — interrupteur allumé : versions remplacées gardées et
  // montrées à part, plus de suppression. Éteint : `vue` est nul, rien ne change.
  const role = ((await auth())?.user as { role?: string } | undefined)?.role;
  const vue = await vueArchivage("ConsoleDocument", docs, role);
  const liste = vue ? vue.enVigueur : docs;
  const fichiersBase = `/fr/${adminPrefix}/documents-interventions/fichiers`;
  const allowSensitive = section === "autres";

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-mocha mb-1 text-xl font-semibold">{def?.label ?? "Documents"}</h1>
          <p className="text-fg-muted max-w-prose text-sm">{def?.description}</p>
        </div>
        <ConsoleDocUploader section={section} allowSensitive={allowSensitive} />
      </div>

      {vue ? (
        <p className="text-fg-muted mb-4 text-xs">
          Rien ne s&apos;efface : remplacer un document garde l&apos;ancien, avec son fichier, dans
          «&nbsp;Versions remplacées&nbsp;».
          {vue.nbRetires > 0
            ? ` ${vue.nbRetires} document${vue.nbRetires > 1 ? "s" : ""} retiré${vue.nbRetires > 1 ? "s" : ""} par le super-administrateur (conservé${vue.nbRetires > 1 ? "s" : ""}, masqué${vue.nbRetires > 1 ? "s" : ""}).`
            : ""}
        </p>
      ) : null}

      {liste.length === 0 ? (
        <div className="border-border text-fg-muted rounded-lg border border-dashed bg-[color:var(--color-admin-paper)] p-8 text-center text-sm">
          Aucun document pour le moment. Cliquez sur «&nbsp;Ajouter un document&nbsp;» pour en
          déposer un.
        </div>
      ) : (
        <ul className="space-y-2">
          {liste.map((doc) => {
            const canPrint = !doc.sensitive && doc.mimeType === "application/pdf";
            return (
              <li
                key={doc.id}
                className="border-border flex items-center justify-between gap-4 rounded-lg border bg-[color:var(--color-admin-paper)] p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-mocha truncate text-sm font-semibold">{doc.title}</span>
                    {doc.sensitive ? (
                      <span
                        title="Document sensible — accès durci"
                        className="rounded bg-[color:var(--color-admin-destructive-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[color:var(--color-admin-destructive-fg)]"
                      >
                        sensible
                      </span>
                    ) : null}
                  </div>
                  {doc.description ? (
                    <p
                      className="text-fg-muted mt-0.5 truncate text-xs"
                      title={doc.description ?? ""}
                    >
                      {doc.description}
                    </p>
                  ) : null}
                  <p className="text-fg-muted mt-0.5 font-mono text-[11px]">
                    {doc.fileName} · {formatBytes(doc.sizeBytes)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <a
                    href={`${fichiersBase}/${doc.id}?dl=1`}
                    className="text-terracotta text-xs font-medium underline"
                  >
                    Télécharger
                  </a>
                  {canPrint ? (
                    <a
                      href={`${fichiersBase}/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-terracotta text-xs font-medium underline"
                    >
                      Imprimer
                    </a>
                  ) : null}
                  {vue ? (
                    <ActionsArchivageConsoleDoc
                      cible="ConsoleDocument"
                      id={doc.id}
                      titre={doc.title}
                      retraitPossible={vue.retraitPossible}
                    />
                  ) : (
                    <ConsoleDocDeleteButton id={doc.id} title={doc.title} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {vue && vue.remplacees.length > 0 ? (
        <details className="border-border mt-6 rounded-lg border bg-[color:var(--color-admin-paper)] p-4">
          <summary className="text-mocha cursor-pointer text-sm font-semibold">
            {`Versions remplacées (${vue.remplacees.length})`}
          </summary>
          <ul className="mt-3 space-y-2">
            {vue.remplacees.map(({ doc, remplacement, par }) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0">
                  <span className="text-mocha font-medium">{doc.title}</span>
                  <span className="text-fg-muted font-mono"> · {doc.fileName}</span>
                  <span className="text-fg-muted block">
                    {`Remplacée par ${par ? `« ${par.fileName} »` : "une version plus récente"} ${horodatageParis(remplacement.le)}`}
                  </span>
                </span>
                <a
                  href={`${fichiersBase}/${doc.id}?dl=1`}
                  className="text-terracotta font-medium underline"
                >
                  Télécharger
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
