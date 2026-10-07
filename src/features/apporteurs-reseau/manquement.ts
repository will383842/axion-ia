// Réseau d'apporteurs — MANQUEMENT ou FRAUDE sur une affaire (contrat 2.3, art. 4.5 bis).
//
// « Aucune commission n'est due au titre d'une affaire pour laquelle l'Apporteur a manqué à
// l'article 3.7 (déclaration non sincère) ou à l'article 8.4 (intérêt non déclaré), ni en cas de
// fraude ; les commissions déjà versées font l'objet d'une reprise (art. 4.5). Le manquement est
// notifié à l'Apporteur avec les faits qui le fondent ; il peut le contester par écrit, et la
// Société y répond de façon motivée dans les trente jours. »
//
// Un seul geste PAR PRÉSENTATION (un second constat est refusé), avec les FAITS (obligatoires) :
//   · la présentation (en cours OU terminée) passe « démentie » : le passage quotidien ne crée
//     plus aucune commission sur cette affaire ;
//   · chaque commission de l'affaire, PART DU PARRAIN COMPRISE, selon son état :
//       - pas encore facturée → ANNULÉE (la ligne reste) ;
//       - facturée, pas encore versée → RETENUE (statut propre « retenue », hors des virements à
//         faire, non levable par le geste du litige) et NEUTRALISÉE par un AVOIR numéroté qui
//         renvoie à l'autofacture (art. 4.5) ; le reste de l'autofacture est versé par complément ;
//       - déjà versée → REPRISE du montant restant, déduite de la prochaine autofacture ;
//   · l'apporteur reçoit les faits et la façon de contester (UNE fois) ; le parrain dont la part
//     est retirée reçoit un simple avis, SANS les faits ; tout est tracé au journal.
// Rien n'est supprimé.

import { randomUUID } from "node:crypto";

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { dateFr } from "./autofacture-donnees";
import { allouerNumerosAutofacture, genererPdfAutofacture, moisParis } from "./commissions";
import { envoyer } from "./envois";
import { enregistrerReprise, PREFIXE_PALIER_REPRISE } from "./resiliation";
import { signalerErreurReseau } from "./signaler";

export const FAITS_MIN = 10;
export const FAITS_MAX = 1500;
const ACTION = "presentation_entreprise.manquement";
const MODIFIABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;

export interface BilanManquement {
  annulees: number;
  retenues: number;
  reprises: number;
  avertissements: string[];
}

interface LigneAffaire {
  id: string;
  apporteurId: string;
  statut: string;
  montantCents: number | null;
  autofactureNumero: string | null;
  autofactureEmiseAt: Date | null;
  parrainage: boolean;
}

type Piece = { r2Key: string; filename: string };

async function tracer(
  action: string,
  type: string,
  id: string,
  acteurId: string | null,
  changes: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteurId,
        action,
        targetType: type,
        targetId: id,
        changes: changes as object,
      },
    });
  } catch {
    // La trace ne fait jamais échouer le geste.
  }
}

/**
 * RETENUE : la ligne facturée (non versée) passe « retenue », et un AVOIR la neutralise sur son
 * autofacture. L'avoir est une ligne de reprise rattachée à l'autofacture et déjà SOLDÉE (elle
 * n'est jamais déduite ailleurs) ; le virement du reste se calcule par complément.
 */
async function retenir(
  l: LigneAffaire,
  motif: string,
  maintenant: Date,
): Promise<{ ok: boolean; avoir?: Piece; avertissement?: string }> {
  const montant = l.montantCents ?? 0;
  const [numeroAvoir] = await allouerNumerosAutofacture(
    Number(moisParis(maintenant).slice(0, 4)),
    1,
  );
  const repriseId = await prisma.$transaction(async (tx) => {
    const r = await tx.commissionApporteur.updateMany({
      where: { id: l.id, statut: "due", autofactureNumero: l.autofactureNumero, verseeAt: null },
      data: { statut: "retenue" },
    });
    if (r.count !== 1) return null;
    const rep = await tx.commissionApporteur.create({
      data: {
        apporteurId: l.apporteurId,
        factureId: randomUUID(),
        parrainage: l.parrainage,
        activite: "reprise",
        palier: `${PREFIXE_PALIER_REPRISE}${l.id}`,
        factureHtCents: 0,
        montantCents: -montant,
        statut: "reprise",
        releveMois: moisParis(maintenant),
        autofactureNumero: l.autofactureNumero,
        autofactureEmiseAt: maintenant,
        avoirNumero: numeroAvoir!,
        // Soldée d'office : elle neutralise la ligne retenue, elle n'est déduite de rien d'autre.
        verseeAt: maintenant,
      },
      select: { id: true },
    });
    return rep.id;
  });
  if (!repriseId) return { ok: false };
  const pdf = await genererPdfAutofacture({
    apporteurId: l.apporteurId,
    numero: numeroAvoir!,
    periodeLibelle: `annulation pour manquement au ${dateFr(maintenant)} (art. 4.5 bis)`,
    commissionIds: [repriseId],
    totalCents: montant,
    maintenant,
    avoir: {
      factureInitiale: l.autofactureNumero ?? "non retrouvée",
      dateFactureInitiale: l.autofactureEmiseAt ? dateFr(l.autofactureEmiseAt) : null,
      imputation: `annule la ligne retenue de l'autofacture N° ${l.autofactureNumero ?? ""}`,
    },
  });
  if (!pdf) {
    signalerErreurReseau("manquement : avoir de neutralisation non établi", new Error(numeroAvoir));
    return {
      ok: true,
      avertissement: `L'avoir ${numeroAvoir} est enregistré mais son PDF n'a pas pu être établi : à régénérer.`,
    };
  }
  return { ok: true, avoir: { r2Key: pdf.r2Key, filename: pdf.filename } };
}

async function reprendre(l: LigneAffaire, motif: string, maintenant: Date): Promise<boolean> {
  const deja = await prisma.commissionApporteur.findMany({
    where: { apporteurId: l.apporteurId, palier: `${PREFIXE_PALIER_REPRISE}${l.id}` },
    select: { montantCents: true },
  });
  const restant =
    (l.montantCents ?? 0) - deja.reduce((s, x) => s + Math.abs(x.montantCents ?? 0), 0);
  if (restant <= 0) return false;
  const r = await enregistrerReprise({
    commissionId: l.id,
    apporteurId: l.apporteurId,
    demandeeCents: restant,
    motif,
    annulationLe: maintenant,
    maintenant,
  });
  return r.ok;
}

async function prevenir(
  apporteurId: string,
  presentationId: string,
  payload: Record<string, unknown>,
  jobId: string,
  pieces: readonly Piece[],
): Promise<void> {
  try {
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { prenom: true, email: true },
    });
    const destinataire = a ? (decryptPii(a.email) ?? "") : "";
    if (!destinataire) return;
    await envoyer({
      gabarit: "apporteur-manquement",
      destinataire,
      payload: { contactName: decryptPii(a!.prenom) ?? "", ...payload },
      entityType: "PresentationEntreprise",
      entityId: presentationId,
      jobId,
      ...(pieces.length
        ? {
            attachments: pieces.map((x) => ({
              filename: x.filename,
              r2Key: x.r2Key,
              contentType: "application/pdf",
            })),
          }
        : {}),
    });
  } catch {
    // Prévenir ne doit jamais faire échouer le geste.
  }
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
  const deja = await prisma.activityLog.findFirst({
    where: { action: ACTION, targetType: "presentation_entreprise", targetId: p.id },
    select: { id: true },
  });
  if (deja)
    return { ok: false, message: "Un manquement est déjà constaté sur cette présentation." };
  const motif = `Art. 4.5 bis : ${faits}`.slice(0, 300);
  const acteur = e.acteurId ?? null;

  // En cours OU terminée : plus aucune commission ne naîtra de cette affaire.
  await prisma.presentationEntreprise.updateMany({
    where: { id: p.id, statut: { in: ["reservee", "confirmee", "terminee"] } },
    data: { statut: "dementie" },
  });

  // Les commissions de l'affaire, et les parts du parrain nées des mêmes factures.
  const filleul = await prisma.commissionApporteur.findMany({
    where: { presentationId: p.id, parrainage: false },
    select: { factureId: true },
  });
  const factures = [...new Set(filleul.map((l) => l.factureId))];
  const lignes: LigneAffaire[] = factures.length
    ? (
        await prisma.commissionApporteur.findMany({
          where: { factureId: { in: factures } },
          select: {
            id: true,
            apporteurId: true,
            statut: true,
            montantCents: true,
            autofactureNumero: true,
            autofactureEmiseAt: true,
            parrainage: true,
          },
        })
      ).map((l) => ({ ...l }))
    : [];

  const bilan: BilanManquement = { annulees: 0, retenues: 0, reprises: 0, avertissements: [] };
  const piecesDe = new Map<string, Piece[]>();
  const parrains = new Set<string>();
  for (const l of lignes) {
    let touchee = false;
    if (!l.autofactureNumero && (MODIFIABLES as readonly string[]).includes(l.statut)) {
      const r = await prisma.commissionApporteur.updateMany({
        where: { id: l.id, autofactureNumero: null, statut: { in: [...MODIFIABLES] } },
        data: { statut: "annulee" },
      });
      if (r.count === 1) {
        bilan.annulees += 1;
        touchee = true;
        await tracer("commission_apporteur.annulee", "commission_apporteur", l.id, acteur, {
          statutAvant: l.statut,
          montantAvantCents: l.montantCents,
          motif,
        });
      }
    } else if (l.statut === "due" && l.autofactureNumero) {
      const r = await retenir(l, motif, maintenant);
      if (r.ok) {
        bilan.retenues += 1;
        touchee = true;
        if (r.avoir) piecesDe.set(l.apporteurId, [...(piecesDe.get(l.apporteurId) ?? []), r.avoir]);
        if (r.avertissement) bilan.avertissements.push(r.avertissement);
        await tracer("commission_apporteur.retenue", "commission_apporteur", l.id, acteur, {
          autofacture: l.autofactureNumero,
          montantCents: l.montantCents,
          motif,
        });
      }
    } else if (l.statut === "versee" && (l.montantCents ?? 0) > 0) {
      if (await reprendre(l, motif, maintenant)) {
        bilan.reprises += 1;
        touchee = true;
      }
    }
    if (touchee && l.parrainage && l.apporteurId !== p.apporteurId) parrains.add(l.apporteurId);
  }

  await tracer(ACTION, "presentation_entreprise", p.id, acteur, {
    faits,
    statutAvant: p.statut,
    annulees: bilan.annulees,
    retenues: bilan.retenues,
    reprises: bilan.reprises,
  });

  // UNE notification (clé stable) avec les faits ; le parrain, un simple avis sans les faits.
  await prevenir(
    p.apporteurId,
    p.id,
    { faits },
    `apporteur-manquement-${p.id}`,
    piecesDe.get(p.apporteurId) ?? [],
  );
  for (const parrain of parrains) {
    await prevenir(
      parrain,
      p.id,
      { parrain: true },
      `apporteur-manquement-${p.id}-parrain-${parrain}`,
      piecesDe.get(parrain) ?? [],
    );
  }

  const suite = bilan.avertissements.length ? ` ⚠️ ${bilan.avertissements.join(" ")}` : "";
  return {
    ok: true,
    bilan,
    message: `Manquement notifié à l'apporteur : ${bilan.annulees} commission(s) annulée(s), ${bilan.retenues} retenue(s) avec avoir, ${bilan.reprises} reprise(s). Il peut contester par écrit : réponse motivée sous 30 jours.${suite}`,
  };
}
