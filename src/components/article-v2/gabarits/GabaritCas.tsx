/**
 * Gabarit « Étude de cas » (G5) : la mise en page de lecture commune, plus, dans l'ouverture,
 * une fiche « Contexte » en carte mocha alimentée UNIQUEMENT par des métadonnées existantes
 * (catégorie, ville ancrée) et le tampon « Exemple type, pas un client ».
 *
 * Aucun chiffre, aucun résultat chiffré, aucun témoignage n'est produit ici. La frise
 * Avant / Pendant / Après et « Ce que l'équipe a appris » du plan n'existent pas comme
 * données de l'article : elles ne sont pas inventées (voir la fiche de PR).
 * Composant serveur, zéro JavaScript.
 */
import "@/styles/article-v2/cas.css";
import { useTranslations } from "next-intl";
import type { ArticleGabaritProps } from "../types";
import { FicheContexte } from "../FicheContexte";
import { MiseEnPageAnalyse } from "./GabaritAnalyse";

export function GabaritCas(p: ArticleGabaritProps) {
  const t = useTranslations("articleGabarits.cas");
  const extra = (
    <div className="cas-fiche">
      <p className="cas-fiche__tampon">{t("tampon")}</p>
      <FicheContexte
        lignes={[
          { libelle: t("categorie"), valeur: p.view.category },
          { libelle: t("ville"), valeur: p.villeAncree?.nom },
        ]}
      />
      <p className="cas-fiche__note">{t("note")}</p>
    </div>
  );
  return <MiseEnPageAnalyse p={p} cta="journee" ouvertureExtra={extra} />;
}
