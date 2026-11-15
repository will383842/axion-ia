/**
 * MOTS INTERDITS DANS LE TEXTE D'UN GUIDE FABRIQUÉ — 3e contrôle (après le prompt et le Studio).
 *
 * ⚠️ Le Studio FAIT RÉFÉRENCE : la liste est recopiée À L'IDENTIQUE de `REGLES_MOTS_INTERDITS` (Studio, guide-contenu.ts,
 * liste v3) et la fixture `__tests__/fixtures/mots-interdits-guide.json` a le MÊME contenu que (mise en forme Prettier près)
 * `tests/fixtures/guide-mots-interdits.json` du Studio. Un test garde l'égalité (ids, motifs, ordre).
 * Normalisation : NFKD, sans accents (U+0300–U+036F), apostrophes typographiques ramenées à l'apostrophe droite, minuscules.
 * Chaque texte est contrôlé SÉPARÉMENT (jamais joints : un motif ne doit pas enjamber deux textes).
 * Le refus rend l'IDENTIFIANT de la règle, jamais l'extrait du texte.
 */
export interface RegleMotInterdit {
  id: string;
  description: string;
  /** Expression régulière (drapeau `u`) appliquée au texte NORMALISÉ. */
  motif: string;
  exemples: string[];
}

/** Liste unique, dans l'ordre d'application. */
export const REGLES_MOTS_INTERDITS: RegleMotInterdit[] = [
  {
    id: "abonne",
    description: "abonné, abonnement, désabonner, réabonnement… (dire « suivre le compte »)",
    motif: "abonn",
    exemples: ["abonné", "abonnement", "désabonner", "réabonnement"],
  },
  { id: "grenoble", description: "Grenoble", motif: "grenoble", exemples: ["Grenoble"] },
  {
    id: "aucun-gain-garanti",
    description: "« Aucun gain garanti »",
    motif: "aucun\\s+gain\\s+garanti",
    exemples: ["Aucun gain garanti"],
  },
  {
    id: "garanti",
    description: "garanti, garantie, garantissons…",
    motif: "\\bgaranti",
    exemples: ["garanti", "garantissons"],
  },
  {
    id: "certifie",
    description: "certifié, certification…",
    motif: "\\bcertifi",
    exemples: ["certifiée", "certification"],
  },
  { id: "qualiopi", description: "Qualiopi", motif: "qualiopi", exemples: ["Qualiopi"] },
  {
    id: "tutoiement",
    description:
      "tutoiement : tu, toi, te, ta, tes, t', ton compte/entreprise/activité/site/équipe/métier/guide",
    motif:
      "\\b(?:tu|toi|te|ta|tes)\\b|\\bt'|\\bton\\s+(?:compte|entreprise|activite|site|equipe|metier|guide)\\b",
    exemples: ["Tu peux", "pour toi", "je t'explique", "ton entreprise", "Ton activité"],
  },
  { id: "pourcentage", description: "promesse chiffrée : %", motif: "%", exemples: ["30 %"] },
  { id: "euro", description: "promesse chiffrée : €", motif: "€", exemples: ["100 €"] },
  {
    id: "x-fois",
    description: "promesse chiffrée : « x fois » (la lettre x)",
    motif: "\\bx\\s*fois\\b",
    exemples: ["x fois mieux", "x fois plus"],
  },
  {
    id: "double",
    description: "promesse chiffrée : doubler, tripler…",
    motif: "\\b(?:doubl|tripl)",
    exemples: ["doubler", "triplé"],
  },
  {
    id: "euros-mot",
    description: "promesse chiffrée : « euro(s) », « eur »",
    motif: "\\beuros?\\b|\\beur\\b",
    exemples: ["100 euros", "un euro", "50 EUR"],
  },
  {
    id: "pour-cent",
    description: "promesse chiffrée : « pour cent », « pourcent »",
    motif: "\\bpour\\s*cent\\b|\\bpourcent",
    exemples: ["trente pour cent", "dix pourcent"],
  },
  {
    id: "n-fois-plus",
    description: "promesse chiffrée : « deux fois plus », « dix fois mieux »…",
    motif:
      "\\b(?:\\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|cent|mille)\\s*fois\\s+(?:plus|mieux|moins)",
    exemples: [
      "deux fois plus",
      "dix fois mieux",
      "cent fois moins",
      "3 fois plus",
      "10 fois mieux",
    ],
  },
  {
    id: "multiplicateur",
    description:
      "promesse chiffrée : « x2 », « x10 », « 3x », « ×5 » collés (« 1080 x 1920 », « x64 », « Max 3 » restent permis)",
    motif: "\\bx(?!(?:64|86)\\b)\\d+\\b|\\b\\d+x\\b|(?<!\\d\\s*)\\u00D7\\s*\\d",
    exemples: ["x2", "x10", "3x", "\u00D75"],
  },
];

/** NFKD, sans accents, minuscules, apostrophes droites. */
export function normaliserPourRegles(texte: string): string {
  return texte
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .toLowerCase();
}

const REGLES_COMPILEES = REGLES_MOTS_INTERDITS.map((r) => ({
  id: r.id,
  re: new RegExp(r.motif, "u"),
}));

/** Identifiant de la première règle enfreinte par l'un des textes, ou `null`. Aucun extrait n'est rendu. */
export function motInterditDans(textes: string | readonly string[]): string | null {
  const normalises = (typeof textes === "string" ? [textes] : textes).map(normaliserPourRegles);
  for (const r of REGLES_COMPILEES) if (normalises.some((t) => r.re.test(t))) return r.id;
  return null;
}
