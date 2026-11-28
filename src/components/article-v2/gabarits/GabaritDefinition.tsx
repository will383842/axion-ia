/**
 * Gabarit « Définition » (G6) : la mise en page de lecture commune, plus
 *  - le sommaire masqué sous 4 entrées (un article court se lit d'un trait) ;
 *  - « Termes liés » en pastilles : les étiquettes de l'article qui existent au glossaire,
 *    jamais un terme deviné ;
 *  - un encart du milieu dont le bouton est le Diagnostic IA et le lien « Le glossaire complet ».
 * Prononciation, sigle développé et « À ne pas confondre avec » n'existent pas comme données
 * de l'article : ils ne sont pas inventés. Composant serveur, zéro JavaScript.
 */
import "@/styles/article-v2/definition.css";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getGlossaryTermBySlug } from "@/content/glossary-extension";
import { slugify } from "@/lib/slug";
import { ROUTES } from "@/lib/routes";
import type { ArticleGabaritProps } from "../types";
import { MiseEnPageAnalyse } from "./GabaritAnalyse";

const SOMMAIRE_MIN = 4;
const TERMES_MAX = 6;

export function GabaritDefinition(p: ArticleGabaritProps) {
  const t = useTranslations("articleGabarits.definition");
  const vus = new Set<string>();
  const termes = (p.view.tags ?? []).flatMap((tag) => {
    const terme = getGlossaryTermBySlug(slugify(tag));
    if (!terme || vus.has(terme.slug)) return [];
    vus.add(terme.slug);
    return [terme];
  });
  const lies = termes.slice(0, TERMES_MAX);

  const adapte: ArticleGabaritProps = p.tocItems.length < SOMMAIRE_MIN ? { ...p, tocItems: [] } : p;

  const extra =
    lies.length > 0 ? (
      <nav className="termes-lies" aria-label={t("termesLies")}>
        <p className="termes-lies__titre">{t("termesLies")}</p>
        <ul>
          {lies.map((x) => (
            <li key={x.slug}>
              <Link className="pastille" href={`${ROUTES.glossary}/${x.slug}` as never}>
                {x.term}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    ) : null;

  return (
    <MiseEnPageAnalyse
      p={adapte}
      cta="diagnostic"
      ctaSecondaire={{ href: ROUTES.glossary, libelle: t("glossaireComplet"), code: "glossaire" }}
      ouvertureExtra={extra}
    />
  );
}
