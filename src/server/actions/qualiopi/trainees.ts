/**
 * Qualiopi — Server Actions stagiaires (Trainee) — R10 audit E2E 2026-06-06.
 *
 * createTraineeAction : crée un stagiaire (PII handicap chiffré AES-256-GCM).
 * updateTraineeAction : met à jour les champs éditoriaux (handicap re-chiffré).
 *
 * RGPD : `handicapDetails` n'est JAMAIS stocké en clair → encryptPii. Le détail
 * en clair ne transite que de l'admin vers l'action (write-only). La suppression
 * (anonymisation art. 17) reste gérée par rgpd-service.supprimerStagiaire.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  chiffrerDetailSante,
  detailSanteSaisissable,
} from "@/server/qualiopi/adaptation/detail-sante-chiffre";
import { journaliserDeclarationBesoin } from "@/server/qualiopi/adaptation/journal-declaration";

type ActionResult<T> = { data: T } | { error: string };

const createTraineeSchema = z.object({
  nom: z.string().min(1).max(200),
  prenom: z.string().min(1).max(200),
  email: z.string().email(),
  telephone: z.string().max(40).optional(),
  entreprise: z.string().max(250).optional(),
  fonction: z.string().max(200).optional(),
  situationHandicap: z.boolean().optional(),
  /**
   * Détail handicap EN CLAIR — chiffré avant stockage (jamais persisté en clair).
   *
   * `detailSanteSaisissable` refuse le préfixe de chiffrement DÈS LA SAISIE :
   * il déclencherait la garde d'idempotence du chiffrement, qui rendrait le
   * texte inchangé. La garde de dernier recours l'attrape de toute façon, mais
   * elle ne peut plus rien dire d'utile à ce stade — ici, le refus est précoce
   * et le champ fautif est nommé.
   */
  handicapDetails: z.string().max(2000).refine(detailSanteSaisissable).optional(),
  consentementFormation: z.boolean().optional(),
  consentementEmail: z.boolean().optional(),
  consentementVersion: z.string().max(20).optional(),
});

const updateTraineeSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1).max(200).optional(),
  prenom: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  telephone: z.string().max(40).optional(),
  entreprise: z.string().max(250).optional(),
  fonction: z.string().max(200).optional(),
  situationHandicap: z.boolean().optional(),
  handicapDetails: z.string().max(2000).refine(detailSanteSaisissable).optional(),
  consentementFormation: z.boolean().optional(),
  consentementEmail: z.boolean().optional(),
  consentementVersion: z.string().max(20).optional(),
});

/**
 * Le champ de santé a-t-il été refusé par le SCHÉMA ? Si oui : le dire
 * précisément à l'administrateur, et laisser une trace au journal qualité.
 *
 * 🔴 Deux défauts fermés ici, relevés par la relecture de #1106 :
 *
 * 1. le refus rendait « Données invalides », mot pour mot comme un e-mail
 *    malformé. Le commentaire du schéma promettait que « le champ fautif est
 *    nommé » — il ne l'était pas ;
 * 2. ce refus-là ne laissait **aucune** trace. Le refus de la garde d'écriture
 *    est consigné plus bas, mais celui du schéma court-circuite en amont : la
 *    cause « saisie anormale » — la seule qui ne peut PAS venir d'un usage
 *    normal, le formulaire n'ayant pas de valeur pré-remplie — disparaissait
 *    en silence.
 *
 * Rend `null` quand l'échec de validation porte sur autre chose.
 */
async function refusDetailSante(
  erreur: z.ZodError,
  // ⚠️ `AdminSession` n'est volontairement PAS exporté de `_guards` (Turbopack
  // transformerait le type en référence de Server Action). On le dérive.
  contexte: {
    etape: "creation" | "modification";
    session: Awaited<ReturnType<typeof requireAdminWrite>>;
    targetId?: string;
  },
): Promise<{ error: string } | null> {
  const porteSurLeDetail = erreur.issues.some((i) => i.path[0] === "handicapDetails");
  if (!porteSurLeDetail) return null;

  await logQualiopiActivity({
    action: "qualiopi.trainee.detail_sante.refuse",
    targetType: "Trainee",
    targetId: contexte.targetId ?? null,
    // Le motif, jamais le contenu.
    changes: { etape: contexte.etape, motif: "saisie_refusee" },
    session: contexte.session,
  });

  return {
    error:
      "La précision sur la situation contient une valeur qui ne peut pas être enregistrée. Corrigez ce champ, les autres sont intacts.",
  };
}

/** Crée un stagiaire. Email unique. PII handicap chiffré. */
export async function createTraineeAction(
  input: z.infer<typeof createTraineeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = createTraineeSchema.safeParse(input);
  if (!parsed.success) {
    const refus = await refusDetailSante(parsed.error, { etape: "creation", session });
    if (refus !== null) return refus;
    return { error: "Données invalides" };
  }
  const v = parsed.data;

  const hasHandicapDetails = v.handicapDetails !== undefined && v.handicapDetails.trim() !== "";
  const situationHandicap = v.situationHandicap ?? hasHandicapDetails;

  const detailChiffreCreation = hasHandicapDetails
    ? chiffrerDetailSante(v.handicapDetails as string, { service: "createTraineeAction" })
    : null;
  // Un détail fourni mais non chiffrable ne doit pas passer sous silence : la
  // fiche serait créée SANS la précision, et personne ne saurait qu'elle a été
  // saisie. Déjà signalé à Sentry par la garde.
  if (hasHandicapDetails && detailChiffreCreation === null) {
    // 🔴 Au JOURNAL QUALITÉ, pas seulement à la supervision technique. Sur une
    // donnée de santé, le refus d'écriture est en soi un événement à consigner :
    // c'est lui qui explique, un an plus tard, pourquoi une fiche ne porte pas
    // la précision que quelqu'un se souvient avoir saisie. Et il se consigne
    // SANS donnée personnelle — seule la survenue du geste importe.
    await logQualiopiActivity({
      action: "qualiopi.trainee.detail_sante.refuse",
      targetType: "Trainee",
      targetId: null,
      changes: { etape: "creation" },
      session,
    });
    return {
      error:
        "La précision sur la situation n'a pas pu être enregistrée de façon sécurisée. Fiche non créée.",
    };
  }

  try {
    const created = await prisma.trainee.create({
      data: {
        nom: v.nom,
        prenom: v.prenom,
        email: v.email,
        situationHandicap,
        ...(v.telephone !== undefined ? { telephone: v.telephone } : {}),
        ...(v.entreprise !== undefined ? { entreprise: v.entreprise } : {}),
        ...(v.fonction !== undefined ? { fonction: v.fonction } : {}),
        // 🔴 Garde partagée, et non `encryptPii` nu : celui-ci rend le texte
        // INCHANGÉ si la clé manque ou si l'entrée porte déjà le préfixe — on
        // écrirait alors une donnée de santé en clair. `null` = ne pas écrire.
        ...(detailChiffreCreation !== null
          ? { handicapDetailsChiffre: detailChiffreCreation }
          : {}),
        ...(v.consentementFormation !== undefined
          ? { consentementFormation: v.consentementFormation }
          : {}),
        ...(v.consentementEmail !== undefined ? { consentementEmail: v.consentementEmail } : {}),
        ...(v.consentementVersion !== undefined
          ? { consentementVersion: v.consentementVersion, consentementAt: new Date() }
          : {}),
      },
      select: { id: true },
    });

    await logQualiopiActivity({
      action: "qualiopi.trainee.create",
      targetType: "Trainee",
      targetId: created.id,
      // Ne jamais logguer le détail handicap (PII) — seulement le booléen.
      changes: { nom: v.nom, prenom: v.prenom, email: v.email, situationHandicap },
      session,
    });
    if (situationHandicap) {
      await journaliserDeclarationBesoin({
        traineeId: created.id,
        origine: "console",
        declareLe: new Date(),
        adminUserId: session.userId,
      });
    }

    return { data: { id: created.id } };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { error: "Un stagiaire avec cet email existe déjà." };
    }
    return { error: "Erreur lors de la création du stagiaire." };
  }
}

/** Met à jour un stagiaire. Le détail handicap fourni est re-chiffré. */
export async function updateTraineeAction(
  input: z.infer<typeof updateTraineeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateTraineeSchema.safeParse(input);
  if (!parsed.success) {
    const refus = await refusDetailSante(parsed.error, {
      etape: "modification",
      session,
      ...(typeof input?.id === "string" ? { targetId: input.id } : {}),
    });
    if (refus !== null) return refus;
    return { error: "Données invalides" };
  }
  const { id, handicapDetails, consentementVersion, ...fields } = parsed.data;

  const hasHandicapDetails = handicapDetails !== undefined && handicapDetails.trim() !== "";

  const detailChiffreMaj = hasHandicapDetails
    ? chiffrerDetailSante(handicapDetails as string, {
        service: "updateTraineeAction",
        traineeId: id,
      })
    : null;
  // Même règle qu'à la création : une précision saisie mais non chiffrable ne
  // doit pas disparaître en silence — l'administrateur croirait l'avoir enregistrée.
  if (hasHandicapDetails && detailChiffreMaj === null) {
    // Même raison qu'à la création : le refus se consigne au journal qualité,
    // sans aucune donnée personnelle. Ici la cible existe, elle est nommée.
    await logQualiopiActivity({
      action: "qualiopi.trainee.detail_sante.refuse",
      targetType: "Trainee",
      targetId: id,
      changes: { etape: "modification" },
      session,
    });
    return {
      error:
        "La précision sur la situation n'a pas pu être enregistrée de façon sécurisée. Aucune modification enregistrée.",
    };
  }

  try {
    // 🔴 Ind. 10 (relecture #1095) — cocher la situation de handicap, ou en
    // réécrire le détail, est une NOUVELLE DÉCLARATION : elle rouvre une réponse
    // déjà consignée. Le formulaire renvoie la case à chaque enregistrement, d'où
    // la lecture de l'état AVANT : garder la case cochée n'est pas déclarer.
    const avant =
      fields.situationHandicap === true || hasHandicapDetails
        ? await prisma.trainee.findUnique({ where: { id }, select: { situationHandicap: true } })
        : null;
    const declareLe = new Date();

    await prisma.trainee.update({
      where: { id },
      data: {
        ...(fields.nom !== undefined ? { nom: fields.nom } : {}),
        ...(fields.prenom !== undefined ? { prenom: fields.prenom } : {}),
        ...(fields.email !== undefined ? { email: fields.email } : {}),
        ...(fields.telephone !== undefined ? { telephone: fields.telephone } : {}),
        ...(fields.entreprise !== undefined ? { entreprise: fields.entreprise } : {}),
        ...(fields.fonction !== undefined ? { fonction: fields.fonction } : {}),
        ...(fields.situationHandicap !== undefined
          ? { situationHandicap: fields.situationHandicap }
          : {}),
        ...(detailChiffreMaj !== null ? { handicapDetailsChiffre: detailChiffreMaj } : {}),
        ...(fields.consentementFormation !== undefined
          ? { consentementFormation: fields.consentementFormation }
          : {}),
        ...(fields.consentementEmail !== undefined
          ? { consentementEmail: fields.consentementEmail }
          : {}),
        ...(consentementVersion !== undefined
          ? { consentementVersion, consentementAt: new Date() }
          : {}),
      },
    });

    await logQualiopiActivity({
      action: "qualiopi.trainee.update",
      targetType: "Trainee",
      targetId: id,
      changes: { ...fields, handicapDetailsModifie: hasHandicapDetails },
      session,
    });

    const situationApres = fields.situationHandicap ?? avant?.situationHandicap === true;
    const nouvelleDeclaration =
      avant !== null && situationApres && (hasHandicapDetails || avant.situationHandicap !== true);
    if (nouvelleDeclaration) {
      await journaliserDeclarationBesoin({
        traineeId: id,
        origine: "console",
        declareLe,
        adminUserId: session.userId,
      });
    }

    return { data: { id } };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { error: "Un stagiaire avec cet email existe déjà." };
    }
    return { error: "Erreur lors de la mise à jour du stagiaire." };
  }
}
