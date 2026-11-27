import { CATEGORIES } from "@/lib/equipe";
import type { Categorie } from "@/lib/equipe";
import { jetonsDe, varCss } from "./couleurs-categorie";
import { FormeCategorie } from "./FormeCategorie";

/** Forme + couleur + libellé : jamais la couleur seule. */
export function PastilleCategorie({
  categorie,
  pluriel = false,
  className,
}: {
  categorie: Categorie;
  pluriel?: boolean;
  className?: string;
}) {
  const def = CATEGORIES[categorie];
  const j = jetonsDe(categorie);
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase${className ? ` ${className}` : ""}`}
      style={{ color: varCss(j.fort) }}
    >
      <FormeCategorie forme={def.forme} couleur={varCss(j.forme)} />
      {pluriel ? def.libellePluriel : def.libelleSingulier}
    </span>
  );
}
