// Bloc replié par défaut, ouvert par un clic sur son en-tête.
//
// 🔴 POURQUOI (revue visuelle 2026-08-03, décision Will). Les registres
// Réclamations, Veille et Appréciations dépliaient leur formulaire de saisie
// EN PERMANENCE, au-dessus de la liste — qui passait sous le pli. On ouvrait
// donc « Réclamations » sur un formulaire vide, et il fallait faire défiler
// pour savoir ce qui était enregistré. Les autres listes de la console
// (Clients, Stagiaires, Formateurs) font l'inverse depuis toujours : la liste
// d'abord, la saisie derrière un bouton.
//
// `<details>` natif plutôt qu'un état React : l'ouverture survit au rendu
// serveur, fonctionne sans JavaScript, et le navigateur gère déjà le clavier
// et l'accessibilité (`aria-expanded` implicite sur `<summary>`).

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  titre: string;
  children: React.ReactNode;
  /** Ouvert d'emblée — à réserver aux écrans dont la saisie EST le sujet. */
  ouvertParDefaut?: boolean;
  className?: string;
}

export function AdminBlocRepliable({
  titre,
  children,
  ouvertParDefaut = false,
  className,
}: Props): React.ReactElement {
  return (
    <details
      open={ouvertParDefaut}
      className={cn(
        "group rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]",
        "bg-[color:var(--color-admin-surface)]",
        className,
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-[var(--space-admin-3)] select-none",
          "px-[var(--space-admin-5)] py-[var(--space-admin-4)]",
          "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]",
          "rounded-[var(--radius-admin-md)]",
          "transition-colors hover:bg-[color:var(--color-admin-paper-alt)]",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] focus-visible:outline-none",
        )}
      >
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-90"
        />
        {titre}
      </summary>
      <div className="px-[var(--space-admin-5)] pb-[var(--space-admin-5)]">{children}</div>
    </details>
  );
}
