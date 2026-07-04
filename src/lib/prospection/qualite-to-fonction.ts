// SSOT — Normalisation d'une « qualité » (intitulé de poste brut) en fonction /
// séniorité / département fonctionnel (T1).
//
// Module Prospection. Entrée = texte libre (Sirene/RNE `qualite`, ou titre scrapé
// sur une page équipe). Sortie = triplet normalisé pour filtrer « tous les
// responsables achats en BTP dans le 38 » (01-DATA-MODEL §CompanyPersonRole).
// Règles ordonnées, premier match gagne (les libellés les plus spécifiques
// d'abord). Repli `autre` obligatoire → un rôle non mappé n'est jamais perdu.
// `estDirigeantLegal` n'est PAS déduit du titre (il vient de la SOURCE : RCS/Sirene
// vs scrape) — ce module ne fournit qu'une séniorité indicative.

import type { FonctionNormalisee, Seniorite, DepartementFonctionnel } from "./enums";

export interface FonctionMatch {
  fonctionNormalisee: FonctionNormalisee;
  seniorite: Seniorite;
  departementFonctionnel: DepartementFonctionnel;
}

/** Minuscule + sans accents + espaces normalisés. */
export function normalizeQualite(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Règles ordonnées : { test(normalized) → match }. Spécifique avant générique.
const RULES: ReadonlyArray<{ re: RegExp; m: FonctionMatch }> = [
  // Direction générale
  {
    re: /\bpdg\b|president directeur general/,
    m: {
      fonctionNormalisee: "directeur_general",
      seniorite: "dirigeant",
      departementFonctionnel: "direction",
    },
  },
  {
    re: /directeur general delegue|dg delegue|\bdgd\b/,
    m: {
      fonctionNormalisee: "directeur_general_delegue",
      seniorite: "dirigeant",
      departementFonctionnel: "direction",
    },
  },
  {
    re: /directeur general|directrice generale|\bdg\b|\bceo\b/,
    m: {
      fonctionNormalisee: "directeur_general",
      seniorite: "dirigeant",
      departementFonctionnel: "direction",
    },
  },
  {
    re: /\bpresident(e)?\b|\bpdt\b|chairman/,
    m: {
      fonctionNormalisee: "president",
      seniorite: "dirigeant",
      departementFonctionnel: "direction",
    },
  },
  {
    re: /\bgerant(e)?\b|co gerant/,
    m: {
      fonctionNormalisee: "gerant",
      seniorite: "dirigeant",
      departementFonctionnel: "direction",
    },
  },
  // Directions fonctionnelles
  {
    re: /directeur administratif et financier|directrice administrative et financiere|\bdaf\b|\bcfo\b/,
    m: {
      fonctionNormalisee: "directeur_administratif_financier",
      seniorite: "directeur",
      departementFonctionnel: "finance",
    },
  },
  {
    re: /directeur (des )?systemes( d)?( )?information|directeur informatique|\bdsi\b|\bcio\b/,
    m: {
      fonctionNormalisee: "directeur_des_systemes_information",
      seniorite: "directeur",
      departementFonctionnel: "dsi",
    },
  },
  {
    re: /directeur (des affaires )?juridiques?|directeur juridique|\bdaj\b/,
    m: {
      fonctionNormalisee: "directeur",
      seniorite: "directeur",
      departementFonctionnel: "juridique",
    },
  },
  {
    re: /directeur commercial|directrice commerciale|\bcso\b|directeur des ventes/,
    m: {
      fonctionNormalisee: "directeur_commercial",
      seniorite: "directeur",
      departementFonctionnel: "commercial",
    },
  },
  {
    re: /directeur (du )?marketing|directrice marketing|\bcmo\b/,
    m: {
      fonctionNormalisee: "directeur_marketing",
      seniorite: "directeur",
      departementFonctionnel: "marketing",
    },
  },
  {
    re: /directeur (des )?ressources humaines|\bdrh\b/,
    m: {
      fonctionNormalisee: "directeur_ressources_humaines",
      seniorite: "directeur",
      departementFonctionnel: "rh",
    },
  },
  {
    re: /directeur (des )?achats/,
    m: {
      fonctionNormalisee: "directeur_achats",
      seniorite: "directeur",
      departementFonctionnel: "achats",
    },
  },
  {
    re: /directeur technique|\bcto\b/,
    m: {
      fonctionNormalisee: "directeur_technique",
      seniorite: "directeur",
      departementFonctionnel: "technique",
    },
  },
  {
    re: /directeur (de )?(la )?production|directeur industriel|directeur d exploitation|directeur usine/,
    m: {
      fonctionNormalisee: "directeur_production",
      seniorite: "directeur",
      departementFonctionnel: "production",
    },
  },
  {
    re: /\bdirecteur(rice)?\b|\bdirecteur\b/,
    m: {
      fonctionNormalisee: "directeur",
      seniorite: "directeur",
      departementFonctionnel: "direction",
    },
  },
  // Responsables
  {
    re: /responsable (commercial|des ventes|d(u)? developpement commercial)|chef des ventes/,
    m: {
      fonctionNormalisee: "responsable_commercial",
      seniorite: "responsable",
      departementFonctionnel: "commercial",
    },
  },
  {
    re: /responsable (des )?ressources humaines|responsable rh|charge (de )?recrutement/,
    m: {
      fonctionNormalisee: "responsable_rh",
      seniorite: "responsable",
      departementFonctionnel: "rh",
    },
  },
  {
    re: /responsable (des )?achats|acheteur|responsable approvisionnement/,
    m: {
      fonctionNormalisee: "responsable_achats",
      seniorite: "responsable",
      departementFonctionnel: "achats",
    },
  },
  {
    re: /responsable (du )?marketing|responsable communication|responsable digital|responsable web/,
    m: {
      fonctionNormalisee: "responsable_marketing",
      seniorite: "responsable",
      departementFonctionnel: "marketing",
    },
  },
  {
    re: /responsable (technique|de production|d atelier|bureau d etudes)|chef de chantier|conducteur de travaux/,
    m: {
      fonctionNormalisee: "responsable_technique",
      seniorite: "responsable",
      departementFonctionnel: "technique",
    },
  },
  {
    re: /responsable (qhse|hse|qse|qualite)|\bqhse\b|responsable securite|animateur securite/,
    m: {
      fonctionNormalisee: "responsable_qhse",
      seniorite: "responsable",
      departementFonctionnel: "qhse",
    },
  },
  {
    re: /responsable administratif|office manager|responsable de bureau|secretaire general/,
    m: {
      fonctionNormalisee: "responsable_administratif",
      seniorite: "responsable",
      departementFonctionnel: "direction",
    },
  },
  {
    re: /responsable (des affaires )?juridiques?|responsable juridique|\bjuriste\b|general counsel/,
    m: {
      fonctionNormalisee: "autre",
      seniorite: "responsable",
      departementFonctionnel: "juridique",
    },
  },
  {
    re: /responsable informatique|responsable (des )?systemes( d)?( )?information|responsable si\b/,
    m: {
      fonctionNormalisee: "responsable_technique",
      seniorite: "responsable",
      departementFonctionnel: "dsi",
    },
  },
  {
    re: /\bresponsable\b|\bchef de (service|projet|equipe)\b|\bhead of\b/,
    m: { fonctionNormalisee: "autre", seniorite: "responsable", departementFonctionnel: "autre" },
  },
  // Associés & encadrement
  {
    re: /\bassocie(e)?\b|\bpartner\b|co fondateur|cofondateur|founder|fondateur/,
    m: {
      fonctionNormalisee: "associe",
      seniorite: "dirigeant",
      departementFonctionnel: "direction",
    },
  },
  {
    re: /\bmanager\b|\bmanageur\b/,
    m: { fonctionNormalisee: "manager", seniorite: "manager", departementFonctionnel: "autre" },
  },
  {
    re: /\bcadre\b|consultant|charge de|ingenieur|expert|conseiller/,
    m: { fonctionNormalisee: "cadre", seniorite: "cadre", departementFonctionnel: "autre" },
  },
];

const FALLBACK: FonctionMatch = {
  fonctionNormalisee: "autre",
  seniorite: "autre",
  departementFonctionnel: "autre",
};

/** Normalise un intitulé de poste. Toujours un résultat (repli `autre`). */
export function normalizeFonction(rawQualite: string | null | undefined): FonctionMatch {
  const q = normalizeQualite(rawQualite);
  if (q === "") return { ...FALLBACK };
  for (const rule of RULES) {
    if (rule.re.test(q)) return { ...rule.m };
  }
  return { ...FALLBACK };
}
