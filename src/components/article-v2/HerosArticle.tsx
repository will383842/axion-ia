import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { GabaritPage } from "@/lib/blog/photos-repli";

interface HerosArticleProps {
  readonly gabarit: GabaritPage;
  readonly categorie: string;
  readonly titre: { readonly lead: string; readonly em?: string | undefined };
  readonly chapo: string | null;
  readonly auteur: string;
  readonly auteurHref: string;
  readonly publieLe: string;
  readonly misAJourLe: string | null;
  readonly tempsLecture: string | null;
  readonly pageUrl: string;
  readonly titreArticle: string;
  /** Texte de la pastille « type » (défaut : celui du gabarit, dans `commun`). */
  readonly surtitreType?: string;
  /**
   * Signe du gabarit (décor `aria-hidden`). Absent : celui de `commun` pour les huit gabarits
   * du blog. `null` : aucun signe.
   */
  readonly signe?: { readonly grand: string; readonly legende: string } | null;
  /** Date de publication déjà formatée (défaut : la valeur brute de `publieLe`). */
  readonly publieLisible?: string;
  /** Date de mise à jour déjà formatée (défaut : la valeur brute de `misAJourLe`). */
  readonly misAJourLisible?: string;
}

/**
 * `header.heros.sur-terracotta` (socle, section 07) : le grand titre de l'article, sur
 * l'aplat terracotta de la charte. N'est PAS l'en-tête du site (celui-ci vient du layout,
 * `Header`) : ni `<main>` ni `header[data-tone]` ici. Composant serveur, zéro JS.
 * Pied : partage en liens natifs à gauche, signe du gabarit (décor `aria-hidden`) à droite.
 */
export function HerosArticle({
  gabarit,
  categorie,
  titre,
  chapo,
  auteur,
  auteurHref,
  publieLe,
  misAJourLe,
  tempsLecture,
  pageUrl,
  titreArticle,
  surtitreType,
  signe,
  publieLisible,
  misAJourLisible,
}: HerosArticleProps) {
  const c = useTranslations("articleGabarits.commun");
  const modifie = misAJourLe && misAJourLe !== publieLe ? misAJourLe : null;
  const signeAffiche =
    signe !== undefined
      ? signe
      : { grand: c(`signe.${gabarit}.grand`), legende: c(`signe.${gabarit}.legende`) };
  const url = encodeURIComponent(pageUrl);
  const partages = [
    {
      id: "linkedin",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      label: c("partagerSur", { reseau: "LinkedIn" }),
    },
    {
      id: "x",
      href: `https://twitter.com/intent/tweet?url=${url}`,
      label: c("partagerSur", { reseau: "X" }),
    },
    {
      id: "mail",
      href: `mailto:?subject=${encodeURIComponent(titreArticle)}&body=${url}`,
      label: c("partagerMail"),
    },
  ];
  return (
    <header className="heros sur-terracotta">
      <ul className="surtitre" aria-label={c("typeEtCategorie")}>
        <li className="pastille pastille--pleine">{surtitreType ?? c(`surtitre.${gabarit}`)}</li>
        <li className="pastille pastille--contour">{categorie}</li>
      </ul>
      <h1>
        {titre.lead}
        {titre.em ? (
          <>
            {" "}
            <em>{titre.em}</em>
          </>
        ) : null}
      </h1>
      {chapo ? <p className="chapo">{chapo}</p> : null}
      <ul className="meta">
        <li>
          <span className="avatar" aria-hidden="true">
            {auteur.slice(0, 1).toUpperCase()}
          </span>
          <span>
            {c("par")}{" "}
            <Link href={auteurHref as never} rel="author">
              {auteur}
            </Link>
          </span>
        </li>
        <li>
          <time dateTime={publieLe}>
            {c("publieLe")} {publieLisible ?? publieLe}
          </time>
        </li>
        {modifie ? (
          <li data-aeo="freshness">
            <time dateTime={modifie}>
              {c("misAJourLe")} {misAJourLisible ?? modifie}
            </time>
          </li>
        ) : null}
        {tempsLecture ? <li className="meta__lecture">{tempsLecture}</li> : null}
      </ul>
      <div className="heros__pied">
        <ul className="partage-icones" aria-label={c("partager")}>
          {partages.map((p) => (
            <li key={p.id}>
              <a href={p.href} aria-label={p.label} rel="noopener noreferrer">
                <span aria-hidden="true">{p.id === "mail" ? "@" : p.id === "x" ? "X" : "in"}</span>
              </a>
            </li>
          ))}
        </ul>
        {signeAffiche ? (
          <div className={`heros__signe signe--${gabarit}`} aria-hidden="true">
            <span className="signe__grand">{signeAffiche.grand}</span>
            <span className="signe__legende">{signeAffiche.legende}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
