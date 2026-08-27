/**
 * Catalogue des livres publiés par Axion-IA — SSOT de la route `/livres`.
 *
 * **D'où viennent ces données.** Elles sont RECOPIÉES du paquet web produit par BookForge
 * (`exports/<bookId>/<edition>/paquet-web/`), qui les fabrique à partir du manuscrit lui-même :
 * `metadonnees.json` pour l'identité et le JSON-LD, `textes.md` pour l'accroche et le résumé,
 * `extrait-preambule.md` / `extrait-essentiel.md` pour les extraits, les six jaquettes pour
 * les images. Rien n'est réécrit ici : une page produit qui paraphrase son livre finit par
 * mentir sur lui.
 *
 * **Pourquoi un module de contenu et pas la base.** Même arbitrage que la fiche fondateur
 * (`lib/seo/williams-person.ts`) : le catalogue est minuscule, il change à chaque édition —
 * c'est-à-dire quelques fois par an — et il doit fonctionner dès le déploiement, sans seed.
 *
 * **L'état de publication commande la page**, et c'est le cœur de ce module. Tant que
 * `publication.amazonUrl` est `null`, le livre n'est pas achetable : la fiche existe, elle
 * est complète, mais elle sort de l'index et du sitemap, et n'affiche aucun bouton d'achat.
 * Une page produit sans destination d'achat est une page mince — Google la traite comme
 * telle, et le lecteur s'en va. Renseigner `asin` + `amazonUrl` suffit à basculer la page
 * entière en état publié : aucune autre ligne de code à toucher.
 */

import { FOUNDER, FOUNDER_PERSON_ID } from "@/lib/brand";

/** Une jaquette, dans ses deux formats modernes. Dimensions RÉELLES du fichier. */
export interface JaquetteLivre {
  readonly avif: string;
  readonly webp: string;
  readonly width: number;
  readonly height: number;
}

export interface Livre {
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string;
  /** Langue du livre (BCP-47 court) — la fiche n'existe que dans cette langue. */
  readonly language: "fr";
  readonly editionLabel: string;
  readonly publisher: string;
  /** Nombre de pages du broché — `null` tant que l'édition n'est pas figée. */
  readonly pageCount: number | null;

  /**
   * L'auteur, et surtout SON `@id`.
   *
   * `personId` n'est pas décoratif : c'est ce qui rattache le livre à l'entité `Person` du
   * site plutôt que d'en créer une nouvelle. Pour les livres signés du fondateur, c'est la
   * constante canonique. Un livre signé d'un autre nom de plume portera SON identifiant —
   * jamais celui du fondateur, sous peine de fusionner deux auteurs distincts.
   */
  readonly author: {
    readonly name: string;
    readonly personId: string;
    /** Page d'autorité de l'auteur sur le site, si elle existe. */
    readonly url: string | null;
  };

  /** Accroche ≤ 150 mots — LA MÊME que la 4e de couverture. */
  readonly hook: string;
  /** Résumé long (150–250 mots), en paragraphes. */
  readonly summary: readonly string[];
  /** Bio auteur courte, telle qu'imprimée dans le livre. */
  readonly authorBio: string;
  /** Extraits citables — ce qui rend la page indexable autrement qu'en vitrine. */
  readonly excerpts: readonly { readonly title: string; readonly body: readonly string[] }[];

  readonly jackets: {
    readonly product: JaquetteLivre;
    readonly card: JaquetteLivre;
    readonly thumb: JaquetteLivre;
  };
  readonly coverAlt: string;

  /**
   * Retour de publication — VIDE à la fabrication, et c'est normal (docs/15 §2 bis de
   * BookForge). Amazon n'attribue l'ASIN qu'à la mise en ligne.
   */
  readonly publication: {
    readonly asin: string | null;
    readonly amazonUrl: string | null;
    readonly printIsbn: string | null;
    /** Date de mise en vente réelle, ISO. `null` = pas encore publié. */
    readonly datePublished: string | null;
  };

  readonly categories: readonly string[];
}

const LE_SECOND: Livre = {
  slug: "le-second",
  title: "Le Second",
  subtitle: "L'employé IA qui ne dort jamais",
  language: "fr",
  editionLabel: "1.3",
  publisher: "SAS AXION-IA",
  pageCount: 118,

  author: {
    name: FOUNDER.fullName,
    personId: FOUNDER_PERSON_ID,
    url: `/${FOUNDER.pageLocale}${FOUNDER.pagePath}`,
  },

  hook: "On ne configure pas un second. On le recrute.",
  summary: [
    "Vous avez déjà demandé un résumé de compte rendu à un assistant. Le résultat était correct, et tiède. Vous en avez conclu que l'outil manquait de finesse. Il manquait surtout un mandat.",
    "Ce guide part d'une idée simple : votre second se recrute avant de s'outiller. Vous savez écrire une annonce de poste — la mission, les livrables, ce qui n'entre pas dans le poste. Le mandat reprend ce geste, en quatre rubriques, sur une seule page.",
    "La méthode suit l'ordre du travail réel. Vous triez votre semaine et retenez les tâches qui reviennent à l'identique : la revue de pipeline, la préparation du comité, la note au conseil. Vous écrivez le mandat. Vous posez vos cinq lignes de ligne rouge, triées par votre exposition personnelle. Vous menez la revue de sortie en trois passes, contre des critères écrits d'avance, parce que relire au jugement du jour ne mesure rien. Vous convertissez l'écart constaté en une ligne de recadrage. Vous datez, vous inscrivez la revue à l'agenda, vous arbitrez : étendre, maintenir, retirer.",
    "Le périmètre s'arrête à votre premier cercle. Le déploiement à l'échelle de l'entreprise, le comparatif des solutions du marché et l'intégration au système d'information restent dehors, et c'est annoncé dès l'introduction.",
    "Neuf chapitres, neuf gestes. Le premier se pose lundi matin.",
  ],
  authorBio:
    "Williams Jullin est le fondateur et CEO d'Axion-IA.com, cabinet de conseil en intelligence artificielle pour les PME, ETI et grands groupes français : audit, formation, implémentation et conduite du changement. Ce livre part de ce terrain — l'installation d'un assistant permanent, un « second », dans le quotidien d'une direction. Mandat, périmètre, contrôle des rendus : il reste sur le travail du dirigeant et de son premier cercle.",

  excerpts: [
    {
      title: "Ce que le livre couvre, et ce qu'il laisse dehors",
      body: [
        "Le sujet n'est pas l'intelligence artificielle en général, ni la transformation d'une entreprise : c'est l'installation d'un assistant permanent, un « second », dans le quotidien d'une direction.",
        "Quelle tâche lui confier, comment écrire son mandat, comment contrôler ce qu'il rend, où s'arrête son périmètre. Le livre reste sur le travail personnel du dirigeant et de son premier cercle. Il ne traite ni le déploiement à l'échelle de l'entreprise, ni le choix entre solutions du marché, ni l'intégration au système d'information.",
      ],
    },
  ],

  jackets: {
    product: {
      avif: "/livres/le-second/jaquette-produit.avif",
      webp: "/livres/le-second/jaquette-produit.webp",
      width: 960,
      height: 1536,
    },
    card: {
      avif: "/livres/le-second/jaquette-carte.avif",
      webp: "/livres/le-second/jaquette-carte.webp",
      width: 480,
      height: 768,
    },
    thumb: {
      avif: "/livres/le-second/jaquette-vignette.avif",
      webp: "/livres/le-second/jaquette-vignette.webp",
      width: 160,
      height: 256,
    },
  },
  coverAlt:
    "Couverture du livre « Le Second — L'employé IA qui ne dort jamais », de Williams Jullin",

  publication: {
    asin: null,
    amazonUrl: null,
    printIsbn: null,
    datePublished: null,
  },

  categories: ["Management et leadership", "PME et TPE", "Efficacité professionnelle"],
};

export const LIVRES: readonly Livre[] = [LE_SECOND];

/**
 * Un livre est PUBLIÉ quand il est achetable, pas quand il est fabriqué.
 *
 * Le critère est l'URL Amazon, pas l'ASIN : un ASIN attribué sans fiche en ligne ne donne au
 * lecteur aucun endroit où aller, et c'est le lecteur qui décide si une page produit vaut
 * d'être indexée.
 */
export function estPublie(livre: Livre): boolean {
  return livre.publication.amazonUrl !== null;
}

export function livreParSlug(slug: string): Livre | undefined {
  return LIVRES.find((livre) => livre.slug === slug);
}

/** Les seuls livres qui entrent dans l'index et le sitemap. */
export function livresPublies(): readonly Livre[] {
  return LIVRES.filter(estPublie);
}
