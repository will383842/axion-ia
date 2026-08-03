/**
 * Qualiopi — Server Actions du commissionnement des formateurs (pilier C).
 *
 * Trois surfaces :
 *   1. le run mensuel (`runRemunerationMensuelleAction`), avec un mode simulation ;
 *   2. les transitions de relevé, gardées par `transitionAutorisee` ;
 *   3. le barème versionné, qu'on n'écrase JAMAIS : on clôt et on recrée.
 *
 * ── Le gate dur : on ne paie que sur facture conforme ────────────────────────
 * `paye` n'est atteignable que depuis `facture_recue` (matrice de `run.ts`), et
 * cette action exige EN PLUS que le TTC de la facture reçue égale le TTC du
 * relevé. Un écart signifie que l'organisme et le formateur ne sont pas d'accord
 * sur le montant dû : le régler par un virement serait acter un désaccord.
 *
 * ── Geler et dégeler les lignes ──────────────────────────────────────────────
 * Valider un relevé fige ses lignes (`calcule` → `valide`), ce qui les met hors
 * d'atteinte du run (qui n'efface que le non-`valide`). Le retour en arrière
 * `valide → a_valider` doit DÉGELER, sinon le prochain run recréerait des lignes
 * à côté des anciennes et doublerait le montant du mois. Les deux sens sont
 * testés.
 *
 * Guards RBAC write + audit ActivityLog, comme les autres actions Qualiopi.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { runRemunerationMensuelle } from "@/server/qualiopi/remuneration/statements";
import { transitionAutorisee, type StatementStatut } from "@/server/qualiopi/remuneration/run";

type ActionResult<T> = { data: T } | { error: string };

const uuid = z.string().uuid();

/* ──────────────────────────────────────────────────────────────────────────────
 * 1. Run mensuel
 * ────────────────────────────────────────────────────────────────────────────── */

const runSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  dryRun: z.coerce.boolean().optional(),
});

/**
 * Calcule (et écrit, sauf `dryRun`) les lignes et relevés d'un mois.
 * Les formateurs dont le relevé est déjà validé sont sautés, pas écrasés.
 */
export async function runRemunerationMensuelleAction(
  // `z.input` : un formulaire envoie des chaînes, `coerce` convertit.
  input: z.input<typeof runSchema>,
): Promise<
  ActionResult<{
    lignesEcrites: number;
    relevesEcrits: number;
    prestationsLues: number;
    anomalies: number;
    formateursIgnores: number;
    dryRun: boolean;
  }>
> {
  const session = await requireAdminWrite();
  const parsed = runSchema.safeParse(input);
  if (!parsed.success) return { error: "Période invalide" };
  const { year, month, dryRun } = parsed.data;

  let res;
  try {
    res = await runRemunerationMensuelle({ year, month }, { dryRun: dryRun === true });
  } catch {
    return { error: "Le run de rémunération a échoué." };
  }

  if (!res.dryRun) {
    await logQualiopiActivity({
      action: "qualiopi.remuneration.run",
      targetType: "TrainerStatement",
      targetId: null,
      changes: {
        periode: `${year}-${String(month).padStart(2, "0")}`,
        lignesEcrites: res.lignesEcrites,
        relevesEcrits: res.relevesEcrits,
        anomalies: res.anomalies.length,
        formateursIgnores: res.formateursIgnores.length,
      },
      session,
    });
  }

  return {
    data: {
      lignesEcrites: res.lignesEcrites,
      relevesEcrits: res.relevesEcrits,
      prestationsLues: res.prestationsLues,
      anomalies: res.anomalies.length,
      formateursIgnores: res.formateursIgnores.length,
      dryRun: res.dryRun,
    },
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 2. Transitions de relevé
 * ────────────────────────────────────────────────────────────────────────────── */

const STATUTS = [
  "brouillon",
  "a_valider",
  "valide",
  "facture_recue",
  "paye",
  "annule",
] as const satisfies readonly StatementStatut[];

const transitionSchema = z.object({
  id: uuid,
  to: z.enum(STATUTS),
  // Renseignés au passage en `facture_recue`.
  numeroFacture: z.string().max(60).optional(),
  dateFacture: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : new Date(v)))
    .refine((d) => d === undefined || !Number.isNaN(d.getTime()), { message: "Date invalide" }),
  /**
   * 🔴 LE FORMULAIRE DEMANDAIT DES CENTIMES À UN COMPTABLE. Le champ était
   * libellé « Montant TTC (centimes) » et pré-rempli à 120000 : saisir 1200,
   * le montant lu sur la facture, enregistrait douze euros. Le garde-fou de
   * conformité aurait rattrapé l'écart — mais après avoir accusé la facture
   * d'être fausse.
   *
   * On accepte donc des EUROS, ce que porte la facture, et on convertit ici.
   * L'arrondi est explicite parce qu'un montant à deux décimales multiplié
   * par 100 en
   * virgule flottante ne tombe pas toujours sur un entier (12,10 → 1209,999…),
   * et qu'un centime perdu sur une comparaison d'égalité stricte ferait
   * refuser une facture pourtant conforme.
   */
  montantFactureTtcEuros: z.coerce
    .number()
    .nonnegative()
    .optional()
    .transform((v) => (v === undefined ? undefined : Math.round(v * 100))),
  factureUrl: z.string().url().max(2000).optional().or(z.literal("")),
  // Renseignés au passage en `paye`.
  moyenPaiement: z.string().max(30).optional(),
  referenceVirement: z.string().max(80).optional(),
});

/**
 * Fait passer un relevé d'un statut à un autre. Refuse toute transition que la
 * matrice n'autorise pas, puis applique les gardes propres à la cible.
 */
export async function transitionStatementAction(
  input: z.input<typeof transitionSchema>,
): Promise<ActionResult<{ id: string; statut: StatementStatut }>> {
  const session = await requireAdminWrite();
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const releve = await prisma.trainerStatement.findUnique({
    where: { id: v.id },
    select: {
      id: true,
      statut: true,
      totalTtcCents: true,
      numeroFacture: true,
      dateFacture: true,
      montantFactureTtcCents: true,
    },
  });
  if (releve === null) return { error: "Relevé introuvable." };

  const from = releve.statut;
  if (!transitionAutorisee(from, v.to)) {
    return { error: `Transition « ${from} » → « ${v.to} » interdite.` };
  }

  // ── Gardes propres à la cible ──
  if (v.to === "facture_recue") {
    if (v.numeroFacture === undefined || v.numeroFacture === "") {
      return { error: "Le numéro de la facture reçue est requis." };
    }
    if (v.dateFacture === undefined) return { error: "La date de la facture est requise." };
    if (v.montantFactureTtcEuros === undefined) {
      return { error: "Le montant TTC de la facture est requis." };
    }
  }

  if (v.to === "paye") {
    // Le montant peut avoir été saisi maintenant, ou l'avoir été en `facture_recue`.
    const factureTtc = v.montantFactureTtcEuros ?? releve.montantFactureTtcCents;
    if (factureTtc === null || factureTtc === undefined) {
      return { error: "Aucun montant de facture : impossible de payer." };
    }
    if (factureTtc !== releve.totalTtcCents) {
      // « Facture conforme » : un écart de montant est un désaccord, pas un détail.
      return {
        error: `Facture non conforme : ${(factureTtc / 100).toFixed(2)} € TTC facturés contre ${(releve.totalTtcCents / 100).toFixed(2)} € TTC dus. Rejeter la facture ou corriger le relevé.`,
      };
    }
    if (v.moyenPaiement === undefined || v.moyenPaiement === "") {
      return { error: "Le moyen de paiement est requis." };
    }
  }

  const maintenant = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.trainerStatement.update({
        where: { id: v.id },
        data: {
          statut: v.to,
          ...(v.to === "valide" ? { validatedById: session.userId } : {}),
          ...(v.numeroFacture !== undefined ? { numeroFacture: v.numeroFacture } : {}),
          ...(v.dateFacture !== undefined ? { dateFacture: v.dateFacture } : {}),
          ...(v.montantFactureTtcEuros !== undefined
            ? { montantFactureTtcCents: v.montantFactureTtcEuros }
            : {}),
          ...(v.factureUrl !== undefined && v.factureUrl !== ""
            ? { factureUrl: v.factureUrl }
            : {}),
          ...(v.to === "paye"
            ? {
                payeAt: maintenant,
                moyenPaiement: v.moyenPaiement ?? null,
                referenceVirement: v.referenceVirement ?? null,
              }
            : {}),
        },
      });

      // Valider FIGE les lignes : le run mensuel n'efface que le non-`valide`.
      if (v.to === "valide") {
        await tx.trainerFeeLine.updateMany({
          where: { statementId: v.id, statut: "calcule" },
          data: { statut: "valide" },
        });
      }

      // Redescendre DÉGÈLE. Sans cela, le relevé redevient recalculable alors que
      // ses lignes restent `valide` : le prochain run, qui n'efface que le
      // non-`valide`, en recréerait à côté et doublerait le montant du mois.
      // C'est la SEULE redescente possible après un gel (cf. matrice : `valide`
      // ne mène qu'à `facture_recue`, `a_valider` ou `annule`).
      if (from === "valide" && v.to === "a_valider") {
        await tx.trainerFeeLine.updateMany({
          where: { statementId: v.id, statut: "valide" },
          data: { statut: "calcule" },
        });
      }
    });
  } catch {
    return { error: "Erreur lors du changement de statut." };
  }

  await logQualiopiActivity({
    action: "qualiopi.remuneration.statement_transition",
    targetType: "TrainerStatement",
    targetId: v.id,
    changes: { from, to: v.to },
    session,
  });

  return { data: { id: v.id, statut: v.to } };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 3. Barème versionné
 * ────────────────────────────────────────────────────────────────────────────── */

const MODELS = [
  "taux_journalier",
  "taux_horaire",
  "commission_ca_pct",
  "forfait_prestation",
] as const;

const PRESTATION_TYPES = ["formation_collective", "coaching_1to1", "audit"] as const;

const ruleSchema = z
  .object({
    trainerId: uuid,
    prestationType: z.enum(PRESTATION_TYPES).optional(),
    interventionSlug: z.string().max(80).optional(),
    model: z.enum(MODELS),
    tauxJourneeHtCents: z.coerce.number().int().positive().optional(),
    tauxHoraireHtCents: z.coerce.number().int().positive().optional(),
    commissionPct: z.coerce.number().min(0).max(100).optional(),
    forfaitHtCents: z.coerce.number().int().positive().optional(),
    effectiveFrom: z.string().transform((v) => new Date(v)),
    note: z.string().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (Number.isNaN(v.effectiveFrom.getTime())) {
      ctx.addIssue({ code: "custom", message: "Date d'entrée en vigueur invalide" });
    }
    // Le taux du modèle est OBLIGATOIRE : une règle sans son taux produirait des
    // lignes à 0 € (`calcul.ts` ne devine pas un montant).
    const requis: Record<(typeof MODELS)[number], unknown> = {
      taux_journalier: v.tauxJourneeHtCents,
      taux_horaire: v.tauxHoraireHtCents,
      commission_ca_pct: v.commissionPct,
      forfait_prestation: v.forfaitHtCents,
    };
    if (requis[v.model] === undefined) {
      ctx.addIssue({ code: "custom", message: `Le taux du modèle « ${v.model} » est requis.` });
    }
  });

/**
 * Crée une VERSION de barème. On ne modifie jamais une règle en vigueur : celle
 * qui couvrait la même cible est CLÔTURÉE à la date d'entrée en vigueur de la
 * nouvelle (`effectiveTo` exclu = `effectiveFrom` inclus de la suivante, sans
 * trou ni chevauchement). C'est ce qui garantit qu'augmenter un taux en
 * septembre ne recalcule jamais les sessions de juin.
 */
export async function createCompensationRuleAction(
  input: z.input<typeof ruleSchema>,
): Promise<ActionResult<{ id: string; cloturees: number }>> {
  const session = await requireAdminWrite();
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  const v = parsed.data;

  const prestationType = v.prestationType ?? null;
  const interventionSlug =
    v.interventionSlug !== undefined && v.interventionSlug !== "" ? v.interventionSlug : null;

  let id: string;
  let cloturees: number;
  try {
    const out = await prisma.$transaction(async (tx) => {
      // Clôt les versions ouvertes de LA MÊME cible qui couvrent la nouvelle date.
      // Une règle d'une autre cible (autre type, autre slug) coexiste : c'est la
      // spécificité qui les départage à la lecture, pas la date.
      const closed = await tx.trainerCompensationRule.updateMany({
        where: {
          trainerId: v.trainerId,
          prestationType,
          interventionSlug,
          effectiveFrom: { lt: v.effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: v.effectiveFrom } }],
        },
        data: { effectiveTo: v.effectiveFrom },
      });

      const created = await tx.trainerCompensationRule.create({
        data: {
          trainerId: v.trainerId,
          prestationType,
          interventionSlug,
          model: v.model,
          tauxJourneeHtCents: v.tauxJourneeHtCents ?? null,
          tauxHoraireHtCents: v.tauxHoraireHtCents ?? null,
          commissionPct: v.commissionPct ?? null,
          forfaitHtCents: v.forfaitHtCents ?? null,
          effectiveFrom: v.effectiveFrom,
          effectiveTo: null,
          note: v.note ?? null,
          createdById: session.userId,
        },
        select: { id: true },
      });
      return { id: created.id, cloturees: closed.count };
    });
    id = out.id;
    cloturees = out.cloturees;
  } catch {
    return { error: "Erreur lors de l'enregistrement du barème." };
  }

  await logQualiopiActivity({
    action: "qualiopi.compensation_rule.create",
    targetType: "TrainerCompensationRule",
    targetId: id,
    changes: { trainerId: v.trainerId, model: v.model, cloturees },
    session,
  });

  return { data: { id, cloturees } };
}

const closeSchema = z.object({
  id: uuid,
  effectiveTo: z.string().transform((v) => new Date(v)),
});

/** Clôt une règle sans lui en substituer une autre (le formateur n'a plus ce barème). */
export async function closeCompensationRuleAction(
  input: z.input<typeof closeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;
  if (Number.isNaN(v.effectiveTo.getTime())) return { error: "Date de clôture invalide" };

  const regle = await prisma.trainerCompensationRule.findUnique({
    where: { id: v.id },
    select: { effectiveFrom: true, effectiveTo: true },
  });
  if (regle === null) return { error: "Barème introuvable." };
  if (regle.effectiveTo !== null) return { error: "Ce barème est déjà clôturé." };
  if (v.effectiveTo <= regle.effectiveFrom) {
    return { error: "La clôture doit suivre l'entrée en vigueur." };
  }

  try {
    await prisma.trainerCompensationRule.update({
      where: { id: v.id },
      data: { effectiveTo: v.effectiveTo },
    });
  } catch {
    return { error: "Erreur lors de la clôture du barème." };
  }

  await logQualiopiActivity({
    action: "qualiopi.compensation_rule.close",
    targetType: "TrainerCompensationRule",
    targetId: v.id,
    changes: { effectiveTo: v.effectiveTo.toISOString() },
    session,
  });

  return { data: { id: v.id } };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 4. Enveloppes `FormData` — les pages restent sans JavaScript client
 * ────────────────────────────────────────────────────────────────────────────── */

/** Champ de formulaire → chaîne, ou `undefined` si vide (jamais `""`). */
function champ(fd: FormData, nom: string): string | undefined {
  const v = fd.get(nom);
  if (typeof v !== "string" || v === "") return undefined;
  return v;
}

/**
 * Champ → nombre. `NaN` si la saisie n'est pas numérique : les schémas Zod le
 * rejettent (`.int()` échoue sur `NaN`), donc l'erreur remonte proprement à
 * l'opérateur au lieu d'être silencieusement convertie en 0.
 */
function champNombre(fd: FormData, nom: string): number | undefined {
  const v = champ(fd, nom);
  return v === undefined ? undefined : Number(v);
}

/**
 * Chemin de retour SÛR. Le champ `retour` arrive du formulaire, donc du client :
 * `redirect()` accepte une URL absolue, et un `retour` forgé (`https://…`, ou le
 * protocol-relative `//evil.tld`) ferait sortir l'opérateur du site depuis une
 * action authentifiée. On n'accepte qu'un chemin interne.
 */
function retourSur(fd: FormData): string {
  const v = champ(fd, "retour");
  if (v === undefined) return "/";
  if (!v.startsWith("/") || v.startsWith("//")) return "/";
  // `\` est traité comme `/` par certains navigateurs → `/\evil.tld` s'échapperait.
  if (v.includes("\\")) return "/";
  return v;
}

/**
 * Lance le run depuis un `<form action={...}>`. Les erreurs repartent en query
 * string : une page serveur n'a pas d'état, et un `throw` afficherait l'écran
 * d'erreur de Next pour une simple saisie invalide.
 *
 * `redirect()` lève par conception — il est APRÈS le try/catch, jamais dedans,
 * sinon le catch avalerait la redirection.
 */
export async function runRemunerationFormAction(formData: FormData): Promise<void> {
  const base = retourSur(formData);
  const res = await runRemunerationMensuelleAction({
    year: champNombre(formData, "year") ?? NaN,
    month: champNombre(formData, "month") ?? NaN,
    // Case cochée = présente. `z.coerce.boolean("false")` vaudrait `true` : on ne
    // laisse donc JAMAIS une chaîne atteindre le schéma.
    dryRun: champ(formData, "dryRun") !== undefined,
  });

  if ("error" in res) {
    redirect(`${base}?erreur=${encodeURIComponent(res.error)}`);
  }
  revalidatePath(base);
  const bilan = res.data.dryRun
    ? `simulation : ${res.data.lignesEcrites} ligne(s), ${res.data.relevesEcrits} relevé(s)`
    : `${res.data.lignesEcrites} ligne(s) et ${res.data.relevesEcrits} relevé(s) écrits`;
  const suffixe = res.data.anomalies > 0 ? ` — ${res.data.anomalies} anomalie(s)` : "";
  redirect(`${base}?ok=${encodeURIComponent(bilan + suffixe)}`);
}

/** Change le statut d'un relevé depuis un `<form action={...}>`. */
export async function transitionStatementFormAction(formData: FormData): Promise<void> {
  const base = retourSur(formData);
  const to = champ(formData, "to");
  const id = champ(formData, "id");
  if (to === undefined || id === undefined) {
    redirect(`${base}?erreur=${encodeURIComponent("Statut cible manquant")}`);
  }

  const res = await transitionStatementAction({
    id,
    to: to as StatementStatut,
    numeroFacture: champ(formData, "numeroFacture"),
    dateFacture: champ(formData, "dateFacture"),
    montantFactureTtcEuros: champNombre(formData, "montantFactureTtcEuros"),
    factureUrl: champ(formData, "factureUrl"),
    moyenPaiement: champ(formData, "moyenPaiement"),
    referenceVirement: champ(formData, "referenceVirement"),
  });

  if ("error" in res) {
    redirect(`${base}?erreur=${encodeURIComponent(res.error)}`);
  }
  revalidatePath(base);
  redirect(`${base}?ok=${encodeURIComponent(`Relevé passé en « ${res.data.statut} »`)}`);
}
