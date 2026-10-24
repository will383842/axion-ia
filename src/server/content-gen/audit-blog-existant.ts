/**
 * Content Generator — audit de l'EXISTANT du blog : le classement, module PUR.
 *
 * Audit blog/RAG du 24/10/2026, lot L10. Les nouvelles règles (lot L1 : la
 * doctrine bloque sur toute la surface) ne s'appliquent qu'aux contenus à venir.
 * Les articles déjà publiés peuvent en violer plusieurs. Ce module les range
 * par catégorie, à partir des MÊMES motifs que la publication
 * (`@/lib/contenu/interdits-publication`) : une règle, un seul endroit.
 *
 * Ce module ne lit pas la base et n'écrit rien. La page de la console
 * l'appelle avec des lignes déjà chargées (`lecture-audit-blog.ts`) ; le geste
 * éventuel (retirer de Google, archiver) est un clic d'un administrateur sur
 * `demoteArticle` / `archiveArticle`, jamais une exécution en masse.
 *
 * Décisions de Will qui bornent ce module (CONTEXTE-DEJA-FAIT.md) :
 *   - « tout indexable » : aucun plancher de mots ne dé-indexe seul. Les
 *     articles courts et les pages Grenoble sont LISTÉS, sans bouton ;
 *   - jamais de DELETE : seules des actions réversibles sont proposées.
 */

import {
  detecterInterditsSurface,
  normaliserPourControle,
  type CodeInterdit,
  type InterditSurface,
  type OptionsInterdits,
} from "@/lib/contenu/interdits-publication";

export type CategorieAudit =
  | "test-publie"
  | "doctrine-grave"
  | "faux-cas-clients"
  | "avis-signes"
  | "grenoble"
  | "promesses-etiquettes"
  | "tres-courts"
  | "doublons";

/** Ce que la page propose pour une catégorie. */
export type GesteAudit = "archiver" | "retirer-de-google" | "liste-seule";

export interface DescriptionCategorie {
  readonly id: CategorieAudit;
  readonly titre: string;
  readonly explication: string;
  readonly geste: GesteAudit;
}

/** Ordre d'affichage de la page : le plus net d'abord, la décision de Will en dernier. */
export const CATEGORIES_AUDIT: ReadonlyArray<DescriptionCategorie> = [
  {
    id: "test-publie",
    titre: "Article de test publié",
    explication:
      "Article rattaché à une campagne dont le nom contient « test » : il n'aurait jamais dû être en ligne.",
    geste: "archiver",
  },
  {
    id: "doctrine-grave",
    titre: "Qualiopi, CPF, financement, partenariats, statistiques maison",
    explication:
      "Ces contenus affirment ce que le site n'a pas le droit de dire (Qualiopi, CPF, financement à 100 %, OPCO, faux partenariats, statistiques « Axion-IA » inventées, paiement en ligne, TVA).",
    geste: "archiver",
  },
  {
    id: "faux-cas-clients",
    titre: "Faux cas clients et témoignages",
    explication:
      "Fausse preuve sociale : « notre client », cas concret présenté comme réel, citation d'un témoin. À confirmer sur la liste avant tout clic.",
    geste: "archiver",
  },
  {
    id: "avis-signes",
    titre: "Avis d'expert « signés »",
    explication:
      "Citation attribuée à un nom propre. Rien n'est modifié en base : le lot sur les fausses preuves la réaffiche en « Point de vue d'Axion-IA ». Liste seule.",
    geste: "liste-seule",
  },
  {
    id: "promesses-etiquettes",
    titre: "Promesses, « faites-le vous-même », étiquette TPE/PME, texte d'administration",
    explication:
      "Formules interdites par la doctrine. Le geste proposé les sort de Google sans les dépublier, le temps de les réécrire.",
    geste: "retirer-de-google",
  },
  {
    id: "doublons",
    titre: "Quasi-doublons",
    explication:
      "Articles dont l'adresse suit le même modèle (« certification-ia-managers-… », « formation-ia-… ») : ils se concurrencent. Garder le meilleur, sortir les autres de Google.",
    geste: "retirer-de-google",
  },
  {
    id: "grenoble",
    titre: "Pages qui parlent de Grenoble",
    explication:
      "Jamais « Grenoble » dans la communication. Certaines pages se classent peut-être : LISTE SEULE avec le trafic Search Console, la décision est celle de Will.",
    geste: "liste-seule",
  },
  {
    id: "tres-courts",
    titre: "Articles de moins de 500 mots",
    explication:
      "Décision de Will « tout indexable » : aucun plancher n'est appliqué. LISTE SEULE avec le trafic Search Console, pour décider avec les chiffres.",
    geste: "liste-seule",
  },
];

/** Seuil d'affichage de la liste « très courts » (information, jamais une règle d'indexation). */
export const SEUIL_MOTS_COURT = 500;

/** Début d'adresse des familles de quasi-doublons connues (requête R2 du plan). */
export const PREFIXES_DOUBLONS: ReadonlyArray<string> = [
  "certification-ia-managers-",
  "formation-ia-",
];

const CODES_DOCTRINE_GRAVE: ReadonlySet<CodeInterdit> = new Set<CodeInterdit>([
  "qualiopi",
  "cpf",
  "financement-100",
  "financement-public",
  "numero-legal",
  "partenariat",
  "stat-axion",
  "reservation-paiement",
  "tva-non-facturee",
]);

const CODES_FAUX_CAS: ReadonlySet<CodeInterdit> = new Set<CodeInterdit>([
  "temoignage-axion",
  "citation-temoin",
]);

const CODES_PROMESSES: ReadonlySet<CodeInterdit> = new Set<CodeInterdit>([
  "promesse-garantie",
  "faites-le-vous-meme",
  "etiquette-tpe-pme",
  "slogan-recopie",
  "texte-admin",
]);

/** Un article publié, tel que la page le charge. */
export interface EntreeAudit {
  readonly id: string;
  readonly slug: string;
  readonly titre: string;
  readonly indexationTier: "tier_1_indexable" | "tier_2_noindex_follow" | "tier_3_noindex_nofollow";
  readonly isNews: boolean;
  readonly templateVariant: string | null;
  readonly qualityScore: number | null;
  /** Nom de la campagne qui a produit l'article, s'il y en a une. */
  readonly campagneNom: string | null;
  readonly expertNom: string | null;
  readonly expertTexte: string | null;
  /** Nombre de mots du corps (HTML retiré). */
  readonly mots: number;
  /** Surface à contrôler : titre, méta, slug, réponse directe, FAQ, corps… */
  readonly surface: Readonly<Record<string, string | undefined>>;
}

export interface LigneAudit {
  readonly id: string;
  readonly slug: string;
  readonly titre: string;
  readonly indexationTier: EntreeAudit["indexationTier"];
  readonly isNews: boolean;
  readonly templateVariant: string | null;
  readonly mots: number;
  readonly qualityScore: number | null;
  /** Motifs trouvés, avec le champ et un court extrait (4 au plus). */
  readonly constats: ReadonlyArray<{
    readonly code: CodeInterdit;
    readonly champ: string;
    readonly extrait: string;
  }>;
  /** Pour les avis signés : le nom qui signe. */
  readonly signataire: string | null;
  /** Pour les quasi-doublons : la famille (début d'adresse). */
  readonly famille: string | null;
}

export type ResultatAudit = Readonly<Record<CategorieAudit, ReadonlyArray<LigneAudit>>>;

export function compterMots(texteBrut: string): number {
  const sansBalises = texteBrut.replace(/<[^>]*>/g, " ");
  const morceaux = sansBalises.split(/\s+/).filter((m) => m.length > 0);
  return morceaux.length;
}

/** Le nom de campagne dit-il « test » comme mot entier (et non « latest ») ? */
export function campagneDeTest(nom: string | null): boolean {
  if (!nom) return false;
  return /(^|[^a-z0-9])test([^a-z0-9]|$)/.test(normaliserPourControle(nom));
}

function familleDoublon(slug: string): string | null {
  return PREFIXES_DOUBLONS.find((p) => slug.startsWith(p)) ?? null;
}

function slugEvoqueCas(slug: string): boolean {
  return /(^|-)cas-(concret|client)/.test(slug);
}

function resumerConstats(
  constats: ReadonlyArray<InterditSurface>,
  codes: ReadonlySet<CodeInterdit> | null,
): LigneAudit["constats"] {
  const retenus = codes ? constats.filter((c) => codes.has(c.code)) : constats;
  // Un seul constat par code et par champ ; 4 au plus pour garder la page lisible.
  const vus = new Set<string>();
  const sortie: Array<{ code: CodeInterdit; champ: string; extrait: string }> = [];
  for (const c of retenus) {
    const cle = `${c.code}|${c.champ}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push({ code: c.code, champ: c.champ, extrait: c.extrait });
    if (sortie.length >= 4) break;
  }
  return sortie;
}

function ligne(
  e: EntreeAudit,
  constats: LigneAudit["constats"],
  extra?: { signataire?: string | null; famille?: string | null },
): LigneAudit {
  return {
    id: e.id,
    slug: e.slug,
    titre: e.titre,
    indexationTier: e.indexationTier,
    isNews: e.isNews,
    templateVariant: e.templateVariant,
    mots: e.mots,
    qualityScore: e.qualityScore,
    constats,
    signataire: extra?.signataire ?? null,
    famille: extra?.famille ?? null,
  };
}

/**
 * Range les articles dans les catégories. Un article peut figurer dans
 * plusieurs. Les catégories vides restent présentes (liste vide).
 */
export function auditerArticles(
  entrees: ReadonlyArray<EntreeAudit>,
  opts: Pick<OptionsInterdits, "financementPublicAutorise">,
): ResultatAudit {
  const sortie: Record<CategorieAudit, LigneAudit[]> = {
    "test-publie": [],
    "doctrine-grave": [],
    "faux-cas-clients": [],
    "avis-signes": [],
    grenoble: [],
    "promesses-etiquettes": [],
    "tres-courts": [],
    doublons: [],
  };
  const familles = new Map<string, EntreeAudit[]>();

  for (const e of entrees) {
    const constats = detecterInterditsSurface(e.surface, {
      actualite: e.isNews,
      financementPublicAutorise: opts.financementPublicAutorise,
    });

    if (campagneDeTest(e.campagneNom)) sortie["test-publie"].push(ligne(e, []));

    const grave = resumerConstats(constats, CODES_DOCTRINE_GRAVE);
    if (grave.length > 0) sortie["doctrine-grave"].push(ligne(e, grave));

    const fauxCas = resumerConstats(constats, CODES_FAUX_CAS);
    if (fauxCas.length > 0 || slugEvoqueCas(e.slug)) {
      sortie["faux-cas-clients"].push(ligne(e, fauxCas));
    }

    if (e.expertNom && e.expertNom.trim() && e.expertTexte && e.expertTexte.trim()) {
      sortie["avis-signes"].push(ligne(e, [], { signataire: e.expertNom.trim() }));
    }

    const grenoble = resumerConstats(constats, new Set<CodeInterdit>(["grenoble"]));
    if (grenoble.length > 0) sortie.grenoble.push(ligne(e, grenoble));

    const promesses = resumerConstats(constats, CODES_PROMESSES);
    if (promesses.length > 0) sortie["promesses-etiquettes"].push(ligne(e, promesses));

    if (!e.isNews && e.mots < SEUIL_MOTS_COURT) sortie["tres-courts"].push(ligne(e, []));

    const famille = familleDoublon(e.slug);
    if (famille) {
      const groupe = familles.get(famille) ?? [];
      groupe.push(e);
      familles.set(famille, groupe);
    }
  }

  // Une famille d'un seul article n'est pas un doublon.
  for (const [famille, groupe] of familles) {
    if (groupe.length < 2) continue;
    for (const e of groupe) sortie.doublons.push(ligne(e, [], { famille }));
  }

  // Ordre stable et lisible : adresse croissante (les familles restent groupées).
  for (const liste of Object.values(sortie)) {
    liste.sort((a, b) => a.slug.localeCompare(b.slug, "fr"));
  }
  return sortie;
}

/** Le geste « retirer de Google » ne s'applique qu'à un article encore indexable. */
export function peutRetirerDeGoogle(l: Pick<LigneAudit, "indexationTier">): boolean {
  return l.indexationTier === "tier_1_indexable";
}
