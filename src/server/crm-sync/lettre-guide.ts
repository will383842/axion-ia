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
 *     collecte », statut `non_abonne`. Le CRM refuse toute prospection d'une
 *     adresse `perso` sans abonnement (`Abonnements::prospectionAutorisee`).
 * Seul un CONSENTEMENT porte un bloc `consent` ; la version de la mention
 * affichée voyage dans `payload.version_mention` (relecture du 25/09 : un bloc
 * `consent` pour qui n'a rien coché disait le contraire de la réalité).
 *
 * Trois filtres avant toute émission (relecture du 25/09) :
 *   · EXCLUSION persistante (`CRM_SYNC_EXCLUSIONS_SHA256`, décision D4) ;
 *   · OPPOSITION à la prospection (`email_oppositions`) : rien ne part, la
 *     demande est marquée traitée (`crm_emitted_at`) ;
 *   · la demande doit être CLIQUÉE (décision D1).
 *
 * Ne lève jamais : la personne attend son PDF, le CRM n'est qu'une copie.
 * Aucune adresse dans les journaux : nom et code d'erreur seulement.
 */

import { prisma } from "@/lib/prisma";
import { natureAdresse } from "@/lib/email/nature-adresse";
import { estOpposee } from "@/server/email/opposition";
import { AIMANT_GUIDE_IA } from "@/server/guide-ia/config";
import { aPuAtteindreLeCrm } from "@/server/vivier/opposition";

import { evenementDuClicPageGuide } from "@/server/guides-reseau/clic-page-guide";
import { SOURCE_SLUG_GUIDE_RESEAU, synchroCrmV3Active } from "@/server/guides-reseau/synchro-v3";

import { isCrmSyncGuideEnabled } from "./config";
import { enqueueCrmSyncEvent, erreurSansDonnees, mettreEnFileCrm } from "./enqueue";
import { eventIdDemandeGuide } from "./event-id";
import { estExclueDuCrm } from "./exclusions";
import { syncLeadMagnetRequestedToCrm, syncNewsletterOptInToCrm } from "./index";
import {
  baseLegaleDeLInscription,
  evenementInscriptionLettre,
  localeCrm,
} from "./inscription-lettre";
import type { CrmBaseLegaleLettre, CrmNatureEmail, CrmStatutLettre, CrmSyncEvent } from "./types";

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
 * Issue d'une transmission d'INSCRIPTION à la lettre. Seule `ecrite` dit
 * qu'une ligne vient d'être posée ; `deja` qu'elle l'était ; `echec` que rien
 * n'a été écrit alors qu'il le fallait — le rattrapage la reprendra.
 */
export type IssueInscription =
  "drapeau-ferme" | "sans-objet" | "exclue" | "opposee" | "deja" | "ecrite" | "echec";

/**
 * `newsletter_optin` au format L4-C (`inscription-lettre.ts`), derrière
 * `CRM_SYNC_GUIDE_ENABLED`. Ne lève jamais.
 */
export async function transmettreInscriptionLettre(
  abonne: AbonnePourCrm,
): Promise<IssueInscription> {
  if (!isCrmSyncGuideEnabled()) return "drapeau-ferme";
  if (abonne.status !== "confirmed" || abonne.confirmedAt === null) return "sans-objet";
  try {
    if (estExclueDuCrm(abonne.email)) return "exclue";
    if (await estOpposee(abonne.email)) return "opposee";
    const evenement = evenementInscriptionLettre({ ...abonne, inscritLe: abonne.confirmedAt });
    // Déjà transmise pour CETTE inscription — par la confirmation d'un ancien
    // lien (identifiant aléatoire, antérieur à ce lot) : on ne la double pas.
    // Une réinscription plus tardive porte une date postérieure et repasse.
    const deja = await prisma.crmSyncOutbox.findFirst({
      where: {
        subjectRef: evenement.subjectRef,
        eventType: "newsletter_optin",
        createdAt: { gte: abonne.confirmedAt },
      },
      select: { id: true },
    });
    if (deja !== null) return "deja";
    const ligne = await syncNewsletterOptInToCrm(evenement);
    if (ligne !== null) return "ecrite";
    // Rien d'écrit : l'identifiant déterministe était-il déjà là (un autre
    // passage vient de l'écrire) ? Sinon c'est un échec, pas une réussite.
    const existante = await prisma.crmSyncOutbox.findUnique({
      where: { eventId: evenement.eventId },
      select: { id: true },
    });
    return existante === null ? "echec" : "deja";
  } catch (e) {
    console.error(
      `[crm-sync][guide] inscription ${abonne.id} non transmise :`,
      erreurSansDonnees(e),
    );
    return "echec";
  }
}

/** L'inscription de l'adresse, s'il y en a une, transmise. */
async function inscriptionDeLAdresse(email: string): Promise<IssueInscription> {
  const abonne = await prisma.newsletterSubscriber.findUnique({
    where: { email },
    select: SELECT_ABONNE_POUR_CRM,
  });
  return abonne === null ? "sans-objet" : transmettreInscriptionLettre(abonne);
}

/**
 * L'inscription faite APRÈS un premier clic déjà transmis (relecture du
 * 25/09) : adresse perso sans la case → clic (transmis `non_abonne`) → nouvelle
 * demande avec la case (inscrite). L'adresse est déjà vérifiée par le clic :
 * l'inscription part tout de suite, sans attendre un second clic.
 *
 * Appelée par `guide-ia/demande.ts` juste après l'inscription. Rien si le
 * drapeau est fermé (aucune lecture) ou si la demande n'a pas été cliquée.
 */
export async function transmettreInscriptionApresClic(
  demandeId: string,
): Promise<IssueInscription | "sans-clic"> {
  if (!isCrmSyncGuideEnabled()) return "drapeau-ferme";
  try {
    const demande = await prisma.guideRequest.findUnique({
      where: { id: demandeId },
      select: { email: true, firstClickAt: true, crmEmittedAt: true },
    });
    if (demande === null || demande.firstClickAt === null || demande.crmEmittedAt === null) {
      return "sans-clic";
    }
    return await inscriptionDeLAdresse(demande.email);
  } catch (e) {
    console.error(
      `[crm-sync][guide] inscription après clic (demande ${demandeId}) :`,
      erreurSansDonnees(e),
    );
    return "echec";
  }
}

/**
 * Une ligne d'outbox PEUT atteindre le CRM : envoyée, en attente, en échec
 * rejouable, ou abandonnée après une tentative réelle sans refus 4xx
 * (`aPuAtteindreLeCrm`, la règle du vivier). Seul un refus DÉFINITIF (4xx,
 * ou abandon sans tentative) dit que la personne n'y est pas.
 */
export function peutAtteindreLeCrm(row: {
  status: string;
  attempts: number;
  responseStatus: number | null;
}): boolean {
  return row.status !== "gave_up" || aPuAtteindreLeCrm(row);
}

/**
 * La personne est-elle — ou sera-t-elle — connue du CRM par la lettre ou le
 * guide ? Il faut une ligne `newsletter_optin` de l'abonné, ou une ligne
 * `lead_magnet_requested` d'une de ses demandes, qui puisse l'atteindre.
 * Sans cela, un rebond ferait voyager au CRM l'adresse de quelqu'un qui n'y
 * a jamais eu de fiche (relecture du 25/09, sur le modèle du vivier).
 */
export async function aPuEntrerAuCrmParLaLettreOuLeGuide(abonne: {
  readonly id: string;
  readonly email: string;
}): Promise<boolean> {
  const select = { status: true, attempts: true, responseStatus: true } as const;
  const inscriptions = await prisma.crmSyncOutbox.findMany({
    where: { subjectRef: `site:newsletter_subscriber:${abonne.id}`, eventType: "newsletter_optin" },
    select,
  });
  if (inscriptions.some((l) => peutAtteindreLeCrm({ ...l, status: String(l.status) }))) return true;
  const demandes = await prisma.guideRequest.findMany({
    where: { email: abonne.email },
    select: { id: true },
  });
  if (demandes.length === 0) return false;
  const clics = await prisma.crmSyncOutbox.findMany({
    where: {
      subjectRef: { in: demandes.map((d) => `site:guide_request:${d.id}`) },
      eventType: "lead_magnet_requested",
    },
    select,
  });
  return clics.some((l) => peutAtteindreLeCrm({ ...l, status: String(l.status) }));
}

export type IssueClicGuide =
  | "drapeau-ferme"
  | "deja-transmise"
  | "introuvable"
  | "transmise"
  /** La demande est partie, l'inscription qui l'accompagne n'a pas été écrite. */
  | "inscription-non-ecrite"
  | "opposee"
  | "exclue"
  | "echec";

/** Levée DANS la transaction pour l'annuler : rien n'a été écrit. */
class RienEcrit extends Error {
  constructor() {
    super("rien écrit");
    this.name = "RienEcrit";
  }
}

/**
 * Transmet la demande `demandeId` au CRM, UNE fois. La réservation
 * (`crm_emitted_at` posé par un `updateMany` conditionnel) et l'écriture de
 * la ligne d'outbox se font dans UNE transaction : les deux, ou aucune. Deux
 * clics simultanés, ou un clic pendant le rattrapage : un seul passe. La mise
 * en file vient APRÈS le commit, sans être attendue.
 *
 * Ne transmet qu'une demande CLIQUÉE (`first_click_at` rempli) : le GET ne
 * pose jamais `first_click_at`, il ne peut donc pas déclencher l'émission.
 *
 * Demande DÉJÀ transmise : l'inscription à la lettre, elle, peut ne pas
 * l'être (faite après le premier clic) — elle est transmise à ce clic-ci.
 */
/**
 * Opposition : les origines de la personne, de TOUS ses guides (l'opposition porte sur l'adresse, pas
 * sur un guide), passent `ecartee` (mise à l'écart, JAMAIS de suppression) pour n'être plus reproposées. Sans effet tant que `SYNCHRO_CRM_V3` est éteint
 * (les colonnes ne sont alors jamais lues ni écrites). Hors transaction, une erreur est avalée :
 * l'opposition, elle, est déjà actée.
 */
async function ecarterOriginesDeLaPersonne(
  db: Pick<typeof prisma, "guideReseauOrigine">,
  emailKey: string,
  quand: Date,
): Promise<void> {
  if (!synchroCrmV3Active()) return;
  const ecrire = () =>
    db.guideReseauOrigine.updateMany({
      where: { emailKey, archiveeLe: null, crmStatut: null },
      data: { crmStatut: "ecartee", crmTraiteeLe: quand },
    });
  if (db !== prisma) {
    await ecrire();
    return;
  }
  try {
    await ecrire();
  } catch {
    /* mise à l'écart non écrite : le rattrapage la refera, rien ne part (opposition relue) */
  }
}

export async function transmettreClicGuide(
  demandeId: string,
  maintenant: Date = new Date(),
): Promise<IssueClicGuide> {
  if (!isCrmSyncGuideEnabled()) return "drapeau-ferme";
  try {
    const demande = await prisma.guideRequest.findUnique({
      where: { id: demandeId },
      select: {
        id: true,
        email: true,
        emailKey: true,
        origine: true,
        aimant: true,
        source: true,
        locale: true,
        version: true,
        firstClickAt: true,
        crmEmittedAt: true,
      },
    });
    if (demande === null || demande.firstClickAt === null) return "introuvable";

    // Exclusion persistante : rien n'est posé. Retirer l'empreinte de
    // l'environnement rendrait la demande au rattrapage.
    if (estExclueDuCrm(demande.email)) return "exclue";

    if (demande.crmEmittedAt !== null) {
      await inscriptionDeLAdresse(demande.email);
      return "deja-transmise";
    }

    // Opposée à la prospection : rien ne part, et la demande est TRAITÉE
    // (`crm_emitted_at`) pour que le rattrapage ne la repropose pas.
    if (await estOpposee(demande.email)) {
      const r = await prisma.guideRequest.updateMany({
        where: { id: demande.id, crmEmittedAt: null },
        data: { crmEmittedAt: maintenant },
      });
      await ecarterOriginesDeLaPersonne(prisma, demande.emailKey, maintenant);
      return r.count === 1 ? "opposee" : "deja-transmise";
    }

    const abonne = await prisma.newsletterSubscriber.findUnique({
      where: { email: demande.email },
      select: SELECT_ABONNE_POUR_CRM,
    });
    const nature = natureAdresse(demande.email);
    const base = baseLegaleDeLaDemande(nature, abonne);
    const eventId = eventIdDemandeGuide(demande.id);
    const firstClickAt = demande.firstClickAt;
    // Lot S3 : une demande venue d'un réseau, avec `SYNCHRO_CRM_V3` allumé, porte la source
    // `guide-reseau` et, si la page a laissé un consentement, le bloc v3 (prénom, accord, guide
    // reçu, origine). Éteint : chemin v1 inchangé.
    const v3 = synchroCrmV3Active();
    const viaReseau = v3 && demande.origine === "message_prive";
    // Lot guide réseau 4 (D5) : une demande née d'ailleurs (formulaire) garde SA source, mais les
    // origines réseau de la personne partent quand même (v3 allumé).
    const sourceDemande = viaReseau ? SOURCE_SLUG_GUIDE_RESEAU : SOURCE_SLUG_GUIDE;

    // Ce que v1 envoie : conservé tel quel dans la charge v3 (rien n'est perdu en changeant de version).
    const consentV1 =
      base === "consent" && abonne !== null
        ? { version: abonne.consentVersion, at: abonne.confirmedAt }
        : null;
    const payloadV1 = {
      aimant: AIMANT_CRM[demande.aimant] ?? demande.aimant,
      ...(demande.source ? { placement: demande.source } : {}),
      locale: localeCrm(demande.locale),
      // Le clic prouve la possession de la boîte (décision D1).
      verifie: true,
      email_nature: nature,
      base_legale: base,
      lettre: statutLettre(abonne),
      // La version de la MENTION affichée au point de collecte :
      // l'information donnée, fondement d'un demandeur sans la case.
      version_mention: demande.version,
    };

    let outboxId: string | null = null;
    let reservee = false;
    let opposeePendantLaTransaction = false;
    try {
      outboxId = await prisma.$transaction(async (tx) => {
        const r = await tx.guideRequest.updateMany({
          where: { id: demande.id, crmEmittedAt: null, firstClickAt: { not: null } },
          data: { crmEmittedAt: maintenant },
        });
        if (r.count !== 1) return null;
        reservee = true;
        if (v3) {
          // Même verrou consultatif que `transmettreOriginesSuivantes` (synchro-v3.ts) : une origine
          // écrite pendant ce clic attend la validation du clic au lieu de voir `crmEmittedAt` vide.
          // ORDRE DES VERROUS (comme page-confirmation.ts) : d'abord la ligne de la demande
          // (l'`updateMany` ci-dessus), ENSUITE `origines:<clé>`, avant de lire les origines.
          // L'inverse ferait un interblocage avec la page « Recevoir le guide ».
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"origines:" + demande.emailKey}))`;
          // Nouveau contrôle d'opposition, DANS la transaction, juste avant d'écrire : une
          // opposition arrivée depuis la lecture du début l'emporte. La demande reste réservée
          // (traitée), rien n'est supprimé, aucune ligne d'outbox n'est écrite ; les origines
          // sont MISES À L'ÉCART (`ecartee`), jamais supprimées.
          if (await estOpposee(demande.email, tx)) {
            await ecarterOriginesDeLaPersonne(tx, demande.emailKey, maintenant);
            opposeePendantLaTransaction = true;
            return null;
          }
          const lecture = await evenementDuClicPageGuide(
            tx,
            demande,
            firstClickAt,
            { ...(consentV1 ? { consent: consentV1 } : {}), payloadBase: payloadV1 },
            sourceDemande,
          );
          if (lecture.ok) {
            const id = await enqueueCrmSyncEvent(lecture.evenement as unknown as CrmSyncEvent, {
              tx,
              mettreEnFile: false,
            });
            if (id === null) throw new RienEcrit();
            // Même transaction que l'événement : les origines portées sont marquées parties.
            if (lecture.origineIds.length > 0) {
              await tx.guideReseauOrigine.updateMany({
                where: { id: { in: lecture.origineIds }, crmStatut: null },
                data: { crmStatut: "transmise", crmTraiteeLe: maintenant },
              });
            }
            return id;
          }
          // Sans bloc v3 (aucune origine, prénom illisible, ou valeur hors format CRM) : l'événement
          // v1 part tel quel, sans optin ni prénom, avec la source de la demande.
        }
        const ligne = await syncLeadMagnetRequestedToCrm({
          eventId,
          subjectRef: `site:guide_request:${demande.id}`,
          occurredAt: firstClickAt,
          sourceSlug: sourceDemande,
          person: { email: demande.email },
          // Un bloc `consent` pour un CONSENTEMENT seulement : la case cochée
          // (adresse perso inscrite). Sinon, aucun — personne n'a consenti.
          ...(consentV1 ? { consent: consentV1 } : {}),
          payload: payloadV1,
          tx,
          mettreEnFile: false,
        });
        if (ligne === null) throw new RienEcrit();
        return ligne;
      });
    } catch (e) {
      if (!(e instanceof RienEcrit)) throw e;
      // Transaction annulée : la réservation aussi. L'identifiant
      // déterministe était-il déjà en outbox (écrit par un autre passage) ?
      // Alors la demande EST transmise : on pose la trace. Sinon, échec — la
      // ligne reste au rattrapage (`crm_emitted_at` vide).
      const deja = await prisma.crmSyncOutbox.findUnique({
        where: { eventId },
        select: { id: true },
      });
      if (deja === null) return "echec";
      await prisma.guideRequest.updateMany({
        where: { id: demande.id, crmEmittedAt: null },
        data: { crmEmittedAt: maintenant },
      });
      reservee = true;
    }

    if (opposeePendantLaTransaction) return "opposee";
    // Un autre passage a réservé entre notre lecture et la transaction.
    if (!reservee) {
      await inscriptionDeLAdresse(demande.email);
      return "deja-transmise";
    }
    if (outboxId !== null) mettreEnFileCrm(outboxId);

    // L'inscription à la lettre entre au CRM au même clic : c'est ce clic qui
    // vérifie l'adresse. Après la demande, pour que la personne existe déjà.
    if (abonne !== null) {
      const inscription = await transmettreInscriptionLettre(abonne);
      if (inscription === "echec") return "inscription-non-ecrite";
    }
    return "transmise";
  } catch (e) {
    console.error(
      `[crm-sync][guide] transmission de la demande ${demandeId} en échec :`,
      erreurSansDonnees(e),
    );
    return "echec";
  }
}
