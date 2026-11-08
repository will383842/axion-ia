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

/** Décalage de Paris par rapport à UTC (ms) à l'instant `t`. */
function decalageParisMs(t: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(t));
  const g = (k: string) => Number(parts.find((x) => x.type === k)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - t;
}

/** Instant UTC de 23 h 59 min 59 s, HEURE DE PARIS, du jour civil `y-mo-d`. */
function finDeJourneeParis(y: number, mo: number, d: number): Date {
  const naif = Date.UTC(y, mo - 1, d, 23, 59, 59);
  return new Date(naif - decalageParisMs(naif - decalageParisMs(naif)));
}

const validiteSchema = z.object({
  id: z.string().uuid(),
  attenduMajLe: z.string().datetime(),
  dateValidite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /**
   * Saisie d'estimation OPCO (non conservée sur le devis) : si elle est fournie, l'estimation
   * est recalculée avec la nouvelle date ; sinon l'estimation existante est signalée à refaire.
   */
  estimation: entreeDevisClassiqueSchema
    .pick({
      nbParticipants: true,
      dureeHeures: true,
      modaliteOpco: true,
      opcoEnveloppeRestanteCents: true,
      dateDebutSessionPrevue: true,
    })
    .optional(),
});

/**
 * Fixe la date de validité d'un BROUILLON (classique OU à formules : la date n'est pas dans le
 * sceau de l'offre). Dernier jour inclus : la date est enregistrée à 23 h 59 min 59 s, heure de Paris.
 * Écriture conditionnelle sur `updatedAt` ; n'écrit jamais `statut`.
 */
export async function fixerValiditeDevisBrouillonAction(
  i: z.input<typeof validiteSchema>,
): Promise<ActionResult<{ majLe: string }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
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
    select: {
      id: true,
      statut: true,
      updatedAt: true,
      clientId: true,
      offreSha256: true,
      financementSuggere: true,
      montantTotalHtCents: true,
      montantOpcoEstimeCents: true,
    },
  });
  if (!actuel) return { error: "Devis introuvable" };
  if (actuel.statut !== "brouillon") {
    return { error: "Un devis envoyé ne se modifie pas : créez une révision (nouvelle version)." };
  }
  if (actuel.updatedAt.getTime() !== attendu.getTime()) return { error: MSG_PERIME };

  const nouvelleDate = finDeJourneeParis(y, mo, d);

  // L'estimation OPCO dépend de la date de référence (début de session, sinon validité) :
  // pour un devis CLASSIQUE financé par OPCO, elle suit la date. Un devis à formules garde la sienne.
  let estimationData: Record<string, unknown> = {};
  if (actuel.offreSha256 === null && actuel.financementSuggere === "opco") {
    const saisie = p.data.estimation;
    if (saisie) {
      const opco = await estimationOpcoDevis(
        { clientId: actuel.clientId, financementSuggere: "opco", ...saisie },
        actuel.montantTotalHtCents,
        nouvelleDate,
      );
      estimationData = {
        montantOpcoEstimeCents: opco.montantOpcoEstimeCents ?? null,
        opcoEstimationOrigine: opco.opcoEstimationOrigine ?? null,
        opcoEstimationAvertissement: opco.opcoEstimationAvertissement ?? null,
        resteAChargeCents: opco.resteAChargeCents ?? null,
      };
    } else if (actuel.montantOpcoEstimeCents != null) {
      return {
        error:
          "La date change l'estimation OPCO : fournissez les paramètres pour la recalculer (saisie « estimation »).",
      };
    }
  }

  const { count } = await prisma.devis.updateMany({
    where: { id, statut: "brouillon", updatedAt: attendu },
    data: { dateValidite: nouvelleDate, ...estimationData },
  });
  if (count === 0) return { error: MSG_PERIME };

  const apres = await prisma.devis.findUnique({ where: { id }, select: { updatedAt: true } });

  await logQualiopiActivity({
    action: "qualiopi.devis.fixer_validite_brouillon",
    targetType: "Devis",
    targetId: id,
    changes: {
      dateValidite: p.data.dateValidite,
      estimationRecalculee: "montantOpcoEstimeCents" in estimationData,
    },
    session,
  });
  return { data: { majLe: (apres?.updatedAt ?? new Date()).toISOString() } };
}
