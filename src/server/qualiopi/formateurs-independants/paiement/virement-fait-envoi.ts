/**
 * Formateurs indépendants — F37 « Virement effectué » et F38 « Virement en
 * attente : attestation URSSAF » (lot D, M9 ; plan 08 §3, L12d).
 *
 * Seuls les relevés du paiement PAR MISSION sont annoncés : un relevé mensuel
 * payé n'envoie rien, comme avant. Tout passe par `envoyer` (texte validé exigé,
 * e-mails d'argent conservés après une fin de collaboration).
 *
 * 🔒 Aucune donnée bancaire n'entre dans un e-mail ni dans une clé d'envoi.
 * Un échec d'envoi ne remonte jamais : le virement, lui, est acquis.
 */

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { envoyer } from "@/server/qualiopi/formateurs-independants/envois";

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const MILLIERS = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** « 123 456,78 » à partir de centimes ENTIERS (aucune division flottante). */
export function montantEnTexte(cents: number): string {
  const signe = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const entiers = Math.floor(abs / 100);
  const reste = abs - entiers * 100;
  return `${signe}${MILLIERS.format(entiers)},${String(reste).padStart(2, "0")}`;
}

/**
 * F37 — un e-mail par formateur pour un lot de « Virements faits » : numéros
 * triés, somme des TTC payés, date du dernier virement. Clé d'idempotence
 * dérivée des relevés du lot (ordre indifférent) : un rejeu n'envoie rien de plus.
 */
export async function envoyerVirementsFaits(statementIds: ReadonlyArray<string>): Promise<void> {
  if (statementIds.length === 0) return;
  try {
    const payes = await prisma.trainerStatement.findMany({
      where: {
        id: { in: [...statementIds] },
        statut: "paye",
        origine: "passage_mission",
        avoirDeId: null,
      },
      select: {
        id: true,
        trainerId: true,
        numeroFacture: true,
        totalTtcCents: true,
        payeAt: true,
        trainer: { select: { email: true, prenom: true } },
      },
    });
    const parFormateur = new Map<string, typeof payes>();
    for (const p of payes)
      parFormateur.set(p.trainerId, [...(parFormateur.get(p.trainerId) ?? []), p]);
    for (const [trainerId, lot] of parFormateur) {
      const numeros = lot
        .map((l) => l.numeroFacture ?? "")
        .filter((n) => n !== "")
        .sort();
      const total = lot.reduce((s, l) => s + l.totalTtcCents, 0);
      const dernier = lot.map((l) => l.payeAt?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
      const empreinte = createHash("sha256")
        .update(
          lot
            .map((l) => l.id)
            .sort()
            .join(","),
        )
        .digest("hex")
        .slice(0, 24);
      const premier = lot[0]!;
      await envoyer({
        gabarit: "formateur-virement-fait",
        destinataire: premier.trainer.email,
        entityType: "Trainer",
        entityId: trainerId,
        jobId: `formateur-virement-fait-${empreinte}`,
        payload: {
          prenom: premier.trainer.prenom,
          valeurs: {
            numéro: numeros.join(", "),
            montant: montantEnTexte(total),
            date: DATE_LONGUE.format(new Date(dernier)),
          },
        },
      }).catch(() => undefined);
    }
  } catch {
    // Lecture en échec : rien n'est envoyé, le virement reste acquis.
  }
}

/**
 * F38 — la facture est due mais son virement attend une attestation URSSAF à
 * jour (échue à la date de la mission). Une fois par facture. `ignore` : relevé
 * mensuel, déjà payé ou sans numéro.
 */
export async function envoyerVirementEnAttente(
  statementId: string,
): Promise<Awaited<ReturnType<typeof envoyer>> | "ignore"> {
  const r = await prisma.trainerStatement.findUnique({
    where: { id: statementId },
    select: {
      id: true,
      trainerId: true,
      statut: true,
      origine: true,
      numeroFacture: true,
      payeAt: true,
      trainer: { select: { email: true, prenom: true } },
    },
  });
  if (
    r === null ||
    r.origine !== "passage_mission" ||
    r.statut === "paye" ||
    r.statut === "annule" ||
    r.payeAt !== null ||
    !r.numeroFacture
  ) {
    return "ignore";
  }
  return envoyer({
    gabarit: "formateur-virement-en-attente",
    destinataire: r.trainer.email,
    entityType: "Trainer",
    entityId: r.trainerId,
    jobId: `formateur-virement-en-attente-${r.id}`,
    payload: { prenom: r.trainer.prenom, valeurs: { numéro: r.numeroFacture } },
  });
}
