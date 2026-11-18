// Les deux tuiles de l'onglet E-mails (lot B2) : « Envoyés » (vert) et « À valider » (terracotta).
// Un décompte et un mot, jamais la couleur seule. Composant SERVEUR.

import { CheckCircle2, Hourglass } from "lucide-react";

import type { EchangeDuFil } from "@/features/dossier-client/fil-des-echanges";

/** Compte les e-mails PARTIS (journal « sent ») et ceux qui attendent une validation. PUR. */
export function compterEmails(fil: ReadonlyArray<EchangeDuFil>): {
  envoyes: number;
  aValider: number;
} {
  return {
    envoyes: fil.filter((x) => x.genre === "email" && x.statutEmail === "sent").length,
    aValider: fil.filter((x) => x.genre === "email_en_attente" && x.etat !== "Écarté").length,
  };
}

export function TuilesEmails({
  envoyes,
  aValider,
}: {
  envoyes: number;
  aValider: number;
}): React.ReactElement {
  return (
    <ul className="mb-[var(--space-admin-4)] grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-2">
      <li className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-bloc-vert-border)] bg-[color:var(--color-admin-bloc-vert-bg)] p-[var(--space-admin-3)] text-[color:var(--color-admin-bloc-vert-title)]">
        <p className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>Envoyés</span>
        </p>
        <p className="text-2xl font-semibold tabular-nums">{envoyes}</p>
      </li>
      <li className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-bloc-terracotta-border)] bg-[color:var(--color-admin-bloc-terracotta-bg)] p-[var(--space-admin-3)] text-[color:var(--color-admin-bloc-terracotta-title)]">
        <p className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          <Hourglass size={16} aria-hidden="true" />
          <span>À valider</span>
        </p>
        <p className="text-2xl font-semibold tabular-nums">{aValider}</p>
      </li>
    </ul>
  );
}
