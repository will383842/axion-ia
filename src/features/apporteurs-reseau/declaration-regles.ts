/**
 * Réseau d'apporteurs — la DÉCLARATION D'ENTREPRISE par formulaire (contrat v2, art. 3.2).
 *
 * Règles PURES (aucun accès base, aucun `server-only`) : le même schéma sert la validation
 * côté serveur et les tests. Champs obligatoires de l'article 3.2 : identification de
 * l'entreprise, SIREN, nom ET fonction de la personne rencontrée, son e-mail ET son
 * téléphone, et la date du contact (jamais dans le futur).
 */

import { z } from "zod";

import { sirenValide } from "./regles";

/** Au plus 20 déclarations par apporteur et par 24 heures. */
export const DECLARATIONS_MAX_PAR_JOUR = 20;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEPHONE = /^[0-9+().\s-]{6,30}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** « AAAA-MM-JJ » de ce jour en heure de Paris. */
export function aujourdhuiParis(maintenant: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(maintenant);
}

/** La date existe-t-elle au calendrier, et n'est-elle ni future ni antérieure à 2020 ? */
export function dateContactValide(brut: string, maintenant: Date): boolean {
  if (!DATE.test(brut)) return false;
  const d = new Date(`${brut}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== brut) return false;
  return brut >= "2020-01-01" && brut <= aujourdhuiParis(maintenant);
}

const texte = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max, message);

export function schemaDeclaration(maintenant: Date) {
  return z.object({
    siren: z
      .string()
      .transform((v) => v.replace(/\s+/g, ""))
      .refine(sirenValide, "Ce numéro SIREN n'est pas valide : vérifiez les 9 chiffres."),
    denomination: texte(2, 250, "Indiquez le nom de l'entreprise."),
    personneNom: texte(2, 150, "Indiquez le nom de la personne rencontrée."),
    personneFonction: texte(2, 150, "Indiquez sa fonction."),
    personneEmail: z
      .string()
      .trim()
      .max(254, "Cette adresse e-mail n'est pas valide.")
      .refine((v) => EMAIL.test(v), "Cette adresse e-mail n'est pas valide."),
    personneTelephone: z
      .string()
      .trim()
      .refine(
        (v) => TELEPHONE.test(v) && v.replace(/\D/g, "").length >= 6,
        "Ce numéro de téléphone n'est pas valide.",
      ),
    dateContact: z
      .string()
      .trim()
      .refine(
        (v) => dateContactValide(v, maintenant),
        "Indiquez la date du contact (pas dans le futur).",
      ),
  });
}

export type DeclarationValide = z.infer<ReturnType<typeof schemaDeclaration>>;

/** Première erreur lisible, ou la déclaration nettoyée. */
export function validerDeclaration(
  brut: Record<string, unknown>,
  maintenant: Date,
): { ok: true; valeur: DeclarationValide } | { ok: false; message: string } {
  const entree: Record<string, string> = {};
  for (const k of [
    "siren",
    "denomination",
    "personneNom",
    "personneFonction",
    "personneEmail",
    "personneTelephone",
    "dateContact",
  ]) {
    const v = brut[k];
    entree[k] = typeof v === "string" ? v : "";
  }
  const r = schemaDeclaration(maintenant).safeParse(entree);
  if (r.success) return { ok: true, valeur: r.data };
  return { ok: false, message: r.error.issues[0]?.message ?? "Vérifiez les champs." };
}

/** L'état montré à l'apporteur : jamais d'autre information que la sienne. */
export type EtatDeclaration = "recue" | "bien_recue" | "deja_connue" | "hors_champ";

export const LIBELLE_ETAT_DECLARATION: Record<EtatDeclaration, string> = {
  recue: "Reçue",
  bien_recue: "Bien reçue",
  deja_connue: "Déjà connue",
  hors_champ: "Hors champ",
};

/** `null` pour un état qu'on ne montre pas (démentie, terminée). */
export function etatPourApporteur(p: {
  statut: string;
  contactEnvoyeAt: Date | null;
}): EtatDeclaration | null {
  switch (p.statut) {
    case "reservee":
      return p.contactEnvoyeAt ? "bien_recue" : "recue";
    case "confirmee":
      return "bien_recue";
    case "deja_connue":
      return "deja_connue";
    case "hors_champ":
      return "hors_champ";
    default:
      return null;
  }
}
