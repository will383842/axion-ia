/**
 * Proposition des plans récurrents d'un devis à formules ACCEPTÉ (lot 5).
 *
 * Écrit, au plus, des `PlanRecurrent` en statut `pause` (+ `devisId`, `nature`,
 * `proposeAt`) : le cron `genererBrouillonsPlansEchus` ne lit que `actif`, donc RIEN
 * ne se génère tant que Will n'a pas validé (`changerStatutPlanAction`).
 *
 * ⛔ AUCUNE facture, AUCUN e-mail, AUCUN message : cette fonction n'appelle ni la
 * facturation ni la file d'e-mails.
 *
 * Inerte si l'interrupteur `qualiopi.devis_formules.actif` est éteint, si le devis n'a
 * pas d'offre, ou si aucune formule n'a été retenue. Idempotente (index unique partiel
 * (devis_id, nature) en base + lecture préalable) : la rejouer ne crée rien de plus.
 * Fail-closed : offre ou choix illisible / altéré → aucun plan, motif rendu.
 */
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { ActiviteFacturation } from "../../../../prisma/generated/client";
import { FORMULES, offreDevisV1 } from "./offre-devis";
import { sha256Offre } from "./offre-calculs";
import { formulesActives } from "./interrupteur-formules";
import { planifierPlansRecurrents, type PlansProposes } from "./plan-recurrent-devis";

const choixStocke = z.object({
  v: z.literal(1),
  devisNumero: z.string(),
  offreSha256: z.string(),
  formule: z.enum(FORMULES),
  maintenanceRetenue: z.boolean(),
  periodiciteMois: z.number().int().positive().nullable(),
});

export type PropositionPlans =
  | { readonly statut: "inerte"; readonly raison: "interrupteur_eteint" | "sans_offre" }
  | { readonly statut: "refuse"; readonly code: string; readonly motif: string }
  | {
      readonly statut: "traite";
      readonly crees: readonly string[];
      readonly dejaPresents: readonly string[];
      readonly nonTraites: readonly string[];
    };

const refuse = (code: string, motif: string): PropositionPlans => ({
  statut: "refuse",
  code,
  motif,
});

type Evaluation =
  | { readonly fin: PropositionPlans }
  | {
      readonly fin: null;
      readonly devis: { clientId: string; activite: ActiviteFacturation; refClient: string | null };
      readonly calcul: Extract<PlansProposes, { ok: true }>;
      readonly maintenant: Date;
    };

/** Lit le devis et calcule (fonction pure du lot 5) les plans ATTENDUS. N'écrit rien. */
async function evaluerPlansDuDevis(devisId: string): Promise<Evaluation> {
  if (!(await formulesActives())) {
    return { fin: { statut: "inerte", raison: "interrupteur_eteint" } };
  }

  const devis = await prisma.devis.findUnique({
    where: { id: devisId },
    select: {
      id: true,
      numero: true,
      statut: true,
      activite: true,
      clientId: true,
      refClient: true,
      acceptedAt: true,
      offre: true,
      offreSha256: true,
      formuleRetenue: true,
      choixRetenu: true,
    },
  });
  if (devis === null) return { fin: refuse("devis_introuvable", "Devis introuvable.") };
  if (devis.offre === null) return { fin: { statut: "inerte", raison: "sans_offre" } };
  if (devis.statut !== "accepte" && devis.statut !== "transforme_convention") {
    return { fin: refuse("devis_non_accepte", "Seul un devis accepté propose des plans.") };
  }
  if (devis.formuleRetenue === null) {
    return { fin: refuse("aucune_formule", "Aucune formule retenue : aucun plan proposé.") };
  }
  if (devis.activite === null) {
    return {
      fin: refuse("activite_absente", "Activité du devis absente : le plan exige une activité."),
    };
  }

  const offre = offreDevisV1.safeParse(devis.offre);
  if (!offre.success) return { fin: refuse("offre_illisible", "Offre du devis illisible.") };
  const choix = choixStocke.safeParse(devis.choixRetenu);
  if (!choix.success)
    return { fin: refuse("choix_illisible", "Choix du client illisible ou absent.") };

  // Le plan ne s'écrit que sur une offre INTACTE : empreinte recalculée = empreinte stockée
  // = empreinte que le client a vue en choisissant.
  const empreinte = sha256Offre(devis.offre);
  if (devis.offreSha256 !== empreinte || choix.data.offreSha256 !== empreinte) {
    return {
      fin: refuse(
        "offre_alteree",
        "Empreinte de l'offre différente de celle du choix : aucun plan.",
      ),
    };
  }
  if (choix.data.formule !== devis.formuleRetenue || choix.data.devisNumero !== devis.numero) {
    return { fin: refuse("choix_incoherent", "Le choix scellé ne correspond pas au devis.") };
  }

  const maintenant = new Date();
  const calcul = planifierPlansRecurrents({
    offre: offre.data,
    choix: {
      formule: choix.data.formule,
      maintenanceRetenue: choix.data.maintenanceRetenue,
      periodiciteMois: choix.data.periodiciteMois,
    },
    debutAt: devis.acceptedAt ?? maintenant,
    devisNumero: devis.numero,
  });
  if (!calcul.ok) return { fin: refuse(calcul.code, calcul.motif) };
  return {
    fin: null,
    devis: { clientId: devis.clientId, activite: devis.activite, refClient: devis.refClient },
    calcul,
    maintenant,
  };
}

export type EtatPlansManquants = "aucun" | "manquants" | "impossibles";

/**
 * Règle d'alerte (pure). `attendus` : résultat de `compterPlansAttendus`.
 *  - 0 attendu → « aucun » (cas normal) ;
 *  - null (formule retenue mais plans non calculables) → « impossibles », JAMAIS silencieux ;
 *  - sinon « manquants » si la base en porte moins que prévu.
 */
export function evaluerPlansManquants(
  attendus: number | null,
  presents: number,
): EtatPlansManquants {
  if (attendus === null) return "impossibles";
  if (attendus === 0) return "aucun";
  return presents < attendus ? "manquants" : "aucun";
}

/**
 * Nombre de plans récurrents ATTENDUS pour un devis accepté (recalculé depuis la formule retenue
 * et l'offre figée), ou `null` si on ne peut pas l'affirmer (inerte, refus, offre illisible).
 * `0` = cas NORMAL (ex. formule « achat » sans maintenance) : aucune alerte à montrer.
 */
export async function compterPlansAttendus(devisId: string): Promise<number | null> {
  const e = await evaluerPlansDuDevis(devisId);
  return e.fin === null ? e.calcul.plans.length : null;
}

export async function proposerPlansRecurrentsDuDevis(devisId: string): Promise<PropositionPlans> {
  const e = await evaluerPlansDuDevis(devisId);
  if (e.fin !== null) return e.fin;
  const { devis, calcul, maintenant } = e;
  try {
    return await prisma.$transaction(async (tx) => {
      const existants = new Set(
        (await tx.planRecurrent.findMany({ where: { devisId }, select: { nature: true } })).map(
          (p) => p.nature,
        ),
      );
      const crees: string[] = [];
      const dejaPresents: string[] = [];
      for (const plan of calcul.plans) {
        if (existants.has(plan.nature)) {
          dejaPresents.push(plan.nature);
          continue;
        }
        await tx.planRecurrent.create({
          data: {
            clientId: devis.clientId,
            activite: devis.activite,
            lignes: plan.lignes as never,
            ...(devis.refClient !== null ? { refClient: devis.refClient } : {}),
            periodiciteMois: plan.periodiciteMois,
            prochaineGenerationAt: plan.prochaineGenerationAt,
            ...(plan.nbMaxFactures !== null ? { nbMaxFactures: plan.nbMaxFactures } : {}),
            statut: "pause",
            notes: plan.notes,
            devisId,
            nature: plan.nature,
            jourAncre: plan.jourAncre,
            proposeAt: maintenant,
          },
        });
        crees.push(plan.nature);
      }
      return { statut: "traite" as const, crees, dejaPresents, nonTraites: calcul.nonTraites };
    });
  } catch (err) {
    // Course entre deux acceptations simultanées : l'index unique partiel a tranché.
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
      return {
        statut: "traite",
        crees: [],
        dejaPresents: calcul.plans.map((p) => p.nature),
        nonTraites: calcul.nonTraites,
      };
    }
    throw err;
  }
}

/**
 * Appel après le COMMIT de l'acceptation (hors transaction) : n'échoue JAMAIS, et ne
 * touche jamais l'acceptation. Un refus ou une erreur part à Sentry (aucune donnée
 * personnelle : identifiant du devis, code) — Will relance alors la proposition des plans.
 *
 * Rend `null` si tout va bien (plans proposés, déjà présents, ou interrupteur éteint / devis
 * sans offre), sinon le CODE de l'échec : l'appelant peut ainsi le rendre visible à l'écran
 * sans jamais avoir à capturer d'exception.
 */
export async function proposerPlansApresAcceptation(
  devisId: string,
  origine: "signature_complete" | "console",
): Promise<string | null> {
  return (await proposerPlansApresAcceptationDetaille(devisId, origine)).echec;
}

/**
 * Même appel, résultat explicite : `echec` (code ou `null`) ET `proposes` — vrai seulement si cet
 * appel a CRÉÉ au moins un plan. « Déjà présents » (ou rien à proposer) donne `proposes: false`,
 * ce qui permet à la reprise manuelle de dire « rien n'a été fait » à bon droit, et seulement
 * à bon droit.
 */
export async function proposerPlansApresAcceptationDetaille(
  devisId: string,
  origine: "signature_complete" | "console",
): Promise<{ echec: string | null; proposes: boolean }> {
  let proposes = false;
  try {
    const r = await proposerPlansRecurrentsDuDevis(devisId);
    if (r.statut === "refuse") {
      Sentry.captureMessage("devis_formules: plan récurrent non proposé", {
        level: "warning",
        tags: { action: "devis_plan_recurrent", code: r.code, origine },
        extra: { devisId, motif: r.motif },
      });
      return { echec: r.code, proposes: false };
    } else if (r.statut === "traite") {
      proposes = r.crees.length > 0;
      if (r.nonTraites.length > 0) {
        Sentry.captureMessage("devis_formules: éléments d'offre sans plan", {
          level: "info",
          tags: { action: "devis_plan_recurrent", origine },
          extra: { devisId, nonTraites: r.nonTraites },
        });
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "devis_plan_recurrent", origine },
      extra: { devisId },
    });
    return { echec: "erreur_inattendue", proposes: false };
  }
  return { echec: null, proposes };
}
