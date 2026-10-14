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

import {
  desaccordBloquant,
  ISSUE_DESACCORD_NON_RETENU,
} from "@/server/qualiopi/formateurs-independants/paiement/desaccord-regle";
import type { Prisma } from "../../../../prisma/generated/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireHabilitation, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { runRemunerationMensuelle } from "@/server/qualiopi/remuneration/statements";
import { transitionAutorisee, type StatementStatut } from "@/server/qualiopi/remuneration/run";
import { calculerEcheanceHonoraires } from "@/server/qualiopi/remuneration/echeance";
import {
  DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION,
  prendreVerrousRemuneration,
} from "@/server/qualiopi/remuneration/verrou-remuneration";

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
  // 🔴 `D3` (2026-09-05) — ACTE ENGAGEANT, plus `requireAdminWrite`.
  //
  // Les quatre actions monétaires de ce module se contentaient de
  // `requireAdminWrite`, qui autorise `editor` : un compte éditorial pouvait
  // créer le barème d'un formateur et marquer son relevé « payé ». Le même
  // compte ne pouvait ni émettre une facture ni contresigner — le code
  // protégeait l'argent qui ENTRE et pas celui qui SORT. Cf.
  // `ActeEngageant.remunerer_formateur` dans `server/auth/habilitations.ts`.
  const session = await requireHabilitation("remunerer_formateur");
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
  /**
   * Paiement par mission (L12d) : l'empreinte de l'IBAN AFFICHÉE à l'opérateur.
   * Relue au clic et comparée : un compte changé entre-temps refuse le virement.
   */
  ibanEmpreinteAffichee: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
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
 * Le run mensuel tient le verrou de période jusqu'à deux minutes. Une transition
 * qui l'attend au-delà de son propre délai le dit en clair, plutôt que de rendre
 * une erreur technique indistinguable d'une panne.
 */
const MESSAGE_CALCUL_EN_COURS =
  "Un calcul de rémunération est en cours sur cette période : réessayez dans une minute.";

function estDelaiTransactionDepasse(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2028";
}

/**
 * Fait passer un relevé d'un statut à un autre. Refuse toute transition que la
 * matrice n'autorise pas, puis applique les gardes propres à la cible.
 */
export async function transitionStatementAction(
  input: z.input<typeof transitionSchema>,
): Promise<ActionResult<{ id: string; statut: StatementStatut }>> {
  // Acte ENGAGEANT (`D3`) : « payé » est une déclaration comptable. Cf.
  // `runRemunerationMensuelleAction` pour le raisonnement complet.
  const session = await requireHabilitation("remunerer_formateur");
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const releve = await prisma.trainerStatement.findUnique({
    where: { id: v.id },
    select: {
      id: true,
      // Lot S3 : de quoi prendre les MÊMES verrous que le run mensuel.
      trainerId: true,
      periodeYear: true,
      periodeMonth: true,
      statut: true,
      totalTtcCents: true,
      numeroFacture: true,
      // Lot S3 (C5) : une autofacture émise fige le relevé.
      autofactureAt: true,
      dateFacture: true,
      montantFactureTtcCents: true,
      // Autofacturation : une pièce CONTESTÉE ne se paie pas (cf. la garde
      // juste en dessous).
      contesteeAt: true,
      contestationMotif: true,
      contestationCloseIssue: true,
      // Paiement par mission (L12c/L12d) : échéance fixe et gardes propres.
      origine: true,
      echeanceAt: true,
      // L12g : un AVOIR est une pièce de correction, jamais un relevé à faire vivre.
      avoirDeId: true,
    },
  });
  if (releve === null) return { error: "Relevé introuvable." };
  // `!= null` : un `select` qui perdrait le champ ne doit pas bloquer les relevés
  // ordinaires (aucun avoir n'existe tant que le paiement par mission est coupé).
  if (releve.avoirDeId != null) {
    return {
      error:
        "Ce relevé est un avoir : il ne change pas de statut. Une correction passe par une nouvelle pièce.",
    };
  }
  const releveDeMission = releve.origine === "passage_mission";

  const from = releve.statut;
  if (!transitionAutorisee(from, v.to)) {
    return { error: `Transition « ${from} » → « ${v.to} » interdite.` };
  }

  /**
   * 🔴 LOT S3 (C5) — UNE AUTOFACTURE ÉMISE NE SE DÉFAIT PAS.
   *
   * La pièce est partie chez le formateur, numérotée dans notre série : c'est
   * une facture, pas un brouillon. Revenir en arrière (`valide → a_valider`
   * rouvrirait le relevé au run mensuel, `facture_recue → valide` détacherait
   * la pièce de son relevé) ou changer son numéro réécrirait une pièce émise.
   * Une correction passera par un AVOIR — jamais par une réécriture.
   */
  if (releve.autofactureAt != null) {
    const retourArriere =
      (from === "valide" && v.to === "a_valider") ||
      (from === "facture_recue" && v.to === "valide");
    if (retourArriere) {
      return {
        error: `Une autofacture a été émise pour ce relevé : le retour « ${from} » → « ${v.to} » est refusé. Une correction passe par un avoir.`,
      };
    }
    if (v.numeroFacture !== undefined && v.numeroFacture !== releve.numeroFacture) {
      return {
        error: `Le numéro d'une autofacture émise (${releve.numeroFacture ?? "—"}) ne se modifie pas. Une correction passe par un avoir.`,
      };
    }
  }

  /**
   * 🔴 Chantier C4 — UNE PIÈCE DE MISSION ÉMISE NE S'ANNULE PAS D'UN CLIC.
   *
   * L'autofacture numérotée est partie chez le formateur : l'annuler en silence
   * laisserait une facture vivante chez lui et un trou dans notre série. La
   * correction passe par un AVOIR (`emettreAvoirMission`), qui annule la pièce
   * ET ses lignes, et libère le mois pour la réémission.
   */
  if (
    releveDeMission &&
    v.to === "annule" &&
    (releve.numeroFacture != null || releve.autofactureAt != null)
  ) {
    return {
      error: `L'autofacture ${releve.numeroFacture ?? ""} de cette mission a été émise : elle ne s'annule pas, elle se corrige par un avoir.`,
    };
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
    /**
     * 🔴 UNE FACTURE CONTESTÉE NE SE PAIE PAS.
     *
     * C'est le même raisonnement que la garde « facture conforme » vingt lignes
     * plus bas : un écart de montant est un DÉSACCORD, et le régler par un
     * virement revient à l'acter au lieu de le trancher. Une contestation est
     * un désaccord que le sous-traitant a formulé lui-même — a fortiori.
     *
     * ⚠️ Le blocage vit ICI, dans la transition, et non dans l'écran. Un écran
     * qui cache un bouton empêche un clic ; il n'empêche pas l'action. La
     * matrice de transition est le seul endroit par lequel un paiement passe.
     *
     * Levée : consigner l'accord obtenu en corrigeant le relevé, ou en
     * annulant la pièce contestée. On ne rend PAS ce blocage franchissable
     * d'un clic — ce serait une case à cocher pour ignorer un litige.
     */
    // `!= null` et non `!== null` : si un jour ce champ disparaît du `select`,
    // `undefined` passerait le test strict et ferait PLANTER le paiement sur
    // `.toLocaleDateString()`. Une garde ne doit jamais casser le chemin
    // qu'elle protège — surtout pas celui qui sort de l'argent.
    // Lot D2 (M10) : seul un désaccord clos « non retenu » (motif écrit, F59,
    // tracé sur le relevé) lève le blocage. Une règle, `desaccordBloquant`.
    if (releve.contesteeAt != null && desaccordBloquant(releve)) {
      return {
        error: `Facture CONTESTÉE le ${releve.contesteeAt.toLocaleDateString("fr-FR")} : le paiement est bloqué. Motif reçu : « ${releve.contestationMotif ?? "non précisé"} ». Réglez le désaccord — corrigez le relevé, ou annulez la pièce — avant de payer.`,
      };
    }
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
  /**
   * Paiement par mission (L12d) — vigilance à la date de la mission, IBAN en
   * attente ou trop récent, empreinte relue au clic. Les relevés MENSUELS ne
   * passent jamais ici : leur chemin est inchangé.
   */
  let preuveIban: { ibanFin4: string; ibanEmpreinte: string } | null = null;
  /**
   * Chantier C4 (défaut 5) — de quoi RELIRE les garanties sous verrou : la même
   * lecture du contexte, et les garanties sans appel réseau, avec le client de la
   * transaction. `null` hors relevé de mission payé.
   */
  let relectureSousVerrou: ((tx: Prisma.TransactionClient) => Promise<string | null>) | null = null;
  if (v.to === "paye" && releveDeMission) {
    if (releve.echeanceAt == null)
      return { error: "Relevé de mission sans échéance : paiement refusé." };
    // Lot D (M6) : aucun virement sans contrat-cadre signé ni SIREN actif confirmé.
    const {
      garantiesPaiementMission,
      garantiesPaiementMissionSousVerrou,
      LIBELLE_GARANTIE_PAIEMENT,
    } =
      await import("@/server/qualiopi/formateurs-independants/paiement/garanties-paiement-mission");
    const manques = await garantiesPaiementMission(releve.trainerId, maintenant, session.userId);
    if (manques.length > 0) {
      return { error: manques.map((m) => LIBELLE_GARANTIE_PAIEMENT[m]).join(" ") };
    }
    const { contexteVirementMission } =
      await import("@/server/qualiopi/formateurs-independants/paiement/virement-mission-base");
    const { LIBELLE_SUSPENSION_VIREMENT } =
      await import("@/server/qualiopi/formateurs-independants/paiement/virement-mission");
    const aPayer = {
      trainerId: releve.trainerId,
      echeanceAt: releve.echeanceAt,
      totalTtcCents: releve.totalTtcCents,
    };
    let c: Awaited<ReturnType<typeof contexteVirementMission>>;
    try {
      c = await contexteVirementMission(
        prisma,
        aPayer,
        v.ibanEmpreinteAffichee ?? null,
        maintenant,
      );
    } catch {
      // Clé de chiffrement absente ou IBAN illisible : jamais d'erreur brute.
      return { error: "Déchiffrement de l'IBAN impossible : paiement refusé." };
    }
    if (!c.verdict.autorise || c.preuve === null) {
      return {
        error:
          c.verdict.motifs.map((m) => LIBELLE_SUSPENSION_VIREMENT[m]).join(" ") ||
          "Paiement refusé.",
      };
    }
    preuveIban = c.preuve;
    // Rend le motif de refus en clair, ou `null` : le virement peut partir.
    relectureSousVerrou = async (tx) => {
      const sousVerrou = await garantiesPaiementMissionSousVerrou(tx, releve.trainerId, maintenant);
      if (sousVerrou.length > 0)
        return sousVerrou.map((m) => LIBELLE_GARANTIE_PAIEMENT[m]).join(" ");
      let relu: Awaited<ReturnType<typeof contexteVirementMission>>;
      try {
        relu = await contexteVirementMission(
          tx,
          aPayer,
          v.ibanEmpreinteAffichee ?? null,
          maintenant,
        );
      } catch {
        return "Déchiffrement de l'IBAN impossible : paiement refusé.";
      }
      if (!relu.verdict.autorise || relu.preuve === null)
        return (
          relu.verdict.motifs.map((m) => LIBELLE_SUSPENSION_VIREMENT[m]).join(" ") ||
          "Paiement refusé."
        );
      return null;
    };
  }
  let aChange = false;
  let ibanChange = false;
  let ibanAValider = false;
  let refusSousVerrou: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      /**
       * 🔴 LOT S3 (C4) — LES MÊMES VERROUS QUE LE RUN, DANS LE MÊME ORDRE.
       *
       * Le run mensuel lit le statut du relevé sous le verrou de la période.
       * Une validation qui ne le prenait pas pouvait geler les lignes PENDANT
       * le run, qui en recréait alors à côté, rattachées au même relevé : un
       * relevé validé portant deux fois la même prestation. Période, puis
       * formateur — l'ordre fixe de `prendreVerrousRemuneration`.
       */
      await prendreVerrousRemuneration(tx, {
        periodes: [{ year: releve.periodeYear, month: releve.periodeMonth }],
        trainerIds: [releve.trainerId],
      });

      /**
       * Écriture CONDITIONNELLE : seulement si le relevé est encore dans l'état
       * qu'on a lu et contrôlé (statut, et autofacture émise ou non). Sinon un
       * autre écrivain est passé entre la lecture et le verrou — second clic
       * « payé », annulation concurrente, autofacture émise — et appliquer
       * notre transition reviendrait à décider sur un état périmé.
       */
      // Paiement par mission : l'empreinte de l'IBAN est RELUE sous verrou ; un
      // compte changé entre la garde et l'écriture annule le paiement.
      if (preuveIban !== null) {
        const t = await tx.trainer.findUnique({
          where: { id: releve.trainerId },
          select: { ibanEmpreinte: true },
        });
        if (t?.ibanEmpreinte !== preuveIban.ibanEmpreinte) {
          ibanChange = true;
          return;
        }
        // Une demande de changement d'IBAN déposée entre la garde et le verrou
        // suspend aussi le virement (« compte bancaire à valider »).
        const enAttente = await tx.demandeChangementFormateur.count({
          where: { trainerId: releve.trainerId, nature: "iban", statut: "en_attente" },
        });
        if (enAttente > 0) {
          ibanAValider = true;
          return;
        }
      }
      /**
       * 🔴 Chantier C4 (défaut 5) — CONTRAT-CADRE, SIREN ET ATTESTATION URSSAF
       * RELUS SOUS VERROU, comme l'IBAN. Lus avant la transaction seulement, une
       * pièce annulée, un SIREN passé au rouge ou une attestation archivée entre
       * la garde et l'écriture laissaient partir le virement.
       */
      if (relectureSousVerrou !== null) {
        refusSousVerrou = await relectureSousVerrou(tx);
        if (refusSousVerrou !== null) return;
      }
      const ecrit = await tx.trainerStatement.updateMany({
        where: {
          id: v.id,
          statut: from,
          autofactureAt: releve.autofactureAt,
          // Chantier C4 : une autofacture émise entre la lecture et le verrou
          // refuse l'annulation (la pièce passe alors par un avoir).
          ...(releveDeMission && v.to === "annule" ? { numeroFacture: null } : {}),
          // Une contestation consignée entre la lecture et l'écriture
          // (`contesterAutofactureAction`) bloque le paiement, comme la garde
          // plus haut : sinon le virement partirait sur une pièce contestée.
          // Lot D2 (M10) : ou un désaccord clos « non retenu » (même règle).
          ...(v.to === "paye"
            ? {
                OR: [{ contesteeAt: null }, { contestationCloseIssue: ISSUE_DESACCORD_NON_RETENU }],
              }
            : {}),
        },
        data: {
          statut: v.to,
          ...(v.to === "valide" ? { validatedById: session.userId } : {}),
          ...(v.numeroFacture !== undefined ? { numeroFacture: v.numeroFacture } : {}),
          ...(v.dateFacture !== undefined ? { dateFacture: v.dateFacture } : {}),
          /**
           * 🔴 `echeanceAt` existait au schéma depuis le 2026-07-09, INDEXÉE, et
           * personne ne l'écrivait. C'est ici — et nulle part ailleurs — qu'une
           * facture d'honoraires entre dans le système : la garde juste
           * au-dessus exige déjà `dateFacture` pour ce passage. Poser
           * l'échéance ici, c'est la poser sur toute la production à venir.
           *
           * Sans elle, aucune alerte ni aucun écran ne peut voir un retard :
           * aucune comparaison SQL n'est vraie pour NULL. Le stock antérieur est
           * rattrapé par le repli de `echeanceEffective` et par
           * `pnpm backfill:echeance-honoraires`.
           */
          // Un relevé de MISSION garde son échéance fixe (dernière journée + 30 j).
          ...(v.dateFacture !== undefined && !releveDeMission
            ? { echeanceAt: calculerEcheanceHonoraires(v.dateFacture) }
            : {}),
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
                // Preuve du compte payé, lue au clic (relevé de mission seulement).
                ...(preuveIban ?? {}),
              }
            : {}),
        },
      });
      if (ecrit.count !== 1) {
        aChange = true;
        return;
      }

      // Valider FIGE les lignes : le run mensuel n'efface que le non-`valide`.
      if (v.to === "valide") {
        await tx.trainerFeeLine.updateMany({
          where: { statementId: v.id, statut: "calcule" },
          data: { statut: "valide" },
        });
      }

      /**
       * 🔴 Chantier C4 — ANNULER UN RELEVÉ DE MISSION ANNULE SES LIGNES.
       *
       * Laissées `calcule`/`valide` sous un relevé `annule`, elles occupaient
       * toujours l'index unique `trainer_fee_lines_mission_unique` (statut ≠
       * annule) : le passage suivant, qui réécrit le mois, levait chaque jour et
       * le mois n'était plus jamais payé (et l'indemnité restait « déjà écrite »).
       * Même transaction, derrière la même écriture conditionnelle. Un statut,
       * jamais un DELETE.
       */
      if (releveDeMission && v.to === "annule") {
        await tx.trainerFeeLine.updateMany({
          where: { statementId: v.id, statut: { not: "annule" } },
          data: { statut: "annule", annuleMotif: "autre" },
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
    }, DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION);
  } catch (err) {
    // P2028 : délai de transaction dépassé, ou aucune connexion obtenue à temps.
    // Rollback complet — rien n'est écrit, la transition peut être rejouée.
    if (estDelaiTransactionDepasse(err)) {
      return { error: MESSAGE_CALCUL_EN_COURS };
    }
    return { error: "Erreur lors du changement de statut." };
  }
  if (refusSousVerrou !== null) return { error: refusSousVerrou };
  if (ibanAValider) {
    return {
      error:
        "Compte bancaire à valider : une demande de changement d'IBAN attend votre accord. Paiement suspendu.",
    };
  }
  if (ibanChange) {
    return {
      error:
        "Le compte bancaire du formateur a changé pendant l'opération : rechargez la page et vérifiez l'IBAN avant de payer.",
    };
  }
  if (aChange) {
    return {
      error: "Le relevé a changé pendant l'opération : rechargez la page et recommencez.",
    };
  }

  await logQualiopiActivity({
    action: "qualiopi.remuneration.statement_transition",
    targetType: "TrainerStatement",
    targetId: v.id,
    changes: { from, to: v.to },
    session,
  });

  /**
   * 🔑 L'AUTOFACTURE PART À LA VALIDATION, SANS SECOND CLIC.
   *
   * Décision de Will (2026-09-12) : « il faut que tout soit automatiquement pour
   * les formateurs freelance ». J'avais d'abord défendu un bouton, au motif
   * qu'émettre une pièce au nom d'un tiers engage. C'était une garde en DOUBLE :
   * le contrôle humain, c'est CETTE validation. C'est le moment où un opérateur
   * regarde l'argent, et c'est le fait générateur que la clause 4 du contrat
   * désigne. Demander un second clic revenait à faire confirmer ce qui vient
   * d'être confirmé.
   *
   * ⚠️ FAIL-SOFT, ET C'EST LA PROPRIÉTÉ QUI COMPTE. Une émission qui échoue ne
   * doit JAMAIS faire échouer la validation : le relevé est validé, c'est un
   * fait acquis, et le perdre parce qu'un PDF ne s'est pas rendu remplacerait un
   * petit problème par un gros. L'échec est rattrapé par le cron et signalé par
   * une alerte.
   *
   * ⚠️ APRÈS le commit, hors transaction. Générer un PDF et poster un e-mail
   * DANS une transaction Prisma la tiendrait ouverte plusieurs secondes — et un
   * échec y annulerait la validation, ce qu'on vient précisément d'exclure.
   */
  if (v.to === "valide") {
    await tenterAutofactureApresValidation(v.id);
  }

  return { data: { id: v.id, statut: v.to } };
}

/**
 * Tente l'émission automatique. N'échoue JAMAIS : le relevé est déjà validé.
 *
 * ⛔ Ne concerne que les INDÉPENDANTS. Un salarié n'est pas payé sur facture :
 * `verifierEligibiliteAutofacture` le refuserait de toute façon (ni mandat, ni
 * SIRET), mais l'appel est évité en amont pour ne pas produire une alerte
 * « données manquantes » sur quelqu'un qui n'a rien à fournir.
 *
 * 🔑 L'import est DYNAMIQUE, et ce n'est pas du confort : `autofacture.ts`
 * importe déjà ce module pour la garde de paiement. Un cycle statique
 * compilerait sans broncher et laisserait l'un des deux modules `undefined` à
 * l'exécution, selon l'ordre de chargement — le genre de panne qui ne se voit
 * qu'en production.
 */
async function tenterAutofactureApresValidation(statementId: string): Promise<void> {
  try {
    const releve = await prisma.trainerStatement.findUnique({
      where: { id: statementId },
      select: { trainer: { select: { statut: true } } },
    });
    if (releve?.trainer.statut !== "sous_traitant") return;

    const { emettreAutofactureAction } = await import("@/server/actions/qualiopi/autofacture");
    const res = await emettreAutofactureAction({ statementId });
    if ("error" in res) {
      // On LOGUE plutôt que de lever : l'alerte `autofacture_a_emettre` prend le
      // relais avec le geste exact à faire. Un échec muet serait la pire des
      // trois options.
      console.warn(
        `[autofacture] émission automatique refusée pour le relevé ${statementId} : ${res.error}`,
      );
    }
  } catch (err) {
    console.error(
      `[autofacture] émission automatique en échec pour le relevé ${statementId} :`,
      err instanceof Error ? err.message : String(err),
    );
  }
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
  // Acte ENGAGEANT (`D3`) : poser un barème décide de ce que l'organisme
  // devra. Cf. `runRemunerationMensuelleAction` pour le raisonnement complet.
  const session = await requireHabilitation("remunerer_formateur");
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
  // Acte ENGAGEANT (`D3`) : poser un barème décide de ce que l'organisme
  // devra. Cf. `runRemunerationMensuelleAction` pour le raisonnement complet.
  const session = await requireHabilitation("remunerer_formateur");
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
    // Lot D (M6) : l'empreinte de l'IBAN AFFICHÉ, relue et comparée au clic.
    ibanEmpreinteAffichee: champ(formData, "ibanEmpreinteAffichee"),
  });

  if ("error" in res) {
    redirect(`${base}?erreur=${encodeURIComponent(res.error)}`);
  }
  if (res.data.statut === "paye") {
    // Lot D (M9) — F37 ; ne vise que les relevés de MISSION (le mensuel n'envoie rien).
    const { envoyerVirementsFaits } =
      await import("@/server/qualiopi/formateurs-independants/paiement/virement-fait-envoi");
    await envoyerVirementsFaits([res.data.id]);
  }
  revalidatePath(base);
  redirect(`${base}?ok=${encodeURIComponent(`Relevé passé en « ${res.data.statut} »`)}`);
}
