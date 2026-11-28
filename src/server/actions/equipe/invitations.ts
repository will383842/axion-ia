"use server";

/**
 * Invitations au questionnaire des collaborateurs depuis la console : fines enveloppes autour de
 * `@/server/equipe/questionnaire/inviter`. Rôle administrateur revérifié dans CHAQUE action.
 */
import { z } from "zod";

import { TEAM_CATEGORY_SLUGS } from "@/lib/equipe/donnees";
import { exigerAdministrateur } from "@/server/equipe-garde";
import {
  inviterCollaborateur,
  renvoyerInvitation,
  revoquerInvitation,
} from "@/server/equipe/questionnaire/inviter";

import type { ResultatAction } from "./collaborateurs";

const ERREUR_ACCES = "Accès réservé aux administrateurs.";

const envoiSchema = z.object({
  categorie: z.enum(TEAM_CATEGORY_SLUGS as [string, ...string[]]),
  email: z.string().trim().email().max(254),
  prenom: z.string().trim().max(80).optional(),
});

async function acteur(): Promise<string | null> {
  try {
    return (await exigerAdministrateur()).userId;
  } catch {
    return null;
  }
}

export async function envoyerQuestionnaireAction(entree: unknown): Promise<ResultatAction> {
  const admin = await acteur();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  const p = envoiSchema.safeParse(entree);
  if (!p.success) return { ok: false, erreur: "Catégorie ou adresse e-mail invalide." };
  const r = await inviterCollaborateur({
    categorie: p.data.categorie as never,
    email: p.data.email,
    ...(p.data.prenom ? { prenom: p.data.prenom } : {}),
    source: "console",
    acteur: admin,
  });
  if (!r.ok) {
    return {
      ok: false,
      erreur:
        r.raison === "envoi"
          ? "L'e-mail n'a pas pu partir : rien n'a été envoyé, réessayez."
          : "Catégorie ou adresse e-mail invalide.",
    };
  }
  return { ok: true };
}

export async function renvoyerQuestionnaireAction(id: unknown): Promise<ResultatAction> {
  const admin = await acteur();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  const idp = z.string().uuid().safeParse(id);
  if (!idp.success) return { ok: false, erreur: "Invitation introuvable." };
  const r = await renvoyerInvitation(idp.data, admin);
  if (!r.ok) return { ok: false, erreur: "Impossible de renvoyer cette invitation." };
  return { ok: true };
}

export async function revoquerQuestionnaireAction(id: unknown): Promise<ResultatAction> {
  const admin = await acteur();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  const idp = z.string().uuid().safeParse(id);
  if (!idp.success) return { ok: false, erreur: "Invitation introuvable." };
  const ok = await revoquerInvitation(idp.data);
  if (!ok) return { ok: false, erreur: "Cette invitation n'est plus active." };
  return { ok: true };
}
