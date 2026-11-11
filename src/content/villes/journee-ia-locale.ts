// La Journée IA, ville par ville et région par région : les textes et les métadonnées
// des pages `/fr/implantations/**`, construits à UN seul endroit et testés sur toutes
// les villes (`__tests__/journee-ia-locale.spec.ts`).
//
// Règles (audit SEO/GEO du 2026-11-11) :
//   - une seule offre : La Journée IA. Les textes communs viennent de
//     `@/content/journee-ia-commun` (prix = jeton `{{PRIX}}`, garantie mot pour mot) ;
//   - aucune fausse présence locale : nous n'avons pas de bureau dans chaque ville, nous
//     venons dans les locaux de l'entreprise. Les textes le disent ;
//   - le contexte local ne vient QUE des données déjà présentes (population INSEE,
//     département, région, secteurs vérifiés ou rédigés) : rien n'est inventé ;
//   - aucun code INSEE dans un texte visible ;
//   - title ≤ 60 caractères TELS QUE SERVIS (la marque est incluse, le gabarit du layout
//     ne rajoute donc rien), description ≤ 155, uniques par ville.
//
// Ce module n'importe PAS `@/content/villes` (29 Mo de contenu éditorial) : il ne
// consomme que des champs structurels, passés par l'appelant.

import { DEPARTEMENTS } from "@/lib/commercial-application/model";
import { VILLES_CORE } from "./core";
import {
  CHEMIN_JOURNEE_IA,
  CONDITION_GARANTIE,
  GARANTIE_PHRASE,
  lienDiagnostic,
  RAPPORT_COMPLET,
  remplacerJetons,
} from "@/content/journee-ia-commun";

/** Longueur maximale d'un `<title>` servi. */
export const TITRE_MAX = 60;
/** Longueur maximale d'une meta description. */
export const DESCRIPTION_MAX = 155;

/** Chemin (sans locale) de la landing La Journée IA : source unique dans journee-ia-commun. */
export { CHEMIN_JOURNEE_IA };

/** Date de la refonte « Journée IA » des pages implantations (`WebPage.dateModified`). */
export const DATE_MAJ_IMPLANTATIONS = "2026-11-11";

const MARQUE = " · Axion-IA";

/** Les champs d'une ville dont ce module a besoin. */
export interface VilleLocale {
  readonly slug: string;
  readonly nameFr: string;
  readonly region: string;
  readonly departement: string;
  readonly departementLabel?: string;
  readonly population: number;
}

/** Les champs d'une région dont ce module a besoin. */
export interface RegionLocale {
  readonly slug: string;
  readonly nameFr: string;
}

// ─── Lieux : prépositions et départements ───────────────────────────────────

const NOMS_DEPARTEMENTS = new Map(DEPARTEMENTS.map((d) => [d.code, d.nom] as const));

/** Code du département (« 29 », « 2A »), jamais le code INSEE de la commune. */
export function codeDepartement(v: Pick<VilleLocale, "departement" | "departementLabel">): string {
  return v.departementLabel ?? v.departement;
}

/** Nom du département (« Finistère ») ; le code s'il est inconnu. */
export function nomDepartement(v: Pick<VilleLocale, "departement" | "departementLabel">): string {
  const code = codeDepartement(v);
  return NOMS_DEPARTEMENTS.get(code) ?? code;
}

/** « Finistère (29) » — ou « 29 » seul si le nom est inconnu. */
export function libelleDepartement(
  v: Pick<VilleLocale, "departement" | "departementLabel">,
): string {
  const code = codeDepartement(v);
  const nom = NOMS_DEPARTEMENTS.get(code);
  return nom ? `${nom} (${code})` : code;
}

/** « à Brest », « au Havre », « aux Mureaux », « à La Rochelle ». */
export function aVille(nom: string): string {
  if (nom.startsWith("Le ")) return `au ${nom.slice(3)}`;
  if (nom.startsWith("Les ")) return `aux ${nom.slice(4)}`;
  return `à ${nom}`;
}

const PREPOSITIONS_REGION: Readonly<Record<string, string>> = {
  "hauts-de-france": "dans les",
  "pays-de-la-loire": "dans les",
  "grand-est": "dans le",
  "la-reunion": "à",
  mayotte: "à",
};

/** « en Bretagne », « dans les Hauts-de-France », « dans le Grand Est », « à La Réunion ». */
export function enRegion(r: RegionLocale): string {
  return `${PREPOSITIONS_REGION[r.slug] ?? "en"} ${r.nameFr}`;
}

// ─── Titles et descriptions ─────────────────────────────────────────────────

function premierQuiTient(candidats: ReadonlyArray<string>, max: number): string {
  for (const c of candidats) if (c.length <= max) return c;
  // Dernier recours : le plus court, coupé proprement (jamais atteint sur les données).
  const court = [...candidats].sort((a, b) => a.length - b.length)[0] ?? "";
  return court.slice(0, max);
}

/** Noms portés par plusieurs communes (Valence, Saint-Gilles…), calculés sur les données. */
export const NOMS_HOMONYMES: ReadonlySet<string> = (() => {
  const vus = new Set<string>();
  const doubles = new Set<string>();
  for (const v of VILLES_CORE) {
    if (vus.has(v.nameFr)) doubles.add(v.nameFr);
    vus.add(v.nameFr);
  }
  return doubles;
})();

/**
 * Title d'une page ville, TEL QUE SERVI (marque incluse : `buildProductMetadata` le sert en
 * `absolute`, sans le gabarit « %s · Axion-IA » du layout).
 *
 * `homonyme` : vrai quand une autre ville porte le même nom (Valence, Saint-Gilles…) —
 * le code du département est alors ajouté pour garder des titles uniques.
 */
export function titreVille(v: VilleLocale, homonyme = NOMS_HOMONYMES.has(v.nameFr)): string {
  const nom = homonyme ? `${v.nameFr} (${codeDepartement(v)})` : v.nameFr;
  const a = aVille(nom);
  return premierQuiTient(
    [
      `Journée IA ${a} : audit et formation IA${MARQUE}`,
      `Journée IA ${a} : audit et formation${MARQUE}`,
      `La Journée IA ${a}${MARQUE}`,
      `Journée IA ${a}${MARQUE}`,
      `Journée IA ${a}`,
    ],
    TITRE_MAX,
  );
}

/** Meta description d'une page ville (≤ 155, le prix vient du jeton). */
export function descriptionVille(v: VilleLocale): string {
  const a = aVille(v.nameFr);
  const dep = nomDepartement(v);
  const code = codeDepartement(v);
  return premierQuiTient(
    [
      `La Journée IA ${a} (${dep}) : 2 à 4 h d’audit dans vos locaux, vos équipes formées l’après-midi, rapport chiffré sous 3 jours ouvrés. {{PRIX}}.`,
      `La Journée IA ${a} (${code}) : 2 à 4 h d’audit dans vos locaux, vos équipes formées l’après-midi, rapport chiffré sous 3 jours ouvrés. {{PRIX}}.`,
      `Journée IA ${a} (${code}) : audit de 2 à 4 h dans vos locaux, formation de vos équipes, rapport sous 3 jours ouvrés. {{PRIX}}.`,
    ].map(remplacerJetons),
    DESCRIPTION_MAX,
  );
}

/** Title d'une page région, tel que servi. */
export function titreRegion(r: RegionLocale): string {
  const en = enRegion(r);
  return premierQuiTient(
    [
      `La Journée IA ${en} : audit et formation IA${MARQUE}`,
      `Journée IA ${en} : audit et formation IA${MARQUE}`,
      `Journée IA ${en} : audit et formation${MARQUE}`,
      `La Journée IA ${en}${MARQUE}`,
      `Journée IA ${en}`,
    ],
    TITRE_MAX,
  );
}

/** Meta description d'une page région. */
export function descriptionRegion(r: RegionLocale): string {
  const en = enRegion(r);
  return premierQuiTient(
    [
      `La Journée IA ${en}, dans vos locaux : 2 à 4 h d’audit, vos équipes formées l’après-midi, rapport chiffré sous 3 jours ouvrés. {{PRIX}}. Trouvez votre ville.`,
      `La Journée IA ${en}, dans vos locaux : 2 à 4 h d’audit, formation de vos équipes, rapport sous 3 jours ouvrés. {{PRIX}}.`,
      `Journée IA ${en} : audit et formation IA dans vos locaux, rapport sous 3 jours ouvrés. {{PRIX}}.`,
    ].map(remplacerJetons),
    DESCRIPTION_MAX,
  );
}

/** Title du hub `/fr/implantations`, tel que servi. */
export const TITRE_HUB = `La Journée IA partout en France${MARQUE}`;

/** Meta description du hub. */
export function descriptionHub(): string {
  return remplacerJetons(
    "La Journée IA se tient dans vos locaux, partout en France : 2 à 4 h d’audit, vos équipes formées l’après-midi, rapport sous 3 jours ouvrés. {{PRIX}}.",
  );
}

// ─── Textes visibles ────────────────────────────────────────────────────────

/** Le h1 d'une page ville. */
export function h1Ville(v: Pick<VilleLocale, "nameFr">): string {
  return `La Journée IA ${aVille(v.nameFr)} : audit et formation IA dans vos locaux`;
}

/** Le h1 d'une page région. */
export function h1Region(r: RegionLocale): string {
  return `La Journée IA ${enRegion(r)} : audit et formation IA dans vos locaux`;
}

/**
 * Libellés de secteurs nettoyés : sans la parenthèse technique (« (sections G+H+I) »,
 * exemples entre parenthèses) et sans doublon. Trois au plus.
 */
export function secteursLisibles(bruts: ReadonlyArray<string>): ReadonlyArray<string> {
  const vus = new Set<string>();
  const out: string[] = [];
  for (const b of bruts) {
    const propre = b
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!propre) continue;
    const cle = propre.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push(propre.charAt(0).toLowerCase() + propre.slice(1));
    if (out.length === 3) break;
  }
  return out;
}

function enumerer(items: ReadonlyArray<string>): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

function fmtHabitants(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ");
}

/**
 * Les paragraphes du « En bref » d'une ville. Le 1er et le 3e reprennent les textes
 * communs (déroulé, rapport, prix, garantie mot pour mot) ; le 2e porte le contexte local.
 */
export function enBrefVille(
  v: VilleLocale,
  r: RegionLocale,
  secteurs: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const a = aVille(v.nameFr);
  // « Brest compte 142 346 habitants (Finistère (29), Bretagne). » — données INSEE.
  const local: string[] = [
    `${v.nameFr} compte ${fmtHabitants(v.population)} habitants (département ${libelleDepartement(v)}, ${r.nameFr}).`,
  ];
  if (secteurs.length > 0) {
    local.push(
      `Les secteurs les plus présents y sont ${enumerer(secteurs)} : l’audit du matin part de vos tâches réelles, quel que soit votre métier.`,
    );
  }
  local.push(
    `Nous n’avons pas de bureau ${a} : nous venons dans votre entreprise, à la date fixée avec vous.`,
  );
  return [
    `La Journée IA est une journée d’audit et de formation à l’IA que nous menons dans les locaux de votre entreprise ${a}, comme partout en France. Le matin, un audit de 2 à 4 h selon la structuration de l’entreprise cartographie votre entreprise et chiffre vos plus gros gains, en heures et en euros. L’après-midi, vos équipes sont formées 4 heures sur leurs propres dossiers, avec une attestation par participant.`,
    local.join(" "),
    remplacerJetons(`${RAPPORT_COMPLET} Prix : {{PRIX}}. ${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`),
  ];
}

/** La FAQ courte d'une ville : chaque réponse redit ce que la page affiche déjà. */
export function faqVille(v: VilleLocale): ReadonlyArray<{ q: string; a: string }> {
  const a = aVille(v.nameFr);
  return [
    {
      q: `La Journée IA peut-elle se tenir dans nos locaux ${a} ?`,
      a: `Oui. Nous venons dans votre entreprise ${a}, comme partout en France. Nous n’avons pas de bureau sur place : la journée se déroule chez vous, avec vos équipes et vos dossiers, à la date fixée avec vous pendant le diagnostic gratuit de 45 minutes.`,
    },
    {
      q: `Combien coûte la Journée IA ${a} ?`,
      a: remplacerJetons(`La Journée IA coûte {{PRIX}}. ${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`),
    },
    {
      q: "Comment se déroule la journée ?",
      a: "Le matin, un audit de 2 à 4 h selon la structuration de l’entreprise cartographie votre entreprise et chiffre vos plus gros gains, en heures et en euros. L’après-midi, vos équipes sont formées 4 heures sur leurs propres dossiers, avec une attestation par participant.",
    },
    {
      q: "Quand recevons-nous le rapport ?",
      a: RAPPORT_COMPLET,
    },
  ];
}

/** Paragraphe « La Journée IA en {Région} ». */
export function paragrapheRegion(
  r: RegionLocale,
  faits: { communes: number; departements: number; principales: ReadonlyArray<string> },
): string {
  const en = enRegion(r);
  const dont = faits.principales.length > 0 ? `, dont ${enumerer(faits.principales)}` : "";
  const couverture =
    faits.communes > 0
      ? ` Elle se tient dans toutes les communes de la région : ${fmtHabitants(faits.communes)} communes de plus de 5 000 habitants, sur ${faits.departements} département${faits.departements > 1 ? "s" : ""}${dont}.`
      : "";
  return `Nous menons la Journée IA ${en} comme partout en France : dans les locaux de votre entreprise, avec vos équipes et vos dossiers.${couverture} Nous n’avons pas de bureau dans chaque ville : nous venons chez vous, à la date fixée avec vous.`;
}

/** FAQ régionale. */
export function faqRegion(
  r: RegionLocale,
): ReadonlyArray<{ id: string; question: string; answer: string }> {
  const en = enRegion(r);
  return [
    {
      id: "journee-ia-region-lieu",
      question: `La Journée IA est-elle possible ${en} ?`,
      answer: `Oui. Nous menons la Journée IA ${en} comme partout en France, dans les locaux de votre entreprise. La date est fixée avec vous pendant le diagnostic gratuit de 45 minutes.`,
    },
    {
      id: "journee-ia-region-prix",
      question: `Combien coûte la Journée IA ${en} ?`,
      answer: remplacerJetons(
        `La Journée IA coûte {{PRIX}}. ${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`,
      ),
    },
    {
      id: "journee-ia-region-rapport",
      question: "Que recevons-nous après la journée ?",
      answer: RAPPORT_COMPLET,
    },
  ];
}

// ─── Liens ──────────────────────────────────────────────────────────────────

/** Ancres variées vers `/fr/journee-ia` (choisies par ville, de façon stable). */
const ANCRES_JOURNEE_IA = [
  "le déroulé complet de la Journée IA",
  "tout savoir sur la Journée IA",
  "le programme détaillé de la journée",
  "la Journée IA en détail",
  "comment se passe la Journée IA",
] as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deux ancres différentes pour une page (stables d'un rendu à l'autre). */
export function ancresJourneeIa(slug: string): readonly [string, string] {
  const i = hash(slug) % ANCRES_JOURNEE_IA.length;
  const j = (i + 2) % ANCRES_JOURNEE_IA.length;
  return [ANCRES_JOURNEE_IA[i]!, ANCRES_JOURNEE_IA[j]!];
}

/**
 * Lien de prise de rendez-vous (diagnostic gratuit), avec l'emplacement `depuis=`.
 * Source unique : `lienDiagnostic` de journee-ia-commun (paramètre encodé).
 */
export const lienRendezVous = lienDiagnostic;

/** Emplacement `depuis=` d'un CTA de page ville (≤ 60 car., [a-z0-9-]). */
export function depuisVille(slug: string, emplacement: "haut" | "bas" | "faq"): string {
  return `ville-${slug}-${emplacement}`.slice(0, 60).replace(/-+$/, "");
}

/** Emplacement `depuis=` d'un CTA de page région. */
export function depuisRegion(slug: string, emplacement: "haut" | "bas"): string {
  return `region-${slug}-${emplacement}`;
}

/**
 * URL Wikidata de la commune, résolue depuis son article Wikipédia FR
 * (`Special:GoToLinkedPage`). Aucun identifiant Q n'est stocké dans les données : on
 * n'en invente pas. Émise DANS le nœud `City` (jamais sur l'entreprise).
 */
export function wikidataVilleUrl(nomFr: string): string {
  const titre = encodeURIComponent(nomFr.replace(/ /g, "_"));
  return `https://www.wikidata.org/wiki/Special:GoToLinkedPage?site=frwiki&page=${titre}`;
}
