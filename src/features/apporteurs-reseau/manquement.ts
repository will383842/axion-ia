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

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { existsInR2 } from "@/lib/r2-storage";
import { enqueueEmail } from "@/server/queue/queues";

import { dateFr } from "./autofacture-donnees";
import {
  ACTIVITE_NEUTRALISATION,
  allouerNumerosAutofacture,
  dejaEnvoye,
  genererPdfAutofacture,
  moisParis,
  verrouillerSerieAutofacture,
} from "./commissions";
import { aVirerPartielCents } from "./autofacture-donnees";
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
    await verrouillerSerieAutofacture(tx, [numeroAvoir!]);
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
        // Marque propre : exclue de la DAS2 (la ligne retenue n'a jamais été versée).
        activite: ACTIVITE_NEUTRALISATION,
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
  await libererReprisesBloquees(l.autofactureNumero!, l.apporteurId);
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

/**
 * Cas de bord : une fois la ligne retenue, l'autofacture peut n'avoir plus assez de lignes libres
 * pour absorber les reprises qui y étaient imputées sans être versées. Ces reprises ne seraient
 * plus jamais déduites (créance perdue, art. 12.4) : elles sont LIBÉRÉES pour être réimputées sur
 * la prochaine autofacture, et la libération est tracée.
 */
async function libererReprisesBloquees(numero: string, apporteurId: string): Promise<void> {
  const lignes = await prisma.commissionApporteur.findMany({
    where: { apporteurId, autofactureNumero: numero },
    select: {
      id: true,
      statut: true,
      montantCents: true,
      avoirNumero: true,
      verseeAt: true,
      activite: true,
    },
  });
  const libres = lignes.filter((x) => x.statut === "due");
  const enAttente = lignes.filter(
    (x) => x.statut === "reprise" && !x.verseeAt && x.activite !== ACTIVITE_NEUTRALISATION,
  );
  if (enAttente.length === 0) return;
  const retenues = lignes.filter((x) => x.statut === "retenue").map((x) => x.montantCents ?? 0);
  // Sans TVA connue ici : le contrôle porte sur le signe, identique HT ou TTC.
  const p = aVirerPartielCents(null, [...libres, ...enAttente], retenues);
  if (libres.length > 0 && p.partielPossible) return;
  for (const r of enAttente) {
    const u = await prisma.commissionApporteur.updateMany({
      where: { id: r.id, statut: "reprise", verseeAt: null, autofactureNumero: numero },
      data: { releveMois: null, autofactureNumero: null, avoirNumero: null },
    });
    if (u.count === 1)
      await tracer("commission_apporteur.reprise_liberee", "commission_apporteur", r.id, null, {
        autofacture: numero,
        avoirSansEffet: r.avoirNumero,
        motif: "Ligne retenue (art. 4.5 bis) : reprise réimputée sur la prochaine autofacture.",
      });
  }
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

/**
 * RATTRAPAGE (passage horaire) : un avoir de neutralisation dont le PDF n'a pas pu être établi
 * (numéro écrit, pièce absente du stockage) est RÉGÉNÉRÉ, puis envoyé à l'apporteur. S'il échoue
 * encore, Williams est alerté (une fois par numéro). Rend le nombre d'avoirs régénérés.
 */
export async function regenererAvoirsSansPiece(maintenant: Date = new Date()): Promise<number> {
  const lignes = await prisma.commissionApporteur.findMany({
    where: { statut: "reprise", activite: ACTIVITE_NEUTRALISATION, avoirNumero: { not: null } },
    select: {
      id: true,
      apporteurId: true,
      montantCents: true,
      avoirNumero: true,
      autofactureNumero: true,
      presentationId: true,
    },
  });
  let n = 0;
  for (const l of lignes) {
    const numero = l.avoirNumero!;
    if (await existsInR2(`apporteurs/autofactures/${l.apporteurId}/${numero}.pdf`)) continue;
    const pdf = await genererPdfAutofacture({
      apporteurId: l.apporteurId,
      numero,
      periodeLibelle: `annulation pour manquement au ${dateFr(maintenant)} (art. 4.5 bis)`,
      commissionIds: [l.id],
      totalCents: Math.abs(l.montantCents ?? 0),
      maintenant,
      avoir: {
        factureInitiale: l.autofactureNumero ?? "non retrouvée",
        dateFactureInitiale: null,
        imputation: `annule la ligne retenue de l'autofacture N° ${l.autofactureNumero ?? ""}`,
      },
    });
    if (!pdf) {
      const jobId = `apporteur-avoir-sans-piece-${numero}`;
      if (!(await dejaEnvoye(jobId))) {
        await enqueueEmail(
          "qualiopi-alerte-interne",
          destinataireAlertesInternes(),
          "fr",
          {
            niveau: "important",
            code: "apporteur_avoir_sans_piece",
            titre: `Avoir ${numero} sans pièce`,
            message: `L'avoir ${numero} (manquement, art. 4.5 bis) est enregistré mais son PDF ne peut toujours pas être établi (identité de facturation ou stockage). Nouvel essai à chaque passage horaire.`,
            cibleType: "ApporteurReseau",
            cibleId: l.apporteurId,
            createdAt: maintenant.toLocaleDateString("fr-FR"),
          },
          { jobId, entityType: "ApporteurReseau", entityId: l.apporteurId },
        );
      }
      continue;
    }
    n += 1;
    await prevenir(
      l.apporteurId,
      l.presentationId ?? l.apporteurId,
      { avoirSeul: true },
      `apporteur-manquement-avoir-${numero}`,
      [{ r2Key: pdf.r2Key, filename: pdf.filename }],
    );
  }
  return n;
}
