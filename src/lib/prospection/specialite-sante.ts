/**
 * Prospection Santé (V2) — SSOT spécialité médicale.
 *
 * Le NAF s'arrête à « médecin spécialiste » (86.22). La spécialité fine
 * (cardiologue, ophtalmologue…) vient du RPPS / Annuaire Santé (libellé
 * « savoir-faire »). On NORMALISE ce libellé — de formulation variable — vers une
 * spécialité canonique par mots-clés (robuste, comme `naf-to-secteur`). Pur.
 */

export const SPECIALITES_SANTE = [
  "medecine_generale",
  "cardiologie",
  "ophtalmologie",
  "dermatologie",
  "gynecologie",
  "pediatrie",
  "psychiatrie",
  "radiologie",
  "orl",
  "gastro_enterologie",
  "rhumatologie",
  "neurologie",
  "pneumologie",
  "endocrinologie",
  "urologie",
  "stomatologie",
  "chirurgie",
  "anesthesie",
  "autre_specialite",
] as const;

export type SpecialiteSante = (typeof SPECIALITES_SANTE)[number];

export const SPECIALITE_LABELS: Record<SpecialiteSante, string> = {
  medecine_generale: "Médecine générale",
  cardiologie: "Cardiologie",
  ophtalmologie: "Ophtalmologie",
  dermatologie: "Dermatologie",
  gynecologie: "Gynécologie",
  pediatrie: "Pédiatrie",
  psychiatrie: "Psychiatrie",
  radiologie: "Radiologie / imagerie",
  orl: "ORL",
  gastro_enterologie: "Gastro-entérologie",
  rhumatologie: "Rhumatologie",
  neurologie: "Neurologie",
  pneumologie: "Pneumologie",
  endocrinologie: "Endocrinologie / diabétologie",
  urologie: "Urologie",
  stomatologie: "Stomatologie / chirurgie dentaire",
  chirurgie: "Chirurgie",
  anesthesie: "Anesthésie-réanimation",
  autre_specialite: "Autre spécialité",
};

// Ordre : le plus spécifique d'abord (medecine_generale en dernier avant fallback).
const RULES: ReadonlyArray<readonly [RegExp, SpecialiteSante]> = [
  [/cardiolog/, "cardiologie"],
  [/ophtalmolog/, "ophtalmologie"],
  [/dermatolog|venereolog/, "dermatologie"],
  [/gyneco|obstetri/, "gynecologie"],
  [/pediatr/, "pediatrie"],
  [/psychiatr|pedopsych/, "psychiatrie"],
  [/radiolog|imagerie|radiodiagnostic/, "radiologie"],
  [/oto.?rhino|laryngolog|\borl\b/, "orl"],
  [/gastro|hepato|enterolog/, "gastro_enterologie"],
  [/rhumatolog/, "rhumatologie"],
  [/neurolog/, "neurologie"],
  [/pneumolog|pneumo/, "pneumologie"],
  [/endocrino|diabetolog|nutrition/, "endocrinologie"],
  [/urolog/, "urologie"],
  [/stomatolog|odontolog|dentaire|dentiste/, "stomatologie"],
  [/anesthesi|reanimation/, "anesthesie"],
  [/chirurg/, "chirurgie"],
  [/generaliste|medecine generale|omnipraticien/, "medecine_generale"],
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Normalise un libellé « savoir-faire » RPPS vers une spécialité canonique.
 * - libellé vide / absent → null (pas un praticien exploitable) ;
 * - libellé reconnu → la spécialité ;
 * - libellé de santé non mappé → `autre_specialite` (jamais perdu).
 */
export function normalizeSpecialite(rawLabel: string | null | undefined): SpecialiteSante | null {
  if (!rawLabel || !rawLabel.trim()) return null;
  const s = norm(rawLabel);
  for (const [re, spec] of RULES) {
    if (re.test(s)) return spec;
  }
  return "autre_specialite";
}
