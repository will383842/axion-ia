/**
 * producteurs/candidature.ts — l'UNIQUE émission de `candidature.recue` vers Axion Partners
 * (INT-T22, REQ-INT-032, REQ-CPL-015, REQ-DM-035, REQ-QA-035).
 *
 * ── Le fait part au clic « prêt à signer », jamais à la réception ─────────────────────────────
 * ADR 0051 §c (décision B1 de Williams, 2026-09-19) : un candidat que personne n'a encore eu au
 * téléphone n'a rien à faire dans l'outil du contrat. L'écrivain de ce fait n'est donc PAS le
 * tunnel qui crée la `Submission` : c'est la transition console « prêt à signer »
 * (`marquerPretASigner`, `src/features/admin-submissions/transitions.ts`), qui pose la marque
 * `details.pretASignerAt` et appelle `emettreCandidatureRecue` dans SA transaction. Le cliquet
 * `pnpm partners:cliquet-ecrivains` refuse toute autre construction de cette marque qui
 * n'appellerait pas cette fonction.
 *
 * ── Aucune coordonnée dans la charge (ADR 0051 §d) ────────────────────────────────────────────
 * `payloadCandidatureRecue` ne lit que `details`, et trie les réponses par une liste FERMÉE.
 * Partners tire les coordonnées par la route authentifiée (`coordonnees.ts`), qui n'ouvre la
 * lecture qu'à un `candidature.recue` présent dans la file, sujet `submission:<id>` — le sujet
 * posé ici, `{ submission_id }`, mis à plat par `aplatirSujet`.
 *
 * ── Unicité ───────────────────────────────────────────────────────────────────────────────────
 * Clé du fait = `candidature.recue:<id>`, la convention des fixtures (`scripts/partners/
 * fixtures.ts`) : un second clic rend le même `event_id`, et la file écrit en
 * `ON CONFLICT DO NOTHING`. L'instant du fait est celui de la fixture, `submittedAt` : la date
 * de la candidature, stable d'un clic à l'autre.
 *
 * ── Refus ─────────────────────────────────────────────────────────────────────────────────────
 * Une `Submission` qui n'est pas un dossier apporteur (`estApporteur`) n'a rien à faire chez
 * Partners ; une fiche classée « sans suite » est une décision de NE PAS donner suite — la
 * transmettre à l'outil du contrat contredirait la seule décision humaine de la console
 * (ADR 0051 §f) ; une fiche à la corbeille ne transite plus. Le refus est écrit UNE fois
 * (`motifDeRefusPretASigner`) et lu deux fois : par la transition, avant toute écriture, et par
 * l'émission, qui ne se fie jamais à son appelant.
 *
 * ── Inertie ───────────────────────────────────────────────────────────────────────────────────
 * Canal fermé : `emettreCandidatureRecue` rend `null` sans rien lire.
 */
import type { Prisma } from "../../../../prisma/generated/client";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { payloadCandidatureRecue, type SubmissionPourEvenement } from "@/server/partners/payloads";

import { canalPartnersOuvert } from "../config";
import { ecrireEvenementPartners } from "../outbox";

/** Le type d'événement, tel que le contrat le nomme. */
export const CANDIDATURE_RECUE = "candidature.recue";

/** Pourquoi une fiche ne peut pas être dite « prête à signer ». */
export type MotifRefusPretASigner = "effacee" | "non_apporteur" | "sans_suite";

/** Une émission refusée : la fiche n'est pas une candidature transmissible. */
export class CandidatureNonTransmissible extends Error {
  readonly motif: MotifRefusPretASigner;

  constructor(submissionId: string, motif: MotifRefusPretASigner) {
    super(`[partners-sync] candidature.recue refusé — submission ${submissionId} : ${motif}`);
    this.name = "CandidatureNonTransmissible";
    this.motif = motif;
  }
}

function detailsObjet(details: unknown): Record<string, unknown> {
  return details !== null && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

/** L'instant « prêt à signer » posé sur la fiche, ou `null`. Lecture défensive. */
export function lirePretASigner(details: unknown): string | null {
  const v = detailsObjet(details)["pretASignerAt"];
  return typeof v === "string" ? v : null;
}

/**
 * LA règle de refus, écrite une fois : corbeille, non-apporteur, sans suite — dans cet ordre.
 * `null` = la fiche peut être transmise.
 */
export function motifDeRefusPretASigner(ligne: {
  readonly details: unknown;
  readonly deletedAt: Date | null;
}): MotifRefusPretASigner | null {
  if (ligne.deletedAt !== null) return "effacee";
  if (!estApporteur(ligne.details)) return "non_apporteur";
  if (typeof detailsObjet(ligne.details)["sansSuiteAt"] === "string") return "sans_suite";
  return null;
}

/**
 * Émet `candidature.recue` pour `submissionId`, dans la transaction `tx`. C'est l'UNIQUE
 * fonction d'émission de ce fait.
 *
 * Rend l'`event_id`, ou `null` si le canal est fermé ou si la fiche relue dans `tx` ne porte pas
 * la marque `pretASignerAt` (aucun fait n'a eu lieu). Lève `CandidatureNonTransmissible` pour
 * une fiche refusée, et laisse lever `payloadCandidatureRecue` sur une charge illisible (score
 * absent, réponse non déclarée) : la transaction de l'écrivain est annulée avec elle.
 */
export async function emettreCandidatureRecue(
  tx: Prisma.TransactionClient,
  submissionId: string,
): Promise<string | null> {
  if (!canalPartnersOuvert()) return null;

  const ligne = await tx.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, type: true, submittedAt: true, details: true, deletedAt: true },
  });
  if (ligne === null) {
    throw new Error(
      `[partners-sync] candidature.recue : submission ${submissionId} introuvable dans la ` +
        "transaction.",
    );
  }
  const refus = motifDeRefusPretASigner(ligne);
  if (refus !== null) throw new CandidatureNonTransmissible(submissionId, refus);
  if (lirePretASigner(ligne.details) === null) return null;

  const submission: SubmissionPourEvenement = {
    id: ligne.id,
    type: ligne.type,
    submittedAt: ligne.submittedAt,
    details: ligne.details,
  };
  const charge = payloadCandidatureRecue({ submission });

  return ecrireEvenementPartners(tx, {
    type: CANDIDATURE_RECUE,
    // La convention de clé de TOUS les faits (`scripts/partners/fixtures.ts`) : `<type>:<id>`.
    cleDeFait: `${CANDIDATURE_RECUE}:${ligne.id}`,
    occurredAt: ligne.submittedAt,
    // Mis à plat en `submission:<id>` : la clé exacte que la route de coordonnées cherche.
    sujet: { submission_id: ligne.id },
    payload: { ...charge },
  });
}
