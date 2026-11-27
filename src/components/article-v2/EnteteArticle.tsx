import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

interface EnteteArticleProps {
  readonly surtitre: string;
  readonly titre: { readonly lead: string; readonly em?: string | undefined };
  readonly chapo: string | null;
  readonly auteur: string;
  readonly auteurHref: string;
  readonly publieLe: string;
  readonly misAJourLe: string | null;
  readonly tempsLecture: string;
  /** Image principale (`HeroImageArticle`) : à droite du titre sur ordinateur, dessous sur mobile. */
  readonly media?: ReactNode;
}

/**
 * En-tête commun (PLAN §4.2) : surtitre, h1, chapô, UNE ligne de métadonnées
 * (auteur · publié le · mis à jour le si différent · temps de lecture) avec
 * `<time datetime>`. Remplace le bandeau « Mis à jour » séparé de la V1.
 */
export function EnteteArticle({
  surtitre,
  titre,
  chapo,
  auteur,
  auteurHref,
  publieLe,
  misAJourLe,
  tempsLecture,
  media,
}: EnteteArticleProps) {
  const t = useTranslations("articleV2");
  const modifie = misAJourLe && misAJourLe !== publieLe ? misAJourLe : null;
  return (
    <header className={`art-entete${media ? " art-avec-image" : ""}`}>
      <div>
        <p className="art-surtitre">{surtitre}</p>
        <h1 className="art-h1">
          {titre.lead}
          {titre.em ? (
            <>
              {" "}
              <em>{titre.em}</em>
            </>
          ) : null}
        </h1>
        {chapo ? <p className="art-chapo">{chapo}</p> : null}
        <ul className="art-meta">
          <li>
            <Link href={auteurHref as never}>
              {t("by")} {auteur}
            </Link>
          </li>
          <li>
            {t("publishedOn")} <time dateTime={publieLe}>{publieLe}</time>
          </li>
          {modifie ? (
            <li>
              {t("updatedOn")} <time dateTime={modifie}>{modifie}</time>
            </li>
          ) : null}
          <li>{tempsLecture}</li>
        </ul>
      </div>
      {media ? <div>{media}</div> : null}
    </header>
  );
}
