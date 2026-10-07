/**
 * Réseau d'apporteurs — la DÉCLARATION D'ENTREPRISE par formulaire (contrat v2, art. 3.2).
 *
 * Règles PURES (aucun accès base, aucun `server-only`) : le même schéma sert la validation
 * côté serveur et les tests. Champs obligatoires de l'article 3.2 : identification de
 * l'entreprise, SIREN, nom ET fonction de la personne rencontrée, son e-mail ET son
 * téléphone, et la date du contact (jamais dans le futur).
 */

import { z } from "zod";

import { finDeProtection, sirenValide } from "./regles";

// Aucun plafond par apporteur : le contrat (art. 3.7) n'en connaît aucun, et nulle suspension ne
// peut reposer sur le nombre de déclarations. Seule la limite par adresse IP hachée (anti-robot,
// côté route) subsiste.

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

/**
 * L'état montré à l'apporteur : jamais d'autre information que la sienne.
 *
 * 2026-10-07 (décision de Will) : un état EN CLAIR, avec la date de fin.
 *   · « À l'étude » : déclaration reçue, pas encore traitée ;
 *   · « Réservée jusqu'au … » : six mois À COMPTER DE LA DÉCLARATION (contrat 2.2,
 *     art. 3.4) — la date enregistrée à la confirmation fait foi quand elle existe ;
 *   · « Non disponible » : déjà présentée ou déjà connue, ou hors champ ;
 *   · « Expirée » : période échue (ou attribution terminée), avec sa date de fin.
 */
export type EtatDeclaration = "a_l_etude" | "reservee" | "non_disponible" | "expiree";

export const LIBELLE_ETAT_DECLARATION: Record<EtatDeclaration, string> = {
  a_l_etude: "À l'étude",
  reservee: "Réservée",
  non_disponible: "Non disponible",
  expiree: "Expirée",
};

/** `null` pour un état qu'on ne montre pas (démentie : un litige ne s'affiche pas). */
export function etatPourApporteur(
  p: {
    statut: string;
    contactEnvoyeAt: Date | null;
    recueAt: Date;
    protegeeJusquAt: Date | null;
  },
  maintenant: Date = new Date(),
): { etat: EtatDeclaration; jusquAu: Date | null } | null {
  const fin = p.protegeeJusquAt ?? finDeProtection(p.recueAt);
  switch (p.statut) {
    case "reservee":
      if (!p.contactEnvoyeAt) return { etat: "a_l_etude", jusquAu: null };
      return { etat: fin.getTime() < maintenant.getTime() ? "expiree" : "reservee", jusquAu: fin };
    case "confirmee":
      return { etat: fin.getTime() < maintenant.getTime() ? "expiree" : "reservee", jusquAu: fin };
    case "terminee":
      return { etat: "expiree", jusquAu: fin };
    case "deja_connue":
    case "hors_champ":
      return { etat: "non_disponible", jusquAu: null };
    default:
      return null;
  }
}
