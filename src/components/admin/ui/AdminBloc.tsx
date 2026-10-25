// Bloc coloré du socle « dossier » (D0, PLAN-DESIGN-CLIENTS).
//
// Un encadré dont la teinte PORTE UN SENS (à faire, chiffres, fait, argent ou
// échéance, recherche, pause ou note) — mais jamais seule : le titre dit
// toujours la chose en toutes lettres. Règle : 3 teintes au plus par écran,
// listes de travail sur fond blanc. Composant serveur, aucun JavaScript client.
//
// Les couleurs viennent de `admin.css` (`.admin-bloc--{teinte}`), dans la couche
// `admin-dossier` déclarée après `utilities` : ne pas poser d'utilitaire Tailwind
// de fond, de bordure, de marge ou de rayon via `className`, il serait sans effet.
// L'espacement entre blocs se règle dans le parent.

import { cn } from "@/lib/utils";

export type AdminBlocTeinte = "terracotta" | "bleu" | "vert" | "ambre" | "violet" | "gris";

const TEINTE_CLASS: Record<AdminBlocTeinte, string> = {
  terracotta: "admin-bloc--terracotta",
  bleu: "admin-bloc--bleu",
  vert: "admin-bloc--vert",
  ambre: "admin-bloc--ambre",
  violet: "admin-bloc--violet",
  gris: "admin-bloc--gris",
};

interface AdminBlocProps {
  children: React.ReactNode;
  teinte: AdminBlocTeinte;
  /** Titre du bloc : obligatoire, car la couleur ne doit jamais porter seule le sens. */
  titre: React.ReactNode;
  /** Niveau du titre (défaut 2). */
  niveau?: 2 | 3 | 4;
  /** Liseré épais en haut du bloc. */
  haut?: boolean;
  className?: string;
  id?: string;
}

export function AdminBloc({
  children,
  teinte,
  titre,
  niveau = 2,
  haut = false,
  className,
  id,
}: AdminBlocProps): React.ReactElement {
  const Titre = `h${niveau}` as "h2" | "h3" | "h4";
  return (
    <section
      {...(id ? { id } : {})}
      data-teinte={teinte}
      className={cn("admin-bloc", TEINTE_CLASS[teinte], haut && "admin-bloc--haut", className)}
    >
      <Titre className="admin-bloc-titre">{titre}</Titre>
      {children}
    </section>
  );
}
