/**
 * « Ajouter un candidat formateur » en console — les règles PURES (lot L0c-3).
 *
 * Calque de la saisie manuelle des apporteurs (`lib/commercial-application/
 * saisie-manuelle.ts`) : liste FERMÉE d'origines, invitation seulement sur un
 * geste explicite, accord exigé quand l'adresse vient d'ailleurs.
 *
 * 🔑 ADRESSE RELAIS. Indeed et d'autres plateformes donnent une adresse de
 * relais, la même pour des personnes différentes ou changeante d'une annonce à
 * l'autre : son empreinte n'identifie PERSONNE. Elle n'arrête donc jamais rien
 * (aucun doublon, aucune opposition rapprochée par elle) ; le rattachement d'un
 * échange se fait par le marqueur `fa-<id>` du lien. « Adresse réelle, si vous
 * l'avez » la remplace pour les envois et pour l'empreinte.
 *
 * Module pur.
 */

import { z } from "zod";

export const ORIGINES_CANDIDAT_FORMATEUR: ReadonlyArray<{
  readonly id: string;
  readonly libelle: string;
}> = [
  { id: "salon", libelle: "Rencontré sur un salon ou un événement" },
  { id: "recommandation", libelle: "Recommandé par quelqu'un" },
  { id: "linkedin", libelle: "LinkedIn" },
  { id: "indeed", libelle: "Indeed" },
  { id: "autre", libelle: "Autre" },
];

/** Adresse venue d'ailleurs : pas d'invitation sans l'accord de la personne (L.34-5 CPCE). */
export const ORIGINES_ACCORD_REQUIS_FORMATEUR: ReadonlyArray<string> = ["recommandation", "autre"];

/** Domaines d'adresses RELAIS (liste tenue ici, et seulement ici). */
export const DOMAINES_RELAIS: ReadonlyArray<string> = ["indeedemail.com", "indeed.com"];

export function estAdresseRelais(email: string): boolean {
  const domaine = email.trim().toLowerCase().split("@")[1] ?? "";
  return DOMAINES_RELAIS.some((d) => domaine === d || domaine.endsWith(`.${d}`));
}

const vide = (v: unknown) => (v === "" || v == null ? undefined : v);

export const saisieCandidatFormateurSchema = z.object({
  prenom: z.string().trim().min(1).max(100),
  nom: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(180),
  telephone: z.preprocess(vide, z.string().trim().max(40).optional()),
  origine: z.enum(["salon", "recommandation", "linkedin", "indeed", "autre"]),
  adresseReelle: z.preprocess(vide, z.string().trim().email().max(180).optional()),
  envoyerInvitation: z.boolean().default(false),
  accordContact: z.boolean().default(false),
});

export type SaisieCandidatFormateur = z.infer<typeof saisieCandidatFormateurSchema>;

export type SaisiePreparee =
  | {
      ok: true;
      saisie: SaisieCandidatFormateur;
      relais: boolean;
      /** L'adresse à laquelle on écrit. */
      adresseEnvoi: string;
      /** L'adresse dont on prend l'empreinte (doublons, oppositions), ou `null` (relais seul). */
      empreinteSur: string | null;
    }
  | { ok: false; message: string };

export function preparerSaisieCandidatFormateur(brut: unknown): SaisiePreparee {
  const p = saisieCandidatFormateurSchema.safeParse(brut);
  if (!p.success) {
    return {
      ok: false,
      message: "Un prénom, un nom, une adresse e-mail valide et une origine sont nécessaires.",
    };
  }
  const d = p.data;
  if (
    d.envoyerInvitation &&
    ORIGINES_ACCORD_REQUIS_FORMATEUR.includes(d.origine) &&
    !d.accordContact
  ) {
    return {
      ok: false,
      message:
        "Pour inviter une personne dont l'adresse vient d'ailleurs, cochez « La personne a accepté d'être contactée ».",
    };
  }
  const relais = estAdresseRelais(d.email);
  const reelle = d.adresseReelle && !estAdresseRelais(d.adresseReelle) ? d.adresseReelle : null;
  const adresseEnvoi = reelle ?? d.email;
  return {
    ok: true,
    saisie: d,
    relais,
    adresseEnvoi,
    empreinteSur: reelle ?? (relais ? null : d.email),
  };
}
