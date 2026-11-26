/**
 * Challenges d'apporteurs — le filtre de formules de pression.
 *
 * Un challenge est une INVITATION LIBRE : jamais de compte à rebours, de rareté ni de reproche
 * (risque de requalification en salariat). Le filtre vise des FORMULES, pas des mots isolés, pour
 * ne pas rejeter le règlement lui-même (« aucun objectif », « aucun classement »). Il s'applique
 * au titre et au règlement avant tout enregistrement. Il ne remplace pas la relecture humaine.
 *
 * Y figurent aussi les formules que la maison s'interdit partout (« Grenoble », « Aucun gain
 * garanti », « sans discussion », « 5 fois »).
 */
const FORMULES: ReadonlyArray<{ motif: RegExp; libelle: string }> = [
  { motif: /\bil vous reste\b/i, libelle: "« il vous reste »" },
  {
    motif: /\bplus que (quelques|\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\b/i,
    libelle: "« plus que »",
  },
  { motif: /\bencore \d+/i, libelle: "« encore N »" },
  { motif: /\bderniers jours\b/i, libelle: "« derniers jours »" },
  { motif: /\bderni[èe]re chance\b/i, libelle: "« dernière chance »" },
  { motif: /\bJ-\d+/i, libelle: "« J-N »" },
  { motif: /\bne manquez pas\b/i, libelle: "« ne manquez pas »" },
  { motif: /\bd[ée]p[êe]chez/i, libelle: "« dépêchez-vous »" },
  { motif: /\bvous [êe]tes [àa] \d+/i, libelle: "« vous êtes à N »" },
  { motif: /\b\d+ sur \d+\b/i, libelle: "« N sur M » (compteur de progression)" },
  { motif: /[!！]/, libelle: "un point d'exclamation" },
  { motif: /\bne vous reste\b/i, libelle: "« ne vous reste »" },
  { motif: /\bplus qu'\s*(une?|\d+)/i, libelle: "« plus qu'un / qu'une / qu'N »" },
  { motif: /\b(votre|vos|ton|tes) objectifs?\b/i, libelle: "« votre objectif » (objectif imposé)" },
  { motif: /\bobjectif (de|à atteindre|fixé)/i, libelle: "« objectif de / à atteindre / fixé »" },
  { motif: /\bvous devez\b/i, libelle: "« vous devez » (obligation)" },
  { motif: /\bvous [êe]tes tenu/i, libelle: "« vous êtes tenu » (obligation)" },
  { motif: /\bobligatoire\b/i, libelle: "« obligatoire »" },
  {
    motif: /\bclassement (publié|hebdomadaire|mensuel)/i,
    libelle: "un classement publié, hebdomadaire ou mensuel",
  },
  { motif: /\b(1er|premier|top) du classement/i, libelle: "« premier / top du classement »" },
  { motif: /\bGrenoble\b/i, libelle: "« Grenoble »" },
  { motif: /\baucun gain garanti\b/i, libelle: "« Aucun gain garanti »" },
  { motif: /\bsans discussion\b/i, libelle: "« sans discussion »" },
  { motif: /\b5 fois\b/i, libelle: "« 5 fois »" },
];

/** Les formules interdites trouvées dans `texte` (liste vide : le texte passe). */
export function formulesInterdites(brut: string): string[] {
  // Apostrophe typographique → droite ; espaces insécables (fine ou non) → espace.
  const texte = brut.replace(/[’‘]/g, "'").replace(/[\u00a0\u202f]/g, " ");
  return FORMULES.filter((f) => f.motif.test(texte)).map((f) => f.libelle);
}
