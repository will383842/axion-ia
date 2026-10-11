// Conformité RGPD (console) — le journal des incidents de données : règles pures.
//
// · Le compte à rebours de 72 h (art. 33 RGPD) court depuis `decouvertLe` tant que
//   la décision CNIL n'est pas prise : ni « oui », ni « non, parce que… ».
// · Les textes libres sont chiffrés au repos (`encryptPii`) : ils peuvent décrire
//   des personnes. La liste `CHAMPS_CHIFFRES` est la seule à tenir.

import { z } from "zod";

import { fromParisLocalInput } from "@/lib/calendar-grid";
import { decryptPii, encryptPii } from "@/lib/pii-crypto";

import type { TonPastille } from "./regles";

export const DELAI_CNIL_HEURES = 72;
/** Sous ce nombre d'heures restantes, la pastille passe à l'orange. */
export const SEUIL_ORANGE_HEURES = 24;

const HEURE_MS = 60 * 60 * 1000;

export const CHAMPS_CHIFFRES = [
  "description",
  "donneesConcernees",
  "categoriesPersonnes",
  "consequences",
  "mesuresPrises",
  "motifNonDeclaration",
  "motifNonInformation",
] as const;
export type ChampChiffre = (typeof CHAMPS_CHIFFRES)[number];

export interface DecisionCnil {
  declareCnil: boolean | null;
  motifNonDeclaration: string | null;
}

/** La décision CNIL est prise : « oui », ou « non » AVEC son motif. */
export function decisionCnilPrise(i: DecisionCnil): boolean {
  if (i.declareCnil === true) return true;
  return i.declareCnil === false && (i.motifNonDeclaration ?? "").trim() !== "";
}

export function echeanceCnil(decouvertLe: Date): Date {
  return new Date(decouvertLe.getTime() + DELAI_CNIL_HEURES * HEURE_MS);
}

/** Heures restantes avant l'échéance (négatif = dépassée). */
export function heuresRestantesCnil(decouvertLe: Date, maintenant: Date = new Date()): number {
  return (echeanceCnil(decouvertLe).getTime() - maintenant.getTime()) / HEURE_MS;
}

/**
 * La pastille CNIL d'un incident. Compte à rebours tant que la décision n'est pas
 * prise : neutre, orange sous 24 h, rouge une fois les 72 h passées.
 */
export function pastilleCnil(
  i: DecisionCnil & { decouvertLe: Date },
  maintenant: Date = new Date(),
): { libelle: string; ton: TonPastille; enCours: boolean } {
  if (i.declareCnil === true) return { libelle: "CNIL prévenue", ton: "success", enCours: false };
  if (decisionCnilPrise(i)) {
    return { libelle: "CNIL non prévenue (motif noté)", ton: "neutral", enCours: false };
  }
  const h = heuresRestantesCnil(i.decouvertLe, maintenant);
  if (h <= 0) {
    const n = Math.floor(-h);
    return {
      libelle: n < 1 ? "Délai CNIL dépassé" : `Délai CNIL dépassé de ${n} h`,
      ton: "destructive",
      enCours: true,
    };
  }
  const n = Math.ceil(h);
  return {
    libelle: `${n} h pour prévenir la CNIL`,
    ton: h < SEUIL_ORANGE_HEURES ? "warning" : "neutral",
    enCours: true,
  };
}

// ─── Chiffrement des textes libres ─────────────────────────────────────────

export function chiffrerChamps<T extends Partial<Record<ChampChiffre, string | null>>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const c of CHAMPS_CHIFFRES) {
    if (c in out) out[c] = encryptPii((out[c] as string | null | undefined) ?? null);
  }
  return out as T;
}

export function dechiffrerChamps<T extends Partial<Record<ChampChiffre, string | null>>>(
  ligne: T,
): T {
  const out: Record<string, unknown> = { ...ligne };
  for (const c of CHAMPS_CHIFFRES) {
    if (c in out) out[c] = decryptPii((out[c] as string | null | undefined) ?? null);
  }
  return out as T;
}

// ─── Le formulaire ─────────────────────────────────────────────────────────

const MAX = 5000;

const texteLibre = z
  .string()
  .max(MAX, `${MAX} caractères au plus`)
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));

const dateParis = (requis: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || v.trim() === "") {
        if (requis) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "date manquante" });
        return null;
      }
      const d = fromParisLocalInput(v);
      if (!d) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "date illisible" });
      return d;
    });

const ouiNon = z
  .enum(["", "oui", "non"])
  .optional()
  .transform((v) => (v === "oui" ? true : v === "non" ? false : null));

export const formulaireIncident = z
  .object({
    decouvertLe: dateParis(true),
    survenuLe: dateParis(false),
    description: z
      .string({ required_error: "description manquante" })
      .trim()
      .min(1, "description manquante")
      .max(MAX, `${MAX} caractères au plus`),
    donneesConcernees: texteLibre,
    nombrePersonnes: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v || v.trim() === "") return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 100_000_000) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "nombre entier attendu" });
          return null;
        }
        return n;
      }),
    categoriesPersonnes: texteLibre,
    consequences: texteLibre,
    mesuresPrises: texteLibre,
    declareCnil: ouiNon,
    declareCnilLe: dateParis(false),
    motifNonDeclaration: texteLibre,
    personnesPrevenues: ouiNon,
    personnesPrevenuesLe: dateParis(false),
    motifNonInformation: texteLibre,
  })
  .superRefine((v, ctx) => {
    if (v.declareCnil === false && !v.motifNonDeclaration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["motifNonDeclaration"],
        message: "dites pourquoi la CNIL n'est pas prévenue",
      });
    }
    if (v.personnesPrevenues === false && !v.motifNonInformation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["motifNonInformation"],
        message: "dites pourquoi les personnes ne sont pas prévenues",
      });
    }
  })
  .transform((v) => ({
    ...v,
    decouvertLe: v.decouvertLe as Date,
    declareCnilLe: v.declareCnil === true ? v.declareCnilLe : null,
    motifNonDeclaration: v.declareCnil === false ? v.motifNonDeclaration : null,
    personnesPrevenuesLe: v.personnesPrevenues === true ? v.personnesPrevenuesLe : null,
    motifNonInformation: v.personnesPrevenues === false ? v.motifNonInformation : null,
  }));

export type SaisieIncident = z.output<typeof formulaireIncident>;

const LIBELLES: Readonly<Record<string, string>> = {
  decouvertLe: "Découvert le",
  survenuLe: "Survenu le",
  description: "Ce qui s'est passé",
  donneesConcernees: "Données touchées",
  nombrePersonnes: "Combien de personnes",
  categoriesPersonnes: "Qui est touché",
  consequences: "Conséquences",
  mesuresPrises: "Ce qui a été fait",
  declareCnilLe: "Date de la déclaration",
  motifNonDeclaration: "Pourquoi pas la CNIL",
  personnesPrevenuesLe: "Date de l'information",
  motifNonInformation: "Pourquoi pas les personnes",
};

/** Lit le formulaire. Le message d'erreur ne reprend JAMAIS la saisie. */
export function lireFormulaireIncident(
  formData: FormData,
): { ok: true; saisie: SaisieIncident } | { ok: false; erreur: string } {
  const brut: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") brut[k] = v;
  const r = formulaireIncident.safeParse(brut);
  if (r.success) return { ok: true, saisie: r.data };
  const premier = r.error.issues[0];
  const champ = premier ? (LIBELLES[String(premier.path[0])] ?? "Formulaire") : "Formulaire";
  return { ok: false, erreur: `${champ} : ${premier?.message ?? "invalide"}.` };
}
