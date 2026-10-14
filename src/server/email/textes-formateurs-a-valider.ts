/**
 * Les textes d'e-mail aux formateurs indépendants que Will valide (M1, lot A).
 *
 * Un texte = un gabarit (`textes_valides.<gabarit>`) ou une VARIANTE validée à part
 * (`textes_valides.<gabarit>#<variante>`). La liste est DÉRIVÉE de ce que lisent les
 * envois : chaque gabarit de `TEXTES_FORMATEUR`, chaque variante de
 * `VARIANTES_VALIDEES_A_PART`, et la variante chiffrée de F23 (son texte de base part
 * sans validation : il n'est pas proposé).
 *
 * Pur : l'écran et les actions le lisent ; le registre reste `textes-valides.ts`.
 */

import { createHash } from "node:crypto";

import {
  LIGNE_OPPOSITION,
  TEXTE_F23_HONORAIRES,
  TEXTES_FORMATEUR,
  type GabaritFormateurIndependant,
} from "@/lib/email/templates/formateur-independant-textes";

import { cleTexteValide } from "./textes-valides";

/**
 * Variantes ajoutées APRÈS la validation possible du gabarit : elles se
 * valident à part (`textes_valides.<gabarit>#<variante>`). Sans cette clé,
 * rien ne part — jamais un texte neuf sous une validation ancienne.
 * Clé : gabarit → (n° d'étape du payload → nom de la variante).
 *
 * Lu par l'adaptateur d'envoi des formateurs (`envois.ts`) ET par l'écran de
 * validation : l'écran ne propose que ce que l'envoi exigera.
 */
export const VARIANTES_VALIDEES_A_PART: Readonly<
  Partial<Record<GabaritFormateurIndependant, Readonly<Record<number, string>>>>
> = {
  // L11e (fin de mission) — lettre non signée : aucune indemnité annoncée.
  "formateur-mission-retiree": { 2: "lettre-non-signee", 3: "sans-lettre" },
  "formateur-formation-annulee": { 2: "lettre-non-signee", 3: "sans-lettre" },
  // Lot G1 — F40 à l'approche du seuil de vigilance.
  "formateur-vigilance": { 4: "approche-seuil" },
};

export interface TexteAValider {
  readonly gabarit: string;
  readonly variante?: string;
}

/** F23 chiffrée (`proposition-chiffree.ts`, `VARIANTE_F23_HONORAIRES`). */
const F23_HONORAIRES: TexteAValider = {
  gabarit: "formateur-mission-proposee",
  variante: "honoraires",
};

export const TEXTES_FORMATEURS_A_VALIDER: readonly TexteAValider[] = [
  ...Object.keys(TEXTES_FORMATEUR).map((gabarit) => ({ gabarit })),
  ...Object.entries(VARIANTES_VALIDEES_A_PART).flatMap(([gabarit, parEtape]) =>
    [...new Set(Object.values(parEtape ?? {}))].map((variante) => ({ gabarit, variante })),
  ),
  F23_HONORAIRES,
];

export function cleDuTexte(t: TexteAValider): string {
  return cleTexteValide(t.gabarit, t.variante);
}

const CLES = new Set(TEXTES_FORMATEURS_A_VALIDER.map(cleDuTexte));

/** Ce texte se valide-t-il sur l'écran des gabarits ? */
export function estTexteFormateurAValider(gabarit: string, variante?: string): boolean {
  try {
    return CLES.has(cleTexteValide(gabarit, variante));
  } catch {
    return false;
  }
}

// ── Lot 8A (#1510-1) — l'EMPREINTE du texte validé ────────────────────────────

/** SHA-256 (hex) d'un contenu, sérialisé à clés triées : l'ordre d'écriture ne compte pas. */
export function empreinteDe(contenu: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v as Record<string, unknown>)
              .sort()
              .map((k) => [k, stable((v as Record<string, unknown>)[k])]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(stable(contenu)))
    .digest("hex");
}

/**
 * Ce que la direction relit pour ce texte, donc ce que l'empreinte couvre :
 *   · une VARIANTE validée à part : ses seules variantes (étapes qui la portent) ;
 *     F23 chiffrée : `TEXTE_F23_HONORAIRES` ;
 *   · le texte de BASE : la fiche du gabarit, SANS les variantes validées à part (les
 *     changer ne fait tomber que leur propre validation).
 */
function contenuDuTexte(t: TexteAValider): unknown {
  if (t.gabarit === F23_HONORAIRES.gabarit && t.variante === F23_HONORAIRES.variante) {
    return TEXTE_F23_HONORAIRES;
  }
  const fiche = TEXTES_FORMATEUR[t.gabarit as GabaritFormateurIndependant];
  const aPart = VARIANTES_VALIDEES_A_PART[t.gabarit as GabaritFormateurIndependant] ?? {};
  // L'étape n du payload est la variante d'indice n - 1 (`texteParDefautFormateur`).
  const indicesAPart = (nom?: string) =>
    new Set(
      Object.entries(aPart)
        .filter(([, v]) => nom === undefined || v === nom)
        .map(([etape]) => Number(etape) - 1),
    );
  if (t.variante !== undefined) {
    const indices = indicesAPart(t.variante);
    return { variante: t.variante, variantes: fiche.variantes.filter((_, i) => indices.has(i)) };
  }
  const exclus = indicesAPart();
  return { ...fiche, variantes: fiche.variantes.filter((_, i) => !exclus.has(i)) };
}

/**
 * L'empreinte couvre aussi la ligne d'opposition que la mise en page commune ajoute aux
 * sollicitations : la changer fait tomber leurs validations. La mise en page elle-même
 * (en-tête, pied, signature) n'est pas un texte validé ici.
 */
export function empreinteDuTexte(t: TexteAValider): string {
  const sollicitation = TEXTES_FORMATEUR[t.gabarit as GabaritFormateurIndependant]?.sollicitation;
  return empreinteDe({
    texte: contenuDuTexte(t),
    ...(sollicitation === true ? { opposition: LIGNE_OPPOSITION } : {}),
  });
}

const EMPREINTES: ReadonlyMap<string, string> = new Map(
  TEXTES_FORMATEURS_A_VALIDER.map((t) => [cleDuTexte(t), empreinteDuTexte(t)]),
);

/**
 * L'empreinte que doit porter la validation de cette clé ; `null` pour un texte qui ne
 * relève pas de cet écran (sa validation garde la règle d'avant : `{ valide: true }`).
 */
export function empreinteAttendue(cle: string): string | null {
  return EMPREINTES.get(cle) ?? null;
}

/**
 * La liste des textes telle que l'écran l'affiche : `clé=empreinte`, dans l'ordre, une
 * par ligne. « Valider tous les textes » la renvoie et l'action la compare à la liste du
 * moment : un texte remplacé par un autre, à nombre égal, OU dont un mot a changé entre
 * l'affichage et le clic, est refusé.
 */
export function listeDesTextesAffichee(): string {
  return TEXTES_FORMATEURS_A_VALIDER.map((t) => `${cleDuTexte(t)}=${empreinteDuTexte(t)}`).join(
    "\n",
  );
}

/**
 * La phrase de l'écran d'une VARIANTE : ce que l'envoi exige vraiment. Le texte de
 * base n'est cité que s'il se valide lui aussi (F23 chiffrée : seule la variante).
 */
export function phraseValidationVariante(gabarit: string): string {
  return estTexteFormateurAValider(gabarit)
    ? "Cette variante se valide à part : elle ne part que si le texte de base ET elle sont validés."
    : "Cette variante se valide à part : elle ne part que si elle est validée ici.";
}
