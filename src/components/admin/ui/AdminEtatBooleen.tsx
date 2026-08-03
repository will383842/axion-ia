// État oui/non d'une cellule de tableau — 2026-08-02.
//
// POURQUOI CE COMPOSANT EXISTE
// -----------------------------
// Une quinzaine de tableaux de la console rendaient leurs colonnes booléennes
// (« Actif », « Auto-pub », « 2FA », « Doctrine OK ») par une paire d'emojis :
// `r.isActive ? "✅" : "🚫"`. Trois défauts, tous réels :
//
//   1. le dessin, la chasse et la graisse d'un emoji dépendent du système et
//      de la police du poste — impossible d'aligner une colonne dessus, et le
//      rendu change d'un utilisateur à l'autre ;
//   2. rien n'était annoncé à la synthèse vocale : une colonne entière d'états
//      se lisait comme une suite de noms de caractères Unicode, quand elle se
//      lisait ;
//   3. les paires employées n'étaient pas les mêmes d'un tableau à l'autre
//      (✅/🚫, ✅/—, ✓/—), donc la même information se disait de trois façons.
//
// Un dessin lucide, une couleur de tonalité, un nom accessible — et une seule
// écriture pour toute la console.

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminEtatBooleenProps {
  /** L'état à rendre. */
  actif: boolean;
  /**
   * Nom accessible des deux états. Le défaut convient à une colonne « Actif » ;
   * précisez-le dès que la colonne dit autre chose (« 2FA activée » /
   * « 2FA désactivée »), pour que la synthèse vocale annonce l'information
   * réelle plutôt qu'un « oui » hors contexte.
   */
  libelles?: { vrai: string; faux: string };
  className?: string;
}

export function AdminEtatBooleen({
  actif,
  libelles = { vrai: "Oui", faux: "Non" },
  className,
}: AdminEtatBooleenProps): React.ReactElement {
  const Icone = actif ? Check : X;
  const libelle = actif ? libelles.vrai : libelles.faux;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full",
        actif
          ? "bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]"
          : "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-fg-muted)]",
        className,
      )}
      title={libelle}
    >
      <Icone size={12} aria-hidden="true" />
      <span className="sr-only">{libelle}</span>
    </span>
  );
}
