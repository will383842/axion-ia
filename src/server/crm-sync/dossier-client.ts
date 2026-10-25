/**
 * Synchro AUTOMATIQUE du dossier d'un client vers le CRM Pro (console → CRM,
 * décision de Will du 25/10/2026) : lecture, comparaison, émission.
 *
 * ── Principe ────────────────────────────────────────────────────────────────
 * Pas de clic, pas de proposition. Le dossier est relu, mis en photo
 * (`instantane-dossier.ts`, liste blanche), et comparé à l'EMPREINTE du dernier
 * dossier émis (`crm_dossier_synchro`). Différente ⇒ UNE ligne d'outbox
 * `dossier_client_synchro` (version + 1) ; identique ⇒ rien. Le même dossier
 * ne part donc jamais deux fois, et un écrivain oublié n'est pas un trou : le
 * balayage du worker relit tous les clients, quel que soit celui qui a écrit.
 *
 * ── Garde-fous ──────────────────────────────────────────────────────────────
 *   · drapeau `CRM_SYNC_DOSSIER_ENABLED` fermé ⇒ AUCUNE lecture, aucune écriture ;
 *   · seules les fiches `entreprise` partent (un particulier n'est pas une
 *     société du CRM) ;
 *   · aucune suppression : une fiche supprimée, un contact parti ou une valeur
 *     vidée ne produit rien (la photo omet les valeurs vides) ;
 *   · l'outbox et l'état de synchro s'écrivent dans la MÊME transaction : pas
 *     de version consommée sans ligne d'envoi ;
 *   · ne lève jamais : un échec se rejoue au prochain balayage.
 *
 * ── Ce qui est lu ───────────────────────────────────────────────────────────
 * Colonnes en clair seulement. Les réponses des questionnaires ne sont ni
 * sélectionnées ni déchiffrées : on ne compte que des lignes.
 */

import { prisma } from "@/lib/prisma";

import { isCrmSyncDossierEnabled } from "./config";
import { lireEntreeDossier } from "./lire-dossier";
import {
  dossierPourCrm,
  empreinteDossier,
  entreprisePourCrm,
  evenementDossierClient,
} from "./instantane-dossier";
import {
  enqueueCrmSyncEvent,
  erreurSansDonnees,
  mettreEnFileCrm,
  type CrmOutboxWriter,
} from "./enqueue";

export type IssueSynchroDossier = "emis" | "inchange" | "ignore" | "ferme" | "erreur";

/** Plafond de fiches relues par balayage. */
export const BALAYAGE_DOSSIERS_MAX = 1000;

/** Colonnes de l'état de synchro, lues et écrites par ce module seulement. */
interface EtatSynchro {
  readonly version: number;
  readonly empreinte: string | null;
}

/**
 * Relit UN client et, si son dossier a changé depuis le dernier envoi, pose
 * l'événement dans l'outbox. Ne lève jamais.
 */
export async function synchroniserDossierClient(
  clientId: string,
  maintenant: Date = new Date(),
): Promise<IssueSynchroDossier> {
  if (!isCrmSyncDossierEnabled()) return "ferme";
  try {
    const lu = await lireEntreeDossier(clientId, maintenant);
    if (lu === null) return "ignore";

    const empreinte = empreinteDossier(entreprisePourCrm(lu.entree), dossierPourCrm(lu.entree));
    const etat: EtatSynchro | null = await prisma.crmDossierSynchro.findUnique({
      where: { clientId },
      select: { version: true, empreinte: true },
    });
    if (etat?.empreinte === empreinte) return "inchange";

    const version = (etat?.version ?? 0) + 1;
    const evenement = evenementDossierClient(lu.entree, version, lu.dernierChangement);

    const ligneId = await prisma.$transaction(async (tx) => {
      const id = await enqueueCrmSyncEvent(evenement, {
        tx: tx as unknown as CrmOutboxWriter,
        mettreEnFile: false,
      });
      // `null` : drapeau fermé, doublon ou échec d'écriture. Dans tous les cas
      // la version ne doit PAS être consommée : on annule tout.
      if (id === null) throw new Error("outbox-non-ecrite");
      await tx.crmDossierSynchro.upsert({
        where: { clientId },
        create: { clientId, version, empreinte, emisLe: maintenant },
        update: { version, empreinte, emisLe: maintenant },
      });
      return id;
    });
    mettreEnFileCrm(ligneId);
    return "emis";
  } catch (e) {
    console.error("[crm-sync] dossier client non synchronisé :", erreurSansDonnees(e));
    return "erreur";
  }
}

/**
 * Relit les clients et synchronise ceux dont le dossier a changé. Passage
 * périodique du worker : c'est lui qui rend la synchro automatique sans qu'un
 * écrivain ait à y penser. Un passage manqué est rattrapé par le suivant.
 */
export async function balayerDossiersClients(
  maintenant: Date = new Date(),
): Promise<{ lus: number; emis: number; erreurs: number }> {
  if (!isCrmSyncDossierEnabled()) return { lus: 0, emis: 0, erreurs: 0 };
  const clients = await prisma.client.findMany({
    where: { type: "entreprise" },
    orderBy: { id: "asc" },
    take: BALAYAGE_DOSSIERS_MAX,
    select: { id: true },
  });
  let emis = 0;
  let erreurs = 0;
  for (const { id } of clients) {
    const issue = await synchroniserDossierClient(id, maintenant);
    if (issue === "emis") emis += 1;
    if (issue === "erreur") erreurs += 1;
  }
  return { lus: clients.length, emis, erreurs };
}
