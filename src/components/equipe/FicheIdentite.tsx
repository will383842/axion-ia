import { CATEGORIES } from "@/lib/equipe";
import type { FichePublique } from "@/lib/equipe";

/** Fiche d'identité en liste de définitions : uniquement des faits présents (pas de ligne vide). */
export function FicheIdentite({
  fiche,
  className,
}: {
  fiche: Pick<FichePublique, "nom" | "categorie" | "fonction" | "ville" | "metiers">;
  className?: string;
}) {
  const lignes: Array<[string, string]> = [["Nom", fiche.nom]];
  lignes.push(["Catégorie", CATEGORIES[fiche.categorie].libelleSingulier]);
  if (fiche.fonction) lignes.push(["Fonction", fiche.fonction]);
  if (fiche.ville) lignes.push(["Ville", fiche.ville]);
  if (fiche.metiers && fiche.metiers.length > 0)
    lignes.push(["Métiers", fiche.metiers.map((m) => m.nom).join(", ")]);
  return (
    <dl
      className={`grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[15px]${className ? ` ${className}` : ""}`}
    >
      {lignes.map(([terme, valeur]) => (
        <div key={terme} className="contents">
          <dt className="text-fg-muted font-medium">{terme}</dt>
          <dd className="text-fg">{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}
