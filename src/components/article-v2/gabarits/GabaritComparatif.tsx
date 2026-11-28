/**
 * Gabarit « Comparatif » (M-G3) : la mise en page de lecture commune, plus
 *  - la phrase de neutralité, puis le face-à-face A / « ou » / B tiré du titre ;
 *  - le premier tableau du corps remonté dans l'ouverture (« Tableau récapitulatif »,
 *    entrée du sommaire), retiré du corps pour ne pas le doubler ; coches en CSS, le texte
 *    « Oui » / « Non » / « Partiel » reste dans le DOM ;
 *  - un encart du milieu dont le bouton est le Diagnostic IA et le lien « Écrire un message ».
 * Aucun gagnant, aucune note, aucun prix. Composant serveur, zéro JavaScript.
 */
import "@/styles/article-v2/comparatif.css";
import { useTranslations } from "next-intl";
import { extraireDuel, marquerCellules, remonterPremierTableau } from "@/lib/blog/comparatif";
import type { ArticleGabaritProps } from "../types";
import { MiseEnPageAnalyse } from "./GabaritAnalyse";

const ANCRE_DE_BASE = "tableau-recapitulatif";

/** Première ancre libre : un H2 « Tableau récapitulatif » du corps porte déjà la base. */
function ancreLibre(html: string | null, pris: ReadonlyArray<{ anchor: string }>): string {
  const utilisee = (a: string) =>
    pris.some((i) => i.anchor === a) ||
    (html ?? "").includes(`id="${a}"`) ||
    (html ?? "").includes(`id='${a}'`);
  let n = 1;
  let ancre = ANCRE_DE_BASE;
  while (utilisee(ancre) || utilisee(`${ancre}-titre`)) {
    n += 1;
    ancre = `${ANCRE_DE_BASE}-${n}`;
  }
  return ancre;
}

export function GabaritComparatif(p: ArticleGabaritProps) {
  const t = useTranslations("articleGabarits.comparatif");
  const duel = extraireDuel(p.view.title);
  const extrait = p.html ? remonterPremierTableau(p.html) : null;
  const ANCRE_TABLEAU = ancreLibre(p.html, p.tocItems);

  const adapte: ArticleGabaritProps = extrait
    ? {
        ...p,
        html: extrait.reste,
        tocItems: [{ anchor: ANCRE_TABLEAU, title: t("tableau.titre"), level: 2 }, ...p.tocItems],
      }
    : p;

  const extra = (
    <>
      <p className="neutralite" data-aeo="neutrality">
        <span>
          <strong>{t("neutralite.methode")}</strong> {t("neutralite.texte")}
        </span>
      </p>
      {duel ? (
        <div className="duel" role="group" aria-label={t("duel.aria")}>
          <p className="duel__cote">
            <span className="duel__lettre" aria-hidden="true">
              A
            </span>
            <span className="duel__nom">{duel.a}</span>
          </p>
          <p className="duel__ou" aria-hidden="true">
            {t("duel.ou")}
          </p>
          <p className="duel__cote duel__cote--b">
            <span className="duel__lettre" aria-hidden="true">
              B
            </span>
            <span className="duel__nom">{duel.b}</span>
          </p>
        </div>
      ) : null}
      {extrait ? (
        <section id={ANCRE_TABLEAU}>
          <h2 id={`${ANCRE_TABLEAU}-titre`}>{t("tableau.titre")}</h2>
          <div className="tableau comparo">
            <div
              className="tableau__defilant"
              role="region"
              tabIndex={0}
              aria-labelledby={`${ANCRE_TABLEAU}-titre`}
              dangerouslySetInnerHTML={{ __html: marquerCellules(extrait.tableau) }}
            />
            <p className="tableau__note">{t("tableau.note")}</p>
          </div>
        </section>
      ) : null}
    </>
  );

  return (
    <MiseEnPageAnalyse p={adapte} cta="diagnostic" ctaSecondaire="message" ouvertureExtra={extra} />
  );
}
