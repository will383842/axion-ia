/**
 * DEMANDE D'EFFACEMENT D'UN ABONNÉ DEPUIS LA CONSOLE.
 *
 * 🔴 DÉCISION DE WILLIAMS DU 11/11/2026 (fait foi) — PLUS AUCUNE SUPPRESSION.
 *
 * Jusqu'à cette date (lot L3, 2026-09-24), ce bouton supprimait l'abonné et ses demandes du
 * guide (`eraseNewsletterForEmail`), vidait la corbeille d'envoi (`eraseEmailTracesForEmail`) et
 * la file vers le CRM (`eraseCrmOutboxForEmail`). Audit RGPD du 11/11/2026, point E1.
 *
 * Désormais il MET LA PERSONNE À L'ÉCART, par le MÊME module que la route publique
 * (`server/rgpd/ecarter-au-lieu-d-effacer.ts`) : opposition, plus aucun envoi, plus aucune
 * réinscription, abonné « désabonné », contacts du guide écartés, CRM prévenu, preuve au journal
 * (`gdpr.erase.requested`, avec le motif saisi et le SHA-256 relu par la liste de suppression),
 * alerte dans la cloche. Données GARDÉES : l'effacement éventuel est un geste humain, à part.
 *
 * Le motif saisi est gardé au journal : le champ demande « sans adresse e-mail », sans quoi la
 * trace porterait l'adresse.
 *
 * ⚠️ Module serveur ordinaire, PAS `"use server"`.
 */

import { prisma } from "@/lib/prisma";
import { ecarterPourDemandeEffacement } from "@/server/rgpd/ecarter-au-lieu-d-effacer";

export type IssueEffacement =
  | {
      readonly ok: true;
      readonly abonnesEcartes: number;
      readonly contactsGuideEcartes: number;
      readonly etapesEnEchec: readonly string[];
      readonly crm: "ok" | "deferred" | "failed";
    }
  | { readonly ok: false; readonly erreur: "introuvable" };

export async function effacerAbonneDepuisConsole(entree: {
  readonly abonneId: string;
  readonly motif: string;
  readonly adminUserId: string;
  readonly ip?: string | null;
}): Promise<IssueEffacement> {
  const abonne = await prisma.newsletterSubscriber.findUnique({
    where: { id: entree.abonneId },
    select: { id: true, email: true },
  });
  if (!abonne) return { ok: false, erreur: "introuvable" };

  const r = await ecarterPourDemandeEffacement({
    email: abonne.email,
    origine: "console-lettre",
    adminUserId: entree.adminUserId,
    motif: entree.motif,
    ip: entree.ip ?? null,
    cible: { type: "newsletter_subscriber", id: abonne.id },
  });

  return {
    ok: true,
    abonnesEcartes: r.abonnesEcartes,
    contactsGuideEcartes: r.contactsGuideEcartes,
    etapesEnEchec: r.etapesEnEchec,
    crm: r.crm,
  };
}
