/**
 * Qualiopi — Émission, transmission et contestation d'une autofacture.
 *
 * Lot 2 du chantier « payer les formateurs ». Le lot 1 a livré ce qui DÉCIDE
 * (`autofacturation.ts`) et ce qui SE REND (`autofacture-pieces.ts`, le gabarit
 * PDF) ; ce module est la chaîne qui les relie à un geste d'opérateur.
 *
 * ── LES QUATRE CONDITIONS, ET OÙ CHACUNE EST TENUE ───────────────────────────
 *
 * Une facture d'autofacturation est régulière si, et seulement si, elle réunit
 * un mandat écrit et PRÉALABLE, la mention « Autofacturation », l'émission au
 * nom et pour le compte du sous-traitant, et un droit de contestation. Il en
 * manque UNE SEULE et la pièce est irrégulière : la TVA qu'elle porte n'est pas
 * déductible, et on l'apprend au contrôle, des mois plus tard.
 *
 *   1. mandat préalable → `verifierEligibiliteAutofacture`, qui REFUSE ici ;
 *   2. mention « Autofacturation » → portée par le gabarit depuis la constante
 *      `MENTION_AUTOFACTURATION`, jamais retapée ;
 *   3. au nom et pour le compte → l'inversion vendeur/acheteur du gabarit et du
 *      CII, éprouvée par mutation dans le lot 1 ;
 *   4. droit de contestation → OUVERT PAR LA TRANSMISSION, jamais par
 *      l'émission. C'est la seule des quatre qui dépende d'un envoi qui aboutit,
 *      et c'est ce que ce module protège le plus soigneusement.
 *
 * ── POURQUOI ÉMISSION ET TRANSMISSION SONT DEUX ACTES ────────────────────────
 *
 * 🔑 Le délai de huit jours court « à compter de la transmission ». Une pièce
 * émise et jamais transmise ne fait courir AUCUN délai — sinon la fenêtre se
 * refermerait sur un formateur qui n'a rien reçu, et la contrepartie que le
 * mandat promet serait vidée de son sens. `emettreAutofactureAction` tente donc
 * la transmission dans la foulée, mais n'ouvre la fenêtre QUE si l'envoi est
 * réellement parti. S'il échoue, la pièce existe, la fenêtre reste fermée, et
 * `transmettreAutofactureAction` permet de réessayer.
 *
 * ⚠️ L'e-mail ne passe PAS par la corbeille de validation, et c'est un choix.
 * La corbeille existe pour relire un e-mail COMMERCIAL avant qu'il n'atteigne un
 * client. Cette pièce n'est pas commerciale : son contenu est intégralement
 * dérivé d'un relevé déjà validé par un humain, elle part à un sous-traitant qui
 * a signé le mandat, et la garer raccourcirait un délai légal. La relecture
 * humaine, c'est le clic sur « Émettre » — pas un second garage.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireHabilitation, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { calculerEcheanceHonoraires } from "@/server/qualiopi/remuneration/echeance";
import {
  emettreAutofacture,
  lireReleveAutofacture,
  transmettreAutofacture,
} from "@/server/qualiopi/remuneration/autofacture-emission";

type ActionResult<T> = { data: T } | { error: string };

const uuid = z.string().uuid();

/*
 * 🔑 LE CORPS VIT DANS UN SERVICE PUR depuis le 2026-09-15 :
 * `server/qualiopi/remuneration/autofacture-emission.ts`. Le cron horaire de
 * rattrapage l'appelle sans session ; appeler CETTE action depuis le worker
 * levait dès la garde, et le rattrapage n'a jamais rien émis. Les actions
 * ci-dessous ne font plus que : garder, valider, appeler, journaliser au nom de
 * l'administrateur.
 */

/* ──────────────────────────────────────────────────────────────────────────────
 * 1. Émission
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Établit la facture d'honoraires au nom du sous-traitant, puis tente de la lui
 * transmettre.
 *
 * Acte ENGAGEANT : émettre une facture au nom d'un tiers engage l'organisme
 * autant qu'émettre la sienne. Même habilitation que le paiement des honoraires.
 */
export async function emettreAutofactureAction(
  input: z.input<typeof schemaEmission>,
): Promise<ActionResult<{ numero: string; transmise: boolean }>> {
  const session = await requireHabilitation("remunerer_formateur");
  const parsed = schemaEmission.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  // Le journal est écrit par le service, au même moment qu'avant (après
  // l'enregistrement de la pièce, avant la transmission), au nom de la session.
  const res = await emettreAutofacture(parsed.data.statementId, (entree) =>
    logQualiopiActivity({ ...entree, session }),
  );
  // ⚠️ Seul le message remonte : `code` et `cause` servent au cron, pas à l'écran.
  if ("error" in res) return { error: res.error };
  return { data: res.data };
}

const schemaEmission = z.object({ statementId: uuid });

/* ──────────────────────────────────────────────────────────────────────────────
 * 2. Transmission — c'est ELLE qui ouvre les huit jours
 * ────────────────────────────────────────────────────────────────────────────── */

/** Réessaie la transmission d'une pièce émise mais non transmise. */
export async function transmettreAutofactureAction(
  input: z.input<typeof schemaEmission>,
): Promise<ActionResult<{ transmise: boolean }>> {
  const session = await requireHabilitation("remunerer_formateur");
  const parsed = schemaEmission.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const releve = await lireReleveAutofacture(parsed.data.statementId);
  if (releve === null) return { error: "Relevé introuvable." };
  if (releve.autofactureAt === null) {
    return { error: "Aucune autofacture émise pour ce relevé : il n'y a rien à transmettre." };
  }
  if (releve.autofactureTransmiseAt !== null) {
    return { error: "Cette facture a déjà été transmise." };
  }
  if (!releve.trainer.email) {
    return {
      error: "Le formateur n'a pas d'adresse e-mail : impossible de lui transmettre la pièce.",
    };
  }

  const transmise = await transmettreAutofacture(
    {
      statementId: releve.id,
      numero: releve.numeroFacture as string,
      documentId: releve.autofactureDocumentId,
      trainerId: releve.trainerId,
      trainerNom: `${releve.trainer.prenom} ${releve.trainer.nom}`.trim(),
      trainerEmail: releve.trainer.email,
      periodeYear: releve.periodeYear,
      periodeMonth: releve.periodeMonth,
      totalTtcCents: releve.totalTtcCents,
      echeance: releve.dateFacture !== null ? calculerEcheanceHonoraires(releve.dateFacture) : null,
    },
    "reprise",
  );
  await logQualiopiActivity({
    action: "qualiopi.autofacture.transmission",
    targetType: "TrainerStatement",
    targetId: releve.id,
    changes: { transmise },
    session,
  });

  if (!transmise) {
    return { error: "L'envoi n'a pas pu partir. La fenêtre de contestation reste fermée." };
  }
  return { data: { transmise } };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 3. Contestation — elle BLOQUE le paiement
 * ────────────────────────────────────────────────────────────────────────────── */

const schemaContestation = z.object({
  statementId: uuid,
  motif: z.string().min(1).max(2000),
});

/**
 * Consigne une contestation reçue du sous-traitant.
 *
 * 🔴 Elle BLOQUE le paiement, et c'est le même raisonnement que la garde
 * « facture conforme » : payer une pièce contestée reviendrait à acter un
 * désaccord au lieu de le régler. Le blocage vit dans
 * `transitionStatementAction` — ici on ne fait qu'enregistrer le fait.
 *
 * ⚠️ On enregistre une contestation même HORS DÉLAI. Le délai de huit jours dit
 * qu'au-delà la facture est « réputée acceptée » ; il ne dit pas que le
 * désaccord n'existe pas. Refuser de le consigner effacerait un fait, et
 * laisserait partir un virement sur une pièce que le formateur conteste — le
 * pire des deux mondes. L'arbitrage reste humain ; l'outil ne le préempte pas.
 */
export async function contesterAutofactureAction(
  input: z.input<typeof schemaContestation>,
): Promise<ActionResult<{ horsDelai: boolean }>> {
  const session = await requireHabilitation("remunerer_formateur");
  const parsed = schemaContestation.safeParse(input);
  if (!parsed.success) return { error: "Motif de contestation requis." };
  const { statementId, motif } = parsed.data;

  const releve = await lireReleveAutofacture(statementId);
  if (releve === null) return { error: "Relevé introuvable." };
  if (releve.autofactureAt === null) {
    return { error: "Aucune autofacture émise pour ce relevé." };
  }
  if (releve.contesteeAt !== null) {
    return { error: "Une contestation est déjà enregistrée sur cette facture." };
  }

  const maintenant = new Date();
  const horsDelai =
    releve.contestationAvantAt !== null &&
    releve.contestationAvantAt.getTime() < maintenant.getTime();

  try {
    await prisma.trainerStatement.update({
      where: { id: statementId },
      data: { contesteeAt: maintenant, contestationMotif: motif },
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement de la contestation." };
  }

  await logQualiopiActivity({
    action: "qualiopi.autofacture.contestation",
    targetType: "TrainerStatement",
    targetId: statementId,
    changes: { motif, horsDelai },
    session,
  });

  return { data: { horsDelai } };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 4. Formulaires (Server Actions liées aux boutons)
 * ────────────────────────────────────────────────────────────────────────────── */

function champ(formData: FormData, nom: string): string {
  const v = formData.get(nom);
  return typeof v === "string" ? v : "";
}

/** Bouton « Émettre l'autofacture ». Redirige vers la fiche avec un bandeau. */
export async function emettreAutofactureFormAction(formData: FormData): Promise<void> {
  const statementId = champ(formData, "statementId");
  const retour = champ(formData, "retour");
  const res = await emettreAutofactureAction({ statementId });
  const q =
    "error" in res
      ? `?erreur=${encodeURIComponent(res.error)}`
      : `?ok=${encodeURIComponent(
          res.data.transmise
            ? `Facture ${res.data.numero} émise et transmise au formateur.`
            : `Facture ${res.data.numero} émise, mais l'envoi n'est pas parti : la fenêtre de contestation n'est PAS ouverte. Utilisez « Transmettre » pour réessayer.`,
        )}`;
  revalidatePath(retour);
  const { redirect } = await import("next/navigation");
  redirect(`${retour}${q}`);
}

/** Bouton « Transmettre » (reprise d'un envoi qui n'est pas parti). */
export async function transmettreAutofactureFormAction(formData: FormData): Promise<void> {
  const statementId = champ(formData, "statementId");
  const retour = champ(formData, "retour");
  const res = await transmettreAutofactureAction({ statementId });
  const q =
    "error" in res
      ? `?erreur=${encodeURIComponent(res.error)}`
      : `?ok=${encodeURIComponent("Facture transmise. La fenêtre de contestation de 8 jours est ouverte.")}`;
  revalidatePath(retour);
  const { redirect } = await import("next/navigation");
  redirect(`${retour}${q}`);
}

/** Bouton « Enregistrer une contestation ». */
export async function contesterAutofactureFormAction(formData: FormData): Promise<void> {
  const statementId = champ(formData, "statementId");
  const retour = champ(formData, "retour");
  const res = await contesterAutofactureAction({ statementId, motif: champ(formData, "motif") });
  const q =
    "error" in res
      ? `?erreur=${encodeURIComponent(res.error)}`
      : `?ok=${encodeURIComponent(
          res.data.horsDelai
            ? "Contestation enregistrée (reçue APRÈS le délai de 8 jours — la facture était réputée acceptée, l'arbitrage vous revient). Le paiement est bloqué."
            : "Contestation enregistrée. Le paiement est bloqué tant qu'elle n'est pas levée.",
        )}`;
  revalidatePath(retour);
  const { redirect } = await import("next/navigation");
  redirect(`${retour}${q}`);
}
