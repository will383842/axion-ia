import { useTranslations } from "next-intl";

export interface LigneContexte {
  readonly libelle: string;
  readonly valeur: string | null | undefined;
}

interface FicheContexteProps {
  readonly lignes: ReadonlyArray<LigneContexte>;
}

/**
 * Fiche « Contexte » (étude de cas) alimentée UNIQUEMENT par des métadonnées
 * existantes ; une ligne sans valeur est omise, une fiche vide n'est pas rendue.
 * Aucun chiffre n'est produit ici.
 */
export function FicheContexte({ lignes }: FicheContexteProps) {
  const t = useTranslations("articleGabarits.commun");
  const presentes = lignes.filter((l) => (l.valeur ?? "").trim().length > 0);
  if (presentes.length === 0) return null;
  return (
    <section className="art-encadre" aria-labelledby="fiche-contexte">
      <p id="fiche-contexte" className="art-encadre-titre">
        {t("contexte")}
      </p>
      <dl className="art-fiche">
        {presentes.map((l) => (
          <div key={l.libelle}>
            <dt>{l.libelle}</dt>
            <dd>{l.valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
