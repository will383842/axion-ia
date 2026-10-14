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
 *
 * Lot 8B — chaque relevé dont le F37 a été traité porte une trace au journal
 * d'activité ; le suivi quotidien reprend les relevés payés sans trace (lot
 * « Virements faits » interrompu avant l'envoi, file indisponible).
 */

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { envoyer } from "@/server/qualiopi/formateurs-independants/envois";

/** Lot 8B — le F37 de ce relevé est traité (enfilé, garé, retenu ou écarté par une garde). */
export const ACTION_F37_TRAITE = "qualiopi.formateur.f37_traite";
/** La reprise ne touche pas un lot en cours : payé depuis 30 minutes au moins… */
const REPRISE_F37_APRES_MS = 30 * 60 * 1000;
/** … et depuis 7 jours au plus (au-delà, un e-mail « virement effectué » n'apprend plus rien). */
const REPRISE_F37_FENETRE_MS = 7 * 24 * 60 * 60 * 1000;
/** Un F37 de l'ancien code part dans l'heure du paiement (fin du lot). */
const F37_ANCIEN_DANS_MS = 60 * 60 * 1000;

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
      const r = await envoyer({
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
      }).catch(() => "indisponible" as const);
      // « indisponible » seul est repris : les autres issues sont des décisions (texte
      // non validé, fin de collaboration…) que la reprise ne doit pas contourner.
      if (r === "indisponible") continue;
      for (const l of lot) {
        await journaliser(prisma, {
          action: ACTION_F37_TRAITE,
          targetType: "TrainerStatement",
          targetId: l.id,
          changes: { resultat: r },
          session: null,
        });
      }
    }
  } catch {
    // Lecture en échec : rien n'est envoyé, le virement reste acquis.
  }
}

/**
 * Lot 8B — reprise de F37 (relecture de #1514). Un lot « Virements faits » interrompu
 * (délai dépassé) laissait des relevés payés sans F37, et un rejeu les trouvait payés :
 * l'e-mail était perdu. Au passage quotidien, les relevés de mission payés depuis 30 min
 * à 7 jours, sans trace F37, partent une fois (même chemin, même clé d'idempotence pour
 * le même ensemble de relevés). Un relevé payé avant la trace dont un F37 est parti
 * dans l'heure n'est pas repris. Rend le nombre de relevés repris ; ne lève jamais.
 */
export async function reprendreVirementsFaitsSansF37(maintenant: Date): Promise<number> {
  try {
    const payes = await prisma.trainerStatement.findMany({
      where: {
        statut: "paye",
        origine: "passage_mission",
        avoirDeId: null,
        payeAt: {
          gte: new Date(maintenant.getTime() - REPRISE_F37_FENETRE_MS),
          lte: new Date(maintenant.getTime() - REPRISE_F37_APRES_MS),
        },
      },
      select: { id: true, trainerId: true, payeAt: true },
      take: 200,
    });
    if (payes.length === 0) return 0;
    const tracees = new Set(
      (
        await prisma.activityLog.findMany({
          where: { action: ACTION_F37_TRAITE, targetId: { in: payes.map((p) => p.id) } },
          select: { targetId: true },
        })
      ).map((t) => t.targetId),
    );
    const aReprendre: string[] = [];
    for (const p of payes) {
      if (tracees.has(p.id) || p.payeAt === null) continue;
      const ancien = await prisma.emailLog.count({
        where: {
          template: "formateur-virement-fait",
          entityType: "Trainer",
          entityId: p.trainerId,
          status: { not: "failed" },
          createdAt: { gte: p.payeAt, lte: new Date(p.payeAt.getTime() + F37_ANCIEN_DANS_MS) },
        },
      });
      if (ancien === 0) aReprendre.push(p.id);
    }
    if (aReprendre.length > 0) await envoyerVirementsFaits(aReprendre);
    return aReprendre.length;
  } catch {
    return 0;
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
