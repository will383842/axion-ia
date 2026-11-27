/**
 * Baromètre 2027 : l'IA dans les TPE et PME françaises : SEUL fichier de chiffres.
 *
 * Source : data/barometre-2027/barometre-ia-tpe-pme-v1.md et sources.json
 * (branche data/barometre-2027, vérifié 4 fois). Chiffres repris tels quels :
 * aucun recalcul, aucun arrondi, aucun ajout. La page, le JSON-LD et le test
 * lisent ce fichier ; une correction de chiffre se fait ICI et nulle part ailleurs.
 */

export const BAROMETRE_SLUG = "barometre-ia-tpe-pme-2027";
export const BAROMETRE_PATH = `/ressources/${BAROMETRE_SLUG}`;
export const BAROMETRE_TITRE = "Baromètre 2027 : l'IA dans les TPE et PME françaises";
export const BAROMETRE_DESCRIPTION =
  "40 % des TPE et PME françaises utilisent l'IA en 2026, contre 13 % en 2024. Adoption par taille et par secteur, usages, impact déclaré, comparaison avec l'Europe : chiffres publics sourcés.";
export const BAROMETRE_DATE_PUBLICATION = "2026-12-01";
export const BAROMETRE_DATE_MODIFICATION = "2026-12-01";
/** Date de consultation de toutes les sources. */
export const BAROMETRE_DATE_CONSULTATION = "26 novembre 2026";

/**
 * Ouverture publique : 1er décembre 2026, 00:00 heure de Paris (UTC+1 en hiver, soit le
 * 30 novembre 2026 à 23:00 UTC). Constante dans le code, pas variable d'environnement.
 * Avant cet instant : noindex, hors sitemap, hors page Ressources (comportement inchangé).
 * À partir de cet instant : indexable, dans le sitemap, lien dans Ressources. La page étant
 * générée au build puis revalidée (ISR), le basculement se voit au plus tard à la
 * revalidation qui suit l'instant d'ouverture (1 h pour la page et Ressources ; le sitemap
 * suit sa propre revalidation).
 */
export const BAROMETRE_DATE_OUVERTURE = "2026-12-01T00:00:00+01:00";

/** Vrai à partir de l'instant d'ouverture (inclus). */
export function barometreEstPublic(now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(BAROMETRE_DATE_OUVERTURE);
}

export interface ChiffreCle {
  /** Valeur mise en avant, telle que publiée. */
  valeur: string;
  /** Phrase autonome (citable hors contexte). */
  phrase: string;
  /** Source et périmètre. */
  source: string;
}

export const CHIFFRES_CLES: readonly ChiffreCle[] = [
  {
    valeur: "40 %",
    phrase:
      "40 % des TPE et PME françaises déclaraient utiliser au moins une solution d'intelligence artificielle en 2026, contre 13 % en 2024.",
    source:
      "Baromètre France Num 2026, Crédoc et Centre Relations Clients pour la Direction générale des Entreprises, 9 655 entreprises interrogées",
  },
  {
    valeur: "38 % et 53 %",
    phrase:
      "En 2026, 38 % des TPE (moins de 10 salariés) et 53 % des PME (10 à 249 salariés) utilisent l'IA ; la PME était à 34 % en 2025 et 16 % en 2024.",
    source: "Baromètre France Num 2026, rapport complet p. 53",
  },
  {
    valeur: "18,16 %",
    phrase:
      "En 2025, 18,16 % des entreprises françaises de 10 personnes occupées ou plus (hors agriculture, mines et secteur financier) utilisaient au moins une technologie d'IA, contre 19,95 % dans l'Union européenne à 27.",
    source: "Eurostat, enquête sur l'usage des TIC, jeu de données isoc_eb_ai",
  },
  {
    valeur: "34 %",
    phrase:
      "En 2026, 34 % des TPE et PME françaises utilisent l'IA pour générer du texte, de la voix ou des images, premier usage cité, devant les assistants conversationnels (24 %).",
    source: "Baromètre France Num 2026",
  },
  {
    valeur: "68 %",
    phrase:
      "En 2026, 68 % des TPE et PME françaises utilisatrices d'IA jugent qu'elle a un impact positif sur leur entreprise, et 84 % de celles qui utilisent des solutions payantes.",
    source: "Baromètre France Num 2026",
  },
];

export interface Tableau {
  titre: string;
  source: string;
  entetes: readonly string[];
  lignes: readonly (readonly string[])[];
}

export const EVOLUTION: Tableau = {
  titre: "Évolution de l'usage de l'IA (TPE et PME françaises)",
  source: "Baromètre France Num, rapport complet p. 53. Le rapport mentionne 5 % en 2023.",
  entetes: ["Ensemble", "2024", "2025", "2026"],
  lignes: [
    ["TPE et PME", "13 %", "26 %", "40 %"],
    ["PME (10 à 249 salariés)", "16 %", "34 %", "53 %"],
    ["TPE (moins de 10 salariés)", "12 %", "24 %", "38 %"],
  ],
};

export const PAR_TAILLE: Tableau = {
  titre: "Part utilisant l'IA selon la taille (TPE et PME françaises, 2026)",
  source: "Baromètre France Num 2026, rapport p. 54",
  entetes: ["Taille", "Part utilisant l'IA"],
  lignes: [
    ["1 à 4 salariés", "36 %"],
    ["5 à 9 salariés", "44 %"],
    ["10 à 19 salariés", "48 %"],
    ["20 à 49 salariés", "58 %"],
    ["50 à 249 salariés", "62 %"],
  ],
};

export const PAR_SECTEUR: Tableau = {
  titre: "Part utilisant l'IA selon le secteur (TPE et PME françaises, 2026)",
  source:
    "Baromètre France Num 2026. Activités financières : 46 % sur la page de présentation, 47 % dans le rapport complet (écart non expliqué par la source).",
  entetes: ["Secteur", "Part utilisant l'IA"],
  lignes: [
    ["Numérique", "72 %"],
    ["Services spécialisés et techniques (conseil, ingénierie)", "60 %"],
    ["Activités financières", "46 % (page) / 47 % (rapport)"],
    ["Services à la personne", "45 %"],
    ["Commerce (détail et gros)", "34 %"],
    ["Hébergement-Restauration", "34 %"],
    ["Bâtiment-Construction", "30 %"],
    ["Transport-Logistique", "29 %"],
    ["Agroalimentaire", "27 %"],
    ["Agriculture", "18 %"],
  ],
};

export const AUTRES_ECARTS: readonly string[] = [
  "Selon l'âge du dirigeant : 57 % des entreprises dont le dirigeant a moins de 30 ans utilisent l'IA, contre 25 % lorsqu'il a plus de 71 ans.",
  "Selon le niveau de formation du dirigeant : 53 % au-dessus de Bac+3, 20 % en dessous du Bac.",
  "Selon la clientèle : 48 % des entreprises vendant à des entreprises (BtoB) contre 33 % pour celles vendant aux particuliers (BtoC).",
];

export const USAGES: Tableau = {
  titre: "Usages d'IA dans les TPE et PME françaises (2026)",
  source:
    "Baromètre France Num 2026, base : toutes les entreprises interrogées. Pour l'analyse de documents, l'automatisation et l'analyse de données, la page de présentation et le rapport complet (p. 54) donnent des valeurs différentes : les deux sont indiquées.",
  entetes: ["Usage", "Part"],
  lignes: [
    ["Génération de contenus (texte, voix ou image)", "34 % (+12 points sur un an)"],
    ["Assistants conversationnels, chatbots, recherche d'informations", "24 % (+10 points)"],
    ["Analyse et classification de documents", "13 % (page) / 14 % (rapport)"],
    ["Automatisation des tâches", "11 % (page) / 9 % (rapport)"],
    ["Analyse de données, prévision, optimisation des ressources", "9 % (page) / 11 % (rapport)"],
    ["Contrôle qualité, détection", "4 %"],
  ],
};

export const PAYANT_IMPACT: readonly string[] = [
  "Parmi les TPE et PME françaises utilisatrices d'IA, 48 % utilisent principalement des solutions payantes (20 %) ou les deux (28 %), et 52 % principalement des solutions gratuites (rapport p. 55). À une autre question, 50 % déclarent n'utiliser que des solutions gratuites (rapport p. 58) : les deux mesures ne sont pas complémentaires.",
  "19 % de l'ensemble des TPE et PME, et 32 % des PME, recourent à des solutions payantes.",
  "Impact ressenti : 68 % des utilisateurs jugent l'impact de l'IA positif ; 84 % parmi les utilisateurs de solutions payantes et 56 % parmi ceux de solutions gratuites (rapport p. 57). 28 % ne se prononcent ni pour ni contre. Cette mesure est déclarative : elle ne chiffre pas un gain de temps ou de chiffre d'affaires.",
];

export const EUROSTAT: Tableau = {
  titre:
    "Entreprises utilisant au moins une technologie d'IA, France et Union européenne à 27 (Eurostat)",
  source:
    "Eurostat, isoc_eb_ai ; entreprises de 10 personnes occupées ou plus, hors agriculture, mines et secteur financier.",
  entetes: ["Périmètre", "France 2024", "UE27 2024", "France 2025", "UE27 2025"],
  lignes: [
    ["10 personnes occupées ou plus", "9,91 %", "13,48 %", "18,16 %", "19,95 %"],
    ["10 à 49 personnes occupées", "8,51 %", "11,21 %", "15,04 %", "17,00 %"],
    ["50 à 249 personnes occupées", "14,52 %", "20,97 %", "30,81 %", "30,36 %"],
    ["250 personnes occupées ou plus", "32,74 %", "41,17 %", "58,01 %", "55,03 %"],
  ],
};

export const LECTURE_EUROPE =
  "En 2025, la France (18,16 %) reste sous la moyenne de l'UE27 (19,95 %) pour l'ensemble des entreprises de 10 personnes occupées ou plus, après avoir été plus éloignée en 2024 (9,91 % contre 13,48 %). Pour les entreprises de 50 personnes occupées ou plus, la France est au niveau de l'UE27 en 2025 ou au-dessus ; l'écart se situe surtout chez les entreprises de 10 à 49 personnes occupées.";

export const FREINS_UE27: Tableau = {
  titre: "Freins à l'adoption de l'IA, Union européenne à 27, 2025 (Eurostat)",
  source:
    "Eurostat, entreprises de 10 personnes occupées ou plus. Première colonne : part de l'ensemble des entreprises (lecture d'Axion-IA de l'unité « pourcentage d'entreprises »). Seconde colonne : unité PC_ENT_AI_EC, part des entreprises qui ont envisagé l'IA sans l'utiliser. Les faibles valeurs de la première colonne ne signifient pas que ces freins sont marginaux : elles sont rapportées à toutes les entreprises.",
  entetes: [
    "Frein",
    "Part de l'ensemble des entreprises",
    "Part des entreprises ayant envisagé l'IA",
  ],
  lignes: [
    ["Manque de compétences", "7,76 %", "70,31 %"],
    ["Incertitude sur les conséquences juridiques", "5,92 %", "53,61 %"],
    ["Protection des données et vie privée", "5,82 %", "52,72 %"],
    ["Disponibilité ou qualité des données", "4,80 %", "43,51 %"],
    ["Incompatibilité avec les systèmes existants", "4,59 %", "41,60 %"],
    ["Coûts jugés trop élevés", "4,24 %", "38,37 %"],
    ["Considérations éthiques", "2,72 %", "24,64 %"],
    ["IA jugée inutile pour l'entreprise", "1,96 %", "17,79 %"],
  ],
};

export const FREINS_LIMITE =
  "Le Baromètre France Num 2026 ne publie pas, dans les documents consultés, de classement des freins à l'adoption de l'IA propre aux TPE et PME françaises. Eurostat publie les freins pour l'UE27 seulement.";

export const ELEMENTS_FRANCAIS: readonly string[] = [
  "Compétences : parmi les TPE et PME françaises utilisatrices d'IA, 51 % déclarent disposer de compétences en IA (dont 40 % en interne), 18 % cherchent à en acquérir et 31 % n'en ont pas et n'ont pas de projet pour en acquérir.",
  "Confiance et données : 53 % des dirigeants de TPE et PME françaises craignent la perte de données ou le piratage, et 39 % ont subi au moins un incident de cybersécurité sur les 12 derniers mois.",
  "Perception : 71 % des dirigeants de TPE et PME estiment que le numérique apporte un bénéfice réel à leur entreprise, soit 7 points de moins que l'an dernier ; la baisse est plus nette chez les TPE.",
  "Dépenses : 33 % des TPE et PME françaises n'ont réalisé aucune dépense dédiée au numérique (hors formation et recrutement), soit 8 points de plus en un an.",
];

export const VOCABULAIRE =
  "Une TPE compte moins de 10 salariés, une PME de 10 à 249 salariés, une grande entreprise 250 salariés ou plus. Les deux sources principales n'ont pas le même périmètre : le Baromètre France Num interroge les TPE et PME (dont des entreprises sans salarié), Eurostat ne mesure que les entreprises de 10 personnes occupées ou plus (le Baromètre France Num compte des salariés, Eurostat des personnes occupées, dirigeants et indépendants compris). Les deux séries ne se comparent pas directement.";

export const ENSEIGNEMENTS: readonly { titre: string; texte: string }[] = [
  {
    titre: "L'IA n'est plus marginale chez les TPE et PME.",
    texte:
      "Quatre entreprises sur dix déclarent en utiliser (40 %, France Num 2026) ; chez les PME de 10 à 249 salariés, les utilisatrices sont désormais majoritaires (53 %).",
  },
  {
    titre: "L'usage varie avec la taille, et l'écart se creuse.",
    texte:
      "L'écart entre TPE et PME : 4 points en 2024, 10 en 2025, 15 en 2026. 36 % des entreprises de 1 à 4 salariés l'utilisent contre 62 % de celles de 50 à 249 salariés ; la formation du dirigeant et la clientèle (BtoB) vont avec un usage plus répandu.",
  },
  {
    titre: "Les usages courants sont simples : rédiger, converser, chercher.",
    texte:
      "La génération de contenus (34 %) et les assistants conversationnels (24 %) dominent ; l'automatisation et l'analyse de données restent à 9-11 % (les deux sources divergent sur lequel des deux est à 9 % ou à 11 %).",
  },
  {
    titre:
      "Le ressenti est plus favorable avec des outils payants, mais la mesure est déclarative.",
    texte:
      "84 % d'impact positif déclaré avec des solutions payantes, 56 % avec des gratuites ; les deux groupes ne sont pas comparables à périmètre égal (taille, secteur, usages).",
  },
  {
    titre:
      "Les compétences et la confiance dans les données sont les points d'attention récurrents.",
    texte:
      "31 % des utilisateurs d'IA n'ont ni compétence ni projet d'en acquérir ; en Europe, le manque de compétences est le frein le plus cité (7,76 % de l'ensemble des entreprises, soit 70,31 % des entreprises qui ont envisagé l'IA sans l'adopter, Eurostat, unité PC_ENT_AI_EC, UE27, 2025) ; 53 % des dirigeants craignent la perte de données.",
  },
];

export const METHODOLOGIE: readonly string[] = [
  "Baromètre France Num 2026 : enquête du Crédoc et du Centre Relations Clients pour la Direction générale des Entreprises, réalisée du 23 mars au 18 avril 2026, 9 655 entreprises répondantes (6 786 TPE dont 799 sans salarié, 2 869 PME), en ligne (8 843) et par téléphone (812). Résultats déclarés représentatifs de la population 2024 des TPE et PME (taille, secteur, 13 régions de France métropolitaine). Marge d'erreur annoncée inférieure à 1 % au niveau global ; elle est plus large pour les sous-groupes (secteurs, tailles). Les questions sur l'IA sont déclaratives. Les questions sur l'impact, les compétences, le caractère payant et les dépenses sont nouvelles en 2026 : pas de série historique.",
  "Eurostat, isoc_eb_ai : enquête communautaire sur l'usage des TIC dans les entreprises de 10 personnes occupées ou plus, hors agriculture, mines et secteur financier. Valeurs lues par l'API publique d'Eurostat (jeu mis à jour le 2026-06-15). Eurostat ne publie pas cet indicateur pour les entreprises de moins de 10 personnes occupées ; pour les TPE, la seule mesure retenue ici est celle du Baromètre France Num.",
  "Quand la page de présentation et le rapport France Num divergent, les deux valeurs sont données.",
  "Aucun chiffre n'a été estimé, extrapolé ou arrondi par nos soins. Les chiffres de cette page sont à citer avec leur périmètre et leur année.",
];

export const LIMITES =
  "Cette version repose sur des chiffres publics uniquement. Les données de l'INSEE, de Bpifrance Le Lab, de la Banque de France, des CCI et de l'OCDE n'ont pas pu être vérifiées ; aucun chiffre n'en a été repris. Ne sont pas couverts : les freins à l'adoption propres à la France, la ventilation Eurostat par secteur, l'usage de l'IA dans les entreprises de moins de 10 salariés hors France Num, et les données régionales.";

export interface SourceBarometre {
  id: string;
  nom: string;
  url: string;
  detail: string;
  /** Type schema.org de la source, repris dans `isBasedOn`. */
  type: "WebPage" | "Report" | "Dataset";
}

export const SOURCES: readonly SourceBarometre[] = [
  {
    id: "france-num-synthese",
    nom: "Baromètre France Num 2026, page de synthèse",
    url: "https://www.francenum.gouv.fr/guides-et-conseils/strategie-numerique/comprendre-le-numerique/barometre-france-num-2026-le",
    detail: "Publiée le 17 septembre 2026, mise à jour le 12 novembre 2026.",
    type: "WebPage",
  },
  {
    id: "france-num-rapport",
    nom: "Baromètre France Num 2026, rapport complet (PDF)",
    url: "https://www.francenum.gouv.fr/files/2026-09/Barom%C3%A8tre%20France%20Num%202026%20-%20Rapport%20final.pdf",
    detail: "Document daté du 02/10/2026.",
    type: "Report",
  },
  {
    id: "eurostat-isoc-eb-ai",
    nom: "Eurostat, « Artificial intelligence by size class of enterprise » (isoc_eb_ai)",
    url: "https://ec.europa.eu/eurostat/databrowser/view/isoc_eb_ai/default/table",
    detail: "Tableau consulté ; données lues via l'API de diffusion d'Eurostat.",
    type: "Dataset",
  },
];

/** Variables mesurées du jeu de données (JSON-LD Dataset). */
export const VARIABLES_MESUREES: readonly {
  nom: string;
  valeur: string;
  periode: string;
  perimetre: string;
}[] = [
  {
    nom: "Part des TPE et PME utilisant au moins une solution d'IA",
    valeur: "40 %",
    periode: "2026",
    perimetre: "TPE et PME françaises",
  },
  {
    nom: "Part des TPE et PME utilisant l'IA",
    valeur: "13 %",
    periode: "2024",
    perimetre: "TPE et PME françaises",
  },
  {
    nom: "Part des TPE utilisant l'IA",
    valeur: "38 %",
    periode: "2026",
    perimetre: "TPE françaises (moins de 10 salariés)",
  },
  {
    nom: "Part des PME utilisant l'IA",
    valeur: "53 %",
    periode: "2026",
    perimetre: "PME françaises (10 à 249 salariés)",
  },
  {
    nom: "Part des entreprises utilisant au moins une technologie d'IA",
    valeur: "18,16 %",
    periode: "2025",
    perimetre: "France, 10 personnes occupées ou plus (Eurostat)",
  },
  {
    nom: "Part des entreprises utilisant au moins une technologie d'IA",
    valeur: "19,95 %",
    periode: "2025",
    perimetre: "UE27, 10 personnes occupées ou plus (Eurostat)",
  },
  {
    nom: "Part des TPE et PME utilisant l'IA pour générer du texte, de la voix ou des images",
    valeur: "34 %",
    periode: "2026",
    perimetre: "TPE et PME françaises",
  },
  {
    nom: "Part des utilisatrices d'IA jugeant son impact positif",
    valeur: "68 %",
    periode: "2026",
    perimetre: "TPE et PME françaises utilisatrices d'IA",
  },
];
