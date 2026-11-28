/**
 * JSON-LD des fiches « équipe » — un seul `@graph` par page.
 *
 * Deux régimes :
 *  - le dirigeant principal (Williams) DÉLÈGUE à `williams-person.ts`. Son `@id`,
 *    son `sameAs`, son nom et son image y sont posés une fois pour toutes ; les
 *    redécrire ici ferait deux sources pour la même entité. `founderUrl()` et
 *    `FOUNDER_PERSON_ID` restent la source unique ;
 *  - tout autre collaborateur : nœud bâti depuis la fiche PUBLIQUE, jamais la
 *    brute. Le nom de famille n'y paraît nulle part (`name` = prénom, ni
 *    `familyName`, ni `givenName` redondant).
 *
 * Aucun prix, aucune rue, aucun code postal.
 */

import { BRAND } from "@/lib/brand";
import { SITE_URL, buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import {
  buildPersonWilliamsJsonLd,
  buildProfilePageWilliamsJsonLd,
} from "@/lib/seo/williams-person";
import { CATEGORIES, SLUG_DIRIGEANT_PRINCIPAL } from "@/lib/equipe";
import type { ContenuFiche, FichePublique } from "@/lib/equipe";

type Noeud = Record<string, unknown>;

const ORGANISATION = { "@id": `${SITE_URL}/#organization` } as const;

function estWilliams(fiche: Pick<FichePublique, "slug" | "estDirigeantPrincipal">): boolean {
  return fiche.estDirigeantPrincipal && fiche.slug === SLUG_DIRIGEANT_PRINCIPAL;
}

/** URL absolue de la fiche (FR uniquement : la route 404 hors FR). */
export function urlFiche(slug: string): string {
  return `${BRAND.url}/fr/equipe/${slug}`;
}

export function idPersonne(slug: string): string {
  return `${urlFiche(slug)}#person`;
}

function nonVide(valeur: string | undefined | null): valeur is string {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

/** Nœud Person d'un collaborateur. */
export function buildPersonCollaborateurJsonLd(fiche: FichePublique, contenu: ContenuFiche): Noeud {
  if (estWilliams(fiche)) return buildPersonWilliamsJsonLd("fr");
  const url = urlFiche(fiche.slug);
  const categorie = CATEGORIES[fiche.categorie];
  const lieu = fiche.ville ?? undefined;
  // Une URL de profil contient souvent le nom de famille : jamais reprise pour un autre que le dirigeant.
  const sameAs: string[] = [];
  void contenu;
  const noeud: Noeud = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": idPersonne(fiche.slug),
    name: fiche.nom,
    ...(nonVide(fiche.fonction) ? { jobTitle: fiche.fonction } : {}),
    ...(nonVide(fiche.reponseQui) ? { description: fiche.reponseQui } : {}),
    disambiguatingDescription: `${fiche.fonction || categorie.libelleSingulier} chez ${BRAND.name} (${categorie.libelleSingulier})`,
    url,
    mainEntityOfPage: { "@id": `${url}#profilepage` },
    ...(fiche.photo
      ? {
          image: {
            "@type": "ImageObject",
            "@id": `${url}#portrait`,
            url: `${SITE_URL}${fiche.photo.src}`,
            contentUrl: `${SITE_URL}${fiche.photo.src}`,
            width: fiche.photo.largeur,
            height: fiche.photo.hauteur,
          },
        }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    // Un partenaire est affilié à l'organisation, il n'y travaille pas.
    ...(fiche.categorie === "partenaire"
      ? { affiliation: ORGANISATION }
      : { worksFor: ORGANISATION }),
    ...(lieu
      ? {
          workLocation: {
            "@type": "Place",
            name: lieu,
            address: { "@type": "PostalAddress", addressLocality: lieu, addressCountry: "FR" },
          },
        }
      : {}),
  };
  return noeud;
}

/** `ProfilePage` : « cette URL EST la page de cette personne ». */
export function buildProfilePageCollaborateurJsonLd(
  fiche: FichePublique,
  contenu: ContenuFiche,
): Noeud {
  if (estWilliams(fiche)) return buildProfilePageWilliamsJsonLd();
  const url = urlFiche(fiche.slug);
  const id = { "@id": idPersonne(fiche.slug) };
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${url}#profilepage`,
    url,
    inLanguage: "fr",
    name: `${fiche.nom}${fiche.fonction ? ` — ${fiche.fonction}` : ""}`,
    ...(nonVide(fiche.reponseQui) ? { description: fiche.reponseQui } : {}),
    dateModified: contenu.dateMiseAJour,
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    about: id,
    mainEntity: id,
    ...(fiche.photo ? { primaryImageOfPage: { "@id": `${url}#portrait` } } : {}),
    breadcrumb: { "@id": `${url}#breadcrumb` },
    publisher: ORGANISATION,
    speakable: buildSpeakableSpecification(),
  };
}

/** Fil d'ariane : Accueil > Équipe > {nom}. */
export function buildBreadcrumbCollaborateurJsonLd(fiche: Pick<FichePublique, "slug" | "nom">) {
  return buildBreadcrumbJsonLd({
    locale: "fr",
    items: [
      { name: "Accueil", href: "/" },
      { name: "Équipe", href: "/equipe" },
      { name: fiche.nom, href: `/equipe/${fiche.slug}` },
    ],
  }) as unknown as Noeud;
}

/**
 * Le `@graph` complet d'une fiche : Person, ProfilePage, BreadcrumbList et,
 * seulement si la fiche est indexable, FAQPage (auteur = la personne de la fiche).
 */
export function buildGrapheCollaborateur(
  fiche: FichePublique,
  contenu: ContenuFiche,
  { indexable }: { indexable: boolean },
): ReadonlyArray<Noeud> {
  const faq = contenu.faq;
  return [
    buildPersonCollaborateurJsonLd(fiche, contenu),
    buildProfilePageCollaborateurJsonLd(fiche, contenu),
    buildBreadcrumbCollaborateurJsonLd(fiche),
    ...(indexable && faq.length > 0
      ? [
          buildFaqJsonLd({
            items: faq.map((q) => ({ question: q.question, answer: q.answer })),
            authorId: idPersonne(fiche.slug),
            dateModified: contenu.dateMiseAJour,
          }) as unknown as Noeud,
        ]
      : []),
  ];
}
