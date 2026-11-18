// Bandeau « Où en est ce client » (fiche à 7 onglets, étape 1, 25/10/2026).
// Composant SERVEUR sans JavaScript, lecture seule : il ne déclenche aucun envoi.

import Link from "next/link";

import type { LigneBandeau } from "@/features/dossier-client/bandeau-ou-en-est";

export function BandeauOuEnEst({
  lignes,
  ficheHref,
}: {
  lignes: ReadonlyArray<LigneBandeau>;
  ficheHref: string;
}): React.ReactElement {
  return (
    <section
      aria-labelledby="ou-en-est-ce-client"
      data-bloc="ou-en-est"
      className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
    >
      <h2
        id="ou-en-est-ce-client"
        className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold"
      >
        Où en est ce client
      </h2>
      <dl className="grid gap-x-[var(--space-admin-5)] gap-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] sm:grid-cols-[max-content_1fr]">
        {lignes.map((l) => (
          <div key={l.cle} className="contents">
            <dt className="text-[color:var(--color-admin-fg-muted)]">{l.libelle}</dt>
            <dd>
              <Link
                href={`${ficheHref}?onglet=${l.onglet}`}
                className="underline-offset-2 hover:underline"
              >
                {l.texte}
              </Link>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
