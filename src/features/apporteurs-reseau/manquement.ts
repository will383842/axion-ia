// Réseau d'apporteurs — MANQUEMENT ou FRAUDE sur une affaire (contrat 2.3, art. 4.5 bis).
//
// « Aucune commission n'est due au titre d'une affaire pour laquelle l'Apporteur a manqué à
// l'article 3.7 (déclaration non sincère) ou à l'article 8.4 (intérêt non déclaré), ni en cas de
// fraude ; les commissions déjà versées font l'objet d'une reprise (art. 4.5). Le manquement est
// notifié à l'Apporteur avec les faits qui le fondent ; il peut le contester par écrit, et la
// Société y répond de façon motivée dans les trente jours. »
//
// Un seul geste, sur la présentation, avec les FAITS (obligatoires) :
//   · la présentation en cours passe « démentie » ;
//   · commission pas encore facturée → ANNULÉE (la ligne reste, part du parrain comprise) ;
//   · facturée mais pas encore versée → BLOQUÉE (suspendue : jamais virée tant qu'elle l'est) ;
//   · déjà versée → REPRISE du montant restant, déduite de la prochaine autofacture ;
//   · l'apporteur reçoit les faits et la façon de contester ; tout est tracé au journal.
// Rien n'est supprimé.

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { annulerCommission } from "./ajustement";
import { envoyer } from "./envois";
import { litigeDisponible } from "./litige";
import { enregistrerReprise, PREFIXE_PALIER_REPRISE } from "./resiliation";

export const FAITS_MIN = 10;
export const FAITS_MAX = 1500;

export interface BilanManquement {
  annulees: number;
  bloquees: number;
  reprises: number;
}

export async function constaterManquement(e: {
  presentationId: string;
  faits: string;
  acteurId?: string | null;
  maintenant?: Date;
}): Promise<
  { ok: true; message: string; bilan: BilanManquement } | { ok: false; message: string }
> {
  const maintenant = e.maintenant ?? new Date();
  const faits = e.faits.trim().slice(0, FAITS_MAX);
  if (faits.length < FAITS_MIN)
    return { ok: false, message: "Décrivez les faits qui fondent le manquement (art. 4.5 bis)." };
  const p = await prisma.presentationEntreprise.findUnique({
    where: { id: e.presentationId },
    select: { id: true, apporteurId: true, statut: true },
  });
  if (!p) return { ok: false, message: "Présentation introuvable." };
  const motif = `Art. 4.5 bis : ${faits}`.slice(0, 300);

  await prisma.presentationEntreprise.updateMany({
    where: { id: p.id, statut: { in: ["reservee", "confirmee"] } },
    data: { statut: "dementie" },
  });

  const lignes = await prisma.commissionApporteur.findMany({
    where: { presentationId: p.id, parrainage: false },
    select: {
      id: true,
      statut: true,
      montantCents: true,
      autofactureNumero: true,
      factureId: true,
    },
  });
  const bilan: BilanManquement = { annulees: 0, bloquees: 0, reprises: 0 };
  const avecLitige = await litigeDisponible();

  for (const l of lignes) {
    // La part du parrain née de la même facture suit la commission de l'affaire.
    const parts = await prisma.commissionApporteur.findMany({
      where: { factureId: l.factureId, parrainage: true },
      select: {
        id: true,
        statut: true,
        montantCents: true,
        autofactureNumero: true,
        apporteurId: true,
      },
    });
    if (!l.autofactureNumero && ["a_qualifier", "due", "en_attente_vigilance"].includes(l.statut)) {
      const r = await annulerCommission(l.id, motif, e.acteurId ?? null);
      if (r.ok) bilan.annulees += 1;
      continue;
    }
    for (const c of [{ ...l, apporteurId: p.apporteurId }, ...parts]) {
      if (
        c.id !== l.id &&
        !c.autofactureNumero &&
        ["a_qualifier", "due", "en_attente_vigilance"].includes(c.statut)
      ) {
        const r = await annulerCommission(c.id, motif, e.acteurId ?? null);
        if (r.ok) bilan.annulees += 1;
      } else if (c.statut === "due" && c.autofactureNumero && avecLitige) {
        const r = await prisma.commissionApporteur.updateMany({
          where: { id: c.id, statut: "due", litigeDepuis: null },
          data: { litigeDepuis: maintenant, litigeMotif: motif },
        });
        bilan.bloquees += r.count;
      } else if (c.statut === "versee" && (c.montantCents ?? 0) > 0) {
        const deja = await prisma.commissionApporteur.findMany({
          where: { apporteurId: c.apporteurId, palier: `${PREFIXE_PALIER_REPRISE}${c.id}` },
          select: { montantCents: true },
        });
        const restant =
          (c.montantCents ?? 0) - deja.reduce((s, x) => s + Math.abs(x.montantCents ?? 0), 0);
        if (restant <= 0) continue;
        const r = await enregistrerReprise({
          commissionId: c.id,
          apporteurId: c.apporteurId,
          demandeeCents: restant,
          motif,
          annulationLe: maintenant,
          maintenant,
        });
        if (r.ok) bilan.reprises += 1;
      }
    }
  }

  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: e.acteurId ?? null,
        action: "presentation_entreprise.manquement",
        targetType: "presentation_entreprise",
        targetId: p.id,
        changes: { faits, statutAvant: p.statut, ...bilan },
      },
    });
  } catch {
    // La trace ne fait jamais échouer le geste.
  }

  // Notification avec les faits (art. 4.5 bis) : jamais bloquante.
  try {
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: p.apporteurId },
      select: { prenom: true, email: true },
    });
    const destinataire = a ? (decryptPii(a.email) ?? "") : "";
    if (destinataire) {
      await envoyer({
        gabarit: "apporteur-manquement",
        destinataire,
        payload: { contactName: decryptPii(a!.prenom) ?? "", faits },
        entityType: "PresentationEntreprise",
        entityId: p.id,
        jobId: `apporteur-manquement-${p.id}-${maintenant.getTime()}`,
      });
    }
  } catch {
    // Prévenir ne doit jamais faire échouer le geste.
  }

  return {
    ok: true,
    bilan,
    message: `Manquement notifié à l'apporteur : ${bilan.annulees} commission(s) annulée(s), ${bilan.bloquees} bloquée(s), ${bilan.reprises} reprise(s). Il peut contester par écrit : réponse motivée sous 30 jours.`,
  };
}
