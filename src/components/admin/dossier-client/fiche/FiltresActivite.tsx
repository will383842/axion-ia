// Filtres de l'onglet Activité (lot B2) : des LIENS (`?onglet=activite&filtre=`), pas de JavaScript.

import Link from "next/link";

import { FILTRES_ACTIVITE, type FiltreActivite } from "@/features/dossier-client/fiche/chronologie";

export function FiltresActivite({
  ficheHref,
  actif,
  compteurs,
}: {
  ficheHref: string;
  actif: FiltreActivite;
  compteurs: Readonly<Record<FiltreActivite, number>>;
}): React.ReactElement {
  return (
    <nav aria-label="Filtrer l'activité" className="mb-[var(--space-admin-4)]">
      <ul className="flex flex-wrap gap-[var(--space-admin-2)]">
        {FILTRES_ACTIVITE.map((f) => {
          const courant = f.lecture === actif;
          return (
            <li key={f.lecture}>
              <Link
                href={`${ficheHref}?onglet=activite&filtre=${f.lecture}`}
                {...(courant ? { "aria-current": "page" as const } : {})}
                className={`inline-flex min-h-[44px] items-center gap-[var(--space-admin-2)] rounded-full border px-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] ${
                  courant
                    ? "border-[color:var(--color-admin-bloc-bleu-border)] bg-[color:var(--color-admin-bloc-bleu-bg)] font-semibold text-[color:var(--color-admin-bloc-bleu-title)]"
                    : "border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)]"
                }`}
              >
                <span>{f.libelle}</span>
                <span className="text-[color:var(--color-admin-fg-muted)] tabular-nums">
                  {compteurs[f.lecture]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
