/**
 * LA LETTRE ET LE GUIDE VERS LE CRM (lot L4-S, 2026-09-25).
 *
 * Le CRM (lot L4-C) sait désormais faire d'un abonné ou d'un demandeur du
 * guide une PERSONNE, sans entreprise. Ce module construit, côté site, les
 * deux événements qui l'y font entrer, au format exact que lit
 * `PersonnesIngestService` :
 *
 *   · `lead_magnet_requested` — au CLIC HUMAIN (POST) sur le lien personnel du
 *     guide, jamais à la demande ni au GET (un antivirus suit les GET).
 *     Décision D1 : qui ne clique jamais reste hors du CRM ;
 *   · `newsletter_optin` — l'inscription à la lettre, transmise AU MÊME CLIC
 *     pour une inscription faite à la demande du guide (amendement du 24/09 :
 *     plus de double opt-in, l'adresse n'est vérifiée que par ce clic).
 *
 * Tout passe derrière `CRM_SYNC_GUIDE_ENABLED` (fermé par défaut). Les deux
 * `event_id` sont DÉTERMINISTES (`event-id.ts`) : le geste en direct et la
 * commande de rattrapage posent le même identifiant, donc jamais de doublon.
 *
 * Base légale et statut de la lettre (amendement de Will du 24/09) :
 *   · adresse PRO, inscrite d'office → `legitimate_interest_b2b` ;
 *   · adresse PERSO, case cochée     → `consent` ;
 *   · adresse PERSO sans la case     → pas d'inscription : un demandeur du
 *     guide seul, `legitimate_interest_b2b` au sens « information à la
 *     collecte », statut `non_abonne`. Le CRM refuse de toute façon toute
 *     prospection d'une adresse `perso` sans consentement.
 *
 * Ne lève jamais : la personne attend son PDF, le CRM n'est qu'une copie.
 * Aucune adresse dans les journaux : identifiants seulement.
 */

import { prisma } from "@/lib/prisma";
import { natureAdresse } from "@/lib/email/nature-adresse";
import { AIMANT_GUIDE_IA } from "@/server/guide-ia/config";

import { isCrmSyncGuideEnabled } from "./config";
import { eventIdDemandeGuide } from "./event-id";
import { syncLeadMagnetRequestedToCrm, syncNewsletterOptInToCrm } from "./index";
import {
  baseLegaleDeLInscription,
  evenementInscriptionLettre,
  localeCrm,
} from "./inscription-lettre";
import type { CrmBaseLegaleLettre, CrmNatureEmail, CrmStatutLettre } from "./types";

/** `source_slug` gouverné côté CRM (tag `src:guide-ia`). */
export const SOURCE_SLUG_GUIDE = "guide-ia";

/** Nom de l'aimant côté CRM (revue CRM §4.1), depuis le nom côté site. */
export const AIMANT_CRM: Record<string, string> = {
  [AIMANT_GUIDE_IA]: "guide-ia-entreprise",
};

/** Colonnes de `newsletter_subscribers` lues pour transmettre une inscription. */
export interface AbonnePourCrm {
  readonly id: string;
  readonly email: string;
  readonly locale: string;
  readonly status: string;
  readonly source: string | null;
  readonly confirmedAt: Date | null;
  readonly consentFormRef: string | null;
  readonly consentVersion: string | null;
}

export const SELECT_ABONNE_POUR_CRM = {
  id: true,
  email: true,
  locale: true,
  status: true,
  source: true,
  confirmedAt: true,
  consentFormRef: true,
  consentVersion: true,
} as const;

export function statutLettre(abonne: Pick<AbonnePourCrm, "status"> | null): CrmStatutLettre {
  if (abonne === null) return "non_abonne";
  if (abonne.status === "confirmed") return "abonne";
  if (abonne.status === "unsubscribed") return "desabonne";
  return "non_abonne";
}

/**
 * Base légale d'une DEMANDE DU GUIDE, d'après la nature de l'adresse et la
 * lettre. Seule une adresse perso inscrite par consentement porte `consent` ;
 * tout le reste est l'information à la collecte (intérêt légitime B2B).
 */
export function baseLegaleDeLaDemande(
  nature: CrmNatureEmail,
  abonne: Pick<AbonnePourCrm, "status" | "consentVersion"> | null,
): CrmBaseLegaleLettre {
  if (nature === "perso" && abonne !== null && statutLettre(abonne) === "abonne") {
    return baseLegaleDeLInscription(abonne.consentVersion);
  }
  return "legitimate_interest_b2b";
}

/**
 * `newsletter_optin` au format L4-C (`inscription-lettre.ts`). Rend
 * l'identifiant de la ligne d'outbox, ou `null` (rien d'écrit : drapeau,
 * adresse, ou déjà transmise — l'identifiant est déterministe).
 */
export async function transmettreInscriptionLettre(abonne: AbonnePourCrm): Promise<string | null> {
  if (abonne.status !== "confirmed" || abonne.confirmedAt === null) return null;
  const subjectRef = `site:newsletter_subscriber:${abonne.id}`;
  // Déjà transmise pour CETTE inscription — par la confirmation d'un ancien
  // lien (identifiant aléatoire, antérieur à ce lot) : on ne la double pas.
  // Une réinscription plus tardive porte une date postérieure et repasse.
  const deja = await prisma.crmSyncOutbox.findFirst({
    where: { subjectRef, eventType: "newsletter_optin", createdAt: { gte: abonne.confirmedAt } },
    select: { id: true },
  });
  if (deja !== null) return null;
  return syncNewsletterOptInToCrm(
    evenementInscriptionLettre({ ...abonne, inscritLe: abonne.confirmedAt }),
  );
}

export type IssueClicGuide =
  "drapeau-ferme" | "deja-transmise" | "introuvable" | "transmise" | "echec";

/**
 * Transmet la demande `demandeId` au CRM, UNE fois : la ligne est d'abord
 * RÉSERVÉE (`crm_emitted_at` posé par un `updateMany` conditionnel), puis
 * l'événement est écrit. Deux clics simultanés, ou un clic pendant le
 * rattrapage : un seul passe. Si l'écriture échoue, la réservation est
 * relâchée et le rattrapage reprendra la ligne.
 *
 * Ne transmet qu'une demande CLIQUÉE (`first_click_at` rempli) : le GET ne
 * pose jamais `first_click_at`, il ne peut donc pas déclencher l'émission.
 */
export async function transmettreClicGuide(
  demandeId: string,
  maintenant: Date = new Date(),
): Promise<IssueClicGuide> {
  if (!isCrmSyncGuideEnabled()) return "drapeau-ferme";
  let reservee = false;
  let ecrite = false;
  const relacher = async (): Promise<void> => {
    await prisma.guideRequest
      .updateMany({
        where: { id: demandeId, crmEmittedAt: maintenant },
        data: { crmEmittedAt: null },
      })
      .catch(() => undefined);
  };
  try {
    const r = await prisma.guideRequest.updateMany({
      where: { id: demandeId, crmEmittedAt: null, firstClickAt: { not: null } },
      data: { crmEmittedAt: maintenant },
    });
    if (r.count !== 1) return "deja-transmise";
    reservee = true;

    const demande = await prisma.guideRequest.findUnique({
      where: { id: demandeId },
      select: {
        id: true,
        email: true,
        aimant: true,
        source: true,
        locale: true,
        version: true,
        firstClickAt: true,
      },
    });
    if (demande === null || demande.firstClickAt === null) {
      await relacher();
      return "introuvable";
    }

    const abonne = await prisma.newsletterSubscriber.findUnique({
      where: { email: demande.email },
      select: SELECT_ABONNE_POUR_CRM,
    });
    const nature = natureAdresse(demande.email);
    const eventId = eventIdDemandeGuide(demande.id);

    const ligne = await syncLeadMagnetRequestedToCrm({
      eventId,
      subjectRef: `site:guide_request:${demande.id}`,
      occurredAt: demande.firstClickAt,
      sourceSlug: SOURCE_SLUG_GUIDE,
      person: { email: demande.email },
      // La version de la MENTION affichée au point de collecte : c'est
      // l'information donnée, le fondement d'un demandeur sans la case.
      consent: { version: demande.version },
      payload: {
        aimant: AIMANT_CRM[demande.aimant] ?? demande.aimant,
        ...(demande.source ? { placement: demande.source } : {}),
        locale: localeCrm(demande.locale),
        // Le clic prouve la possession de la boîte (décision D1).
        verifie: true,
        email_nature: nature,
        base_legale: baseLegaleDeLaDemande(nature, abonne),
        lettre: statutLettre(abonne),
      },
    });

    if (ligne === null) {
      // Rien d'écrit. Déjà en outbox (identifiant déterministe) : la
      // réservation est juste. Sinon on la relâche, le rattrapage reprendra.
      const deja = await prisma.crmSyncOutbox.findUnique({
        where: { eventId },
        select: { id: true },
      });
      if (deja === null) {
        await relacher();
        return "echec";
      }
    }
    ecrite = true;

    // L'inscription à la lettre entre au CRM au même clic : c'est ce clic qui
    // vérifie l'adresse. Après la demande, pour que la personne existe déjà.
    if (abonne !== null) await transmettreInscriptionLettre(abonne);
    return "transmise";
  } catch (e) {
    console.error(
      `[crm-sync][guide] transmission de la demande ${demandeId} en échec :`,
      e instanceof Error ? e.message : String(e),
    );
    // Réservée mais rien d'écrit : on relâche, sinon la ligne serait perdue
    // pour le rattrapage (qui ne reprend que `crm_emitted_at` vide).
    if (reservee && !ecrite) await relacher();
    return ecrite ? "transmise" : "echec";
  }
}
