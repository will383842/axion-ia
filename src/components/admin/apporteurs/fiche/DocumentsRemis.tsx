// Fiche apporteur — bloc « Documents remis » (point 11, issue 2464, PR C) : quelle version de quelle annexe a été
// jointe à quel envoi. Lecture seule, composant serveur sans état. Empreinte : 8 premiers caractères seulement.

import { AdminCard } from "@/components/admin/ui";

export interface DocumentRemisLigne {
  id: string;
  documentId: string;
  versionSha256: string;
  contexte: string;
  remisAt: Date;
}

const LIBELLE_DOCUMENT: Record<string, string> = {
  "fiche-commissions": "Fiche des commissions",
  livret: "Livret",
  "guide-demarrage": "Guide de démarrage",
};
const LIBELLE_CONTEXTE: Record<string, string> = {
  contrat_signe: "Contrat signé",
  renvoi_contrat: "Renvoi du contrat",
  lien_dossier: "Lien du dossier",
};

const dateHeureParis = (d: Date) =>
  d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

export function DocumentsRemis({ lignes }: { lignes: readonly DocumentRemisLigne[] }) {
  return (
    <AdminCard as="section">
      <h2 className="mb-[var(--space-admin-3)] font-semibold">Documents remis ({lignes.length})</h2>
      {lignes.length === 0 ? (
        <p className="text-[color:var(--color-admin-fg-muted)]">
          Aucune annexe tracée pour cet apporteur.
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          {lignes.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-[var(--space-admin-2)]">
              <span>
                <strong>{LIBELLE_DOCUMENT[l.documentId] ?? l.documentId}</strong>{" "}
                <code>{l.versionSha256.slice(0, 8)}</code> ·{" "}
                {LIBELLE_CONTEXTE[l.contexte] ?? l.contexte}
              </span>
              <span className="text-[color:var(--color-admin-fg-muted)]">
                {dateHeureParis(l.remisAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
