"use server";

/**
 * Devis CLASSIQUE (lignes libres) — modification d'un BROUILLON (chantier assistant, fiche S09).
 *
 * Mêmes calculs que `createDevisAction` (module `champs-classiques`) : à entrée égale, mêmes
 * champs en création et en modification, estimation OPCO et mention TVA comprises.
 *
 * Garde-fous :
 *   - `requireAdminWrite` d'abord ;
 *   - total à 0 € refusé ;
 *   - refus si le devis porte une offre à formules (`offreSha256` non nul), s'il n'est plus
 *     `brouillon`, si le client change, ou si `updatedAt` n'est plus celui que l'onglet a lu ;
 *   - l'écriture est un `updateMany` CONDITIONNEL sur ces trois critères (course entre onglets) ;
 *   - n'écrit JAMAIS `statut` (cliquet des écrivains) ; aucun delete ; aucun e-mail ;
 *   - le lien au projet (`projetId`) n'est posé qu'à la création : il est ignoré ici.
 *
 * Montants en centimes. Le champ retiré de la saisie (OPCO, activité, référence) est remis à null.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  entreeDevisClassiqueSchema,
  estimationOpcoDevis,
  mentionTvaDevisClassique,
  totalHtClassiqueCents,
} from "@/server/qualiopi/devis/champs-classiques";

type ActionResult<T> = { data: T } | { error: string };

const MSG_PERIME = "Ce brouillon a été modifié ailleurs (autre onglet) : rechargez la page.";

const modifierSchema = z.object({
  id: z.string().uuid(),
  /** Valeur `updatedAt` (ISO) lue au chargement : la version que l'on croit modifier. */
  attenduMajLe: z.string().datetime(),
  input: entreeDevisClassiqueSchema,
});

export async function modifierDevisClassiqueBrouillonAction(
  i: z.input<typeof modifierSchema>,
): Promise<ActionResult<{ id: string; majLe: string }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
  const p = modifierSchema.safeParse(i);
  if (!p.success) return { error: "Données invalides" };
  const { id, input: v } = p.data;
  const attendu = new Date(p.data.attenduMajLe);

  const montantTotalHtCents = totalHtClassiqueCents(v.lignes);
  if (montantTotalHtCents <= 0) {
    return { error: "Le total du devis ne peut pas être de 0 €." };
  }

  const actuel = await prisma.devis.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      statut: true,
      offreSha256: true,
      updatedAt: true,
      dateValidite: true,
    },
  });
  if (!actuel) return { error: "Devis introuvable" };
  if (actuel.offreSha256 !== null) {
    return { error: "Ce devis est à formules : il se modifie depuis l'éditeur de formules." };
  }
  if (actuel.statut !== "brouillon") {
    return { error: "Un devis envoyé ne se modifie pas : créez une révision (nouvelle version)." };
  }
  if (actuel.clientId !== v.clientId) {
    return { error: "Le client d'un devis ne se change pas : créez un nouveau devis." };
  }
  if (actuel.updatedAt.getTime() !== attendu.getTime()) return { error: MSG_PERIME };

  const opco = await estimationOpcoDevis(v, montantTotalHtCents, actuel.dateValidite);
  const mentionTva = await mentionTvaDevisClassique();

  const { count } = await prisma.devis.updateMany({
    where: { id, statut: "brouillon", offreSha256: null, updatedAt: attendu },
    data: {
      lignes: v.lignes as never,
      montantTotalHtCents,
      mentionTva,
      activite: v.activite ?? null,
      refClient: v.refClient ?? null,
      financementSuggere: v.financementSuggere ?? null,
      montantOpcoEstimeCents: opco.montantOpcoEstimeCents ?? null,
      opcoEstimationOrigine: opco.opcoEstimationOrigine ?? null,
      opcoEstimationAvertissement: opco.opcoEstimationAvertissement ?? null,
      resteAChargeCents: opco.resteAChargeCents ?? null,
    },
  });
  if (count === 0) return { error: MSG_PERIME };

  const apres = await prisma.devis.findUnique({ where: { id }, select: { updatedAt: true } });

  await logQualiopiActivity({
    action: "qualiopi.devis.modifier_brouillon_classique",
    targetType: "Devis",
    targetId: id,
    changes: { montantTotalHtCents, financementSuggere: v.financementSuggere },
    session,
  });

  return { data: { id, majLe: (apres?.updatedAt ?? new Date()).toISOString() } };
}

// ─────────────────────────────────────────────────────────────────────────────
// S10 — validité modifiable (bornes D8 : J+7 à J+90 ; le défaut de 30 jours est posé à la création)
// ─────────────────────────────────────────────────────────────────────────────

const VALIDITE_MIN_JOURS = 7;
const VALIDITE_MAX_JOURS = 90;
const JOUR_MS = 86_400_000;

/** Jour civil (heure de Paris) de `maintenant`, en millisecondes UTC à minuit. */
function minuitParisUtc(maintenant: Date): number {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant);
  const [y, mo, d] = p.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, mo - 1, d);
}

const validiteSchema = z.object({
  id: z.string().uuid(),
  attenduMajLe: z.string().datetime(),
  dateValidite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Fixe la date de validité d'un BROUILLON (classique OU à formules : la date n'est pas dans le
 * sceau de l'offre). Dernier jour inclus : la date est enregistrée à 23 h 59 min 59 s UTC.
 * Écriture conditionnelle sur `updatedAt` ; n'écrit jamais `statut`.
 */
export async function fixerValiditeDevisBrouillonAction(
  i: z.input<typeof validiteSchema>,
): Promise<ActionResult<{ majLe: string }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  await requireAdminWrite();
  const p = validiteSchema.safeParse(i);
  if (!p.success) return { error: "Données invalides" };
  const { id } = p.data;
  const attendu = new Date(p.data.attenduMajLe);

  const [y, mo, d] = p.data.dateValidite.split("-").map(Number) as [number, number, number];
  const jourUtc = Date.UTC(y, mo - 1, d);
  const verif = new Date(jourUtc);
  if (verif.getUTCFullYear() !== y || verif.getUTCMonth() !== mo - 1 || verif.getUTCDate() !== d) {
    return { error: "Date de validité invalide." };
  }
  const jours = Math.round((jourUtc - minuitParisUtc(new Date())) / JOUR_MS);
  if (jours < VALIDITE_MIN_JOURS || jours > VALIDITE_MAX_JOURS) {
    return {
      error: `La validité du devis va de ${VALIDITE_MIN_JOURS} à ${VALIDITE_MAX_JOURS} jours à partir d'aujourd'hui.`,
    };
  }

  const actuel = await prisma.devis.findUnique({
    where: { id },
    select: { id: true, statut: true, updatedAt: true },
  });
  if (!actuel) return { error: "Devis introuvable" };
  if (actuel.statut !== "brouillon") {
    return { error: "Un devis envoyé ne se modifie pas : créez une révision (nouvelle version)." };
  }
  if (actuel.updatedAt.getTime() !== attendu.getTime()) return { error: MSG_PERIME };

  const { count } = await prisma.devis.updateMany({
    where: { id, statut: "brouillon", updatedAt: attendu },
    data: { dateValidite: new Date(jourUtc + JOUR_MS - 1000) },
  });
  if (count === 0) return { error: MSG_PERIME };

  const apres = await prisma.devis.findUnique({ where: { id }, select: { updatedAt: true } });
  return { data: { majLe: (apres?.updatedAt ?? new Date()).toISOString() } };
}
