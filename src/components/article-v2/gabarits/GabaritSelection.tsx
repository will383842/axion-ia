/**
 * Gabarit « Sélection (top X) » (M-G4) : la mise en page de lecture commune, plus
 *  - la phrase de neutralité ;
 *  - chaque option (`<h2>` du corps) numérotée par un compteur CSS « n sur N » (aucun JS ;
 *    ni FAQ ni sources ; un titre déjà numéroté en texte n'est pas doublé) ;
 *  - un bandeau « Par où commencer ? » à mi-liste ;
 *  - le premier tableau du corps déplacé en fin de liste (« Tableau de synthèse »), sans note ;
 *  - un encart du milieu dont le bouton principal est la Journée IA.
 * Aucune note, aucun classement chiffré, aucun prix. Composant serveur, zéro JavaScript.
 */
import "@/styles/article-v2/selection.css";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { ancreLibre, echapper, extrairePremierTableau, marquerOptions } from "@/lib/blog/selection";
import type { ArticleGabaritProps } from "../types";
import { MiseEnPageAnalyse } from "./GabaritAnalyse";

export function GabaritSelection(p: ArticleGabaritProps) {
  const t = useTranslations("articleGabarits.selection");

  const bandeau = `<aside class="par-ou" aria-labelledby="par-ou-titre"><p class="par-ou__titre" id="par-ou-titre">${echapper(t("bandeau.titre"))}</p><p>${echapper(t("bandeau.texte"))}</p></aside>`;
  const options = p.html
    ? marquerOptions(p.html, { libelleSur: t("sur"), bandeau })
    : { html: p.html, total: 0 };
  const synthese = options.html ? extrairePremierTableau(options.html) : null;
  const ancre = ancreLibre("tableau-de-synthese", p.html, p.tocItems);

  const adapte: ArticleGabaritProps = {
    ...p,
    html: synthese ? synthese.reste : options.html,
    tocItems: synthese
      ? [...p.tocItems, { anchor: ancre, title: t("tableau.titre"), level: 2 }]
      : p.tocItems,
  };

  const style = { "--total-options": options.total } as CSSProperties;
  const apresCorps = (
    <>
      {synthese ? (
        <section id={ancre} className="synthese">
          <h2 id={`${ancre}-titre`}>{t("tableau.titre")}</h2>
          <div className="tableau">
            <div
              className="tableau__defilant"
              role="region"
              tabIndex={0}
              aria-labelledby={`${ancre}-titre`}
              dangerouslySetInnerHTML={{ __html: synthese.tableau }}
            />
          </div>
        </section>
      ) : null}
    </>
  );

  return (
    <MiseEnPageAnalyse
      p={adapte}
      cta="journee"
      ouvertureExtra={
        <p className="neutralite" data-aeo="neutrality">
          <span>
            <strong>{t("neutralite.methode")}</strong> {t("neutralite.texte")}
          </span>
        </p>
      }
      enveloppeCorps={(corps) => (
        <div className="options" style={style}>
          {corps}
        </div>
      )}
      apresCorps={apresCorps}
    />
  );
}
