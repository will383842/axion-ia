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

import { hashEmailForLookup } from "@/lib/security/email-hash";
import { prisma } from "@/lib/prisma";
import {
  dossierPourCrm,
  empreinteDossier,
  entreprisePourCrm,
  evenementDossierClient,
  type ContactPourCrm,
  type EntreeInstantaneCrm,
} from "@/server/crm-sync/instantane-dossier";
import { sirenTransmis } from "@/server/partners-sync/producteurs/client";

import { isCrmSyncDossierEnabled } from "./config";
import {
  enqueueCrmSyncEvent,
  erreurSansDonnees,
  mettreEnFileCrm,
  type CrmOutboxWriter,
} from "./enqueue";
import { adressesOpposees } from "./oppositions-par-lot";

export type IssueSynchroDossier = "emis" | "inchange" | "ignore" | "ferme" | "erreur";

/** Plafond de fiches relues par balayage. */
export const BALAYAGE_DOSSIERS_MAX = 1000;

/**
 * Dernier `id` relu par le balayage : le passage suivant reprend après lui, puis
 * repart du début quand la liste est épuisée. Sans lui, au-delà du plafond les
 * mêmes premières fiches seraient relues pour toujours. Le worker n'a qu'un
 * passage à la fois (`concurrency: 1`) ; un redémarrage repart du début, sans dommage.
 */
let curseurBalayage: string | null = null;

/** Pour les tests : le balayage repart du début. */
export function reinitialiserCurseurBalayage(): void {
  curseurBalayage = null;
}

/** Colonnes de l'état de synchro, lues et écrites par ce module seulement. */
interface EtatSynchro {
  readonly version: number;
  readonly empreinte: string | null;
}

function plusRecent(dates: ReadonlyArray<Date | null | undefined>, repli: Date): Date {
  let max = 0;
  for (const d of dates) if (d instanceof Date && d.getTime() > max) max = d.getTime();
  return new Date(max === 0 ? repli.getTime() : Math.min(max, repli.getTime()));
}

/**
 * Case « Facture établie hors console » (`client_factures_hors_console`, PR
 * #1684). La table peut ne pas exister encore (la migration atterrit avant le
 * code, mais pas forcément avant celui-ci) : absente ⇒ « non », jamais une
 * erreur. Lecture seule, une colonne (l'existence de la ligne).
 */
async function factureHorsConsole(clientIds: readonly string[]): Promise<boolean> {
  const lignes = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT CASE WHEN to_regclass('client_factures_hors_console') IS NULL THEN false
           ELSE EXISTS (SELECT 1 FROM client_factures_hors_console WHERE client_id = ANY(${clientIds as string[]}::uuid[]))
           END AS ok`;
  return lignes[0]?.ok === true;
}

/** Lit un client et en fait l'entrée de la photo. `null` : à ne pas synchroniser. */
export async function lireEntreeDossier(
  clientId: string,
  maintenant: Date,
): Promise<{ entree: EntreeInstantaneCrm; dernierChangement: Date } | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      numero: true,
      type: true,
      raisonSociale: true,
      siren: true,
      siret: true,
      adresseRue: true,
      adresseCodePostal: true,
      adresseVille: true,
      effectif: true,
      updatedAt: true,
      // Fusion non défaite : cette fiche est absorbée (rien n'est émis) ou absorbante
      // (elle lit aussi les pièces des fiches qu'elle a absorbées).
      fusionsAbsorbee: { where: { defaiteLe: null }, select: { id: true } },
      fusionsAbsorbante: { where: { defaiteLe: null }, select: { absorbeId: true } },
      contacts: {
        select: {
          id: true,
          nom: true,
          fonction: true,
          telephone: true,
          statut: true,
          origine: true,
          partiLe: true,
          updatedAt: true,
          adresses: {
            select: { email: true, nature: true, ajouteeLe: true },
            orderBy: { ajouteeLe: "asc" },
          },
        },
      },
    },
  });
  if (client === null || client.type !== "entreprise") return null;
  // Une fiche absorbée est un doublon fusionné : elle ne part pas comme dossier à part.
  if (client.fusionsAbsorbee.length > 0) return null;
  // Factures, case hors console et questionnaires : la fiche ET ses fiches absorbées.
  const ids = [clientId, ...client.fusionsAbsorbante.map((f) => f.absorbeId)];

  const [factures, horsConsole, questionnaires] = await Promise.all([
    prisma.factureFormation.findMany({
      where: { clientId: { in: ids }, statut: { notIn: ["brouillon", "annulee"] }, emiseAt: { not: null } },
      select: { emiseAt: true },
    }),
    factureHorsConsole(ids),
    prisma.questionnaireAvantAudit.findMany({
      where: { OR: [{ clientId: { in: ids } }, { rencontre: { clientId: { in: ids } } }] },
      select: {
        envoyeLe: true,
        // Des dates et des modes : jamais `donnees`.
        envois: { where: { ecarteLe: null }, select: { mode: true, recuLe: true } },
      },
    }),
  ]);

  const envoyes = questionnaires.flatMap((q) => (q.envoyeLe ? [q.envoyeLe] : []));
  const recus = questionnaires.flatMap((q) => q.envois.map((e) => e.recuLe));
  const equipe = questionnaires.reduce(
    (n, q) => n + q.envois.filter((e) => e.mode === "emp").length,
    0,
  );

  // L'opposition gagne : registre `email_oppositions`, sur TOUTES les adresses de
  // chaque contact (une personne opposée l'est quelle que soit l'adresse).
  const opposees = await adressesOpposees(
    client.contacts.flatMap((c) => c.adresses.map((a) => a.email)),
  );

  const contacts: ContactPourCrm[] = client.contacts.map((c) => {
    // Pro d'abord ; une adresse non pro est repérée comme telle et ne part pas.
    const choisie = c.adresses.find((a) => a.nature === "pro") ?? c.adresses[0] ?? null;
    const email = choisie?.email ?? null;
    return {
      id: c.id,
      nom: c.nom,
      fonction: c.fonction,
      telephone: c.telephone,
      email,
      emailType: choisie === null ? null : choisie.nature === "pro" ? "pro" : "perso",
      origine: c.origine,
      emailHash: email === null ? null : hashEmailForLookup(email),
      oppose: c.adresses.some((a) => opposees.has(a.email.trim().toLowerCase())),
      parti: c.statut !== "actif" || c.partiLe !== null,
    };
  });

  const entree: EntreeInstantaneCrm = {
    clientId: client.id,
    numero: client.numero,
    type: "entreprise",
    raisonSociale: client.raisonSociale,
    siren: sirenTransmis({ siren: client.siren, siret: client.siret }).siren,
    adresseRue: client.adresseRue,
    adresseCodePostal: client.adresseCodePostal,
    adresseVille: client.adresseVille,
    telephone: null,
    effectif: client.effectif,
    factureEmise: factures.length > 0,
    factureHorsConsole: horsConsole,
    questionnaire:
      questionnaires.length === 0
        ? null
        : {
            envoyeLe: envoyes.length
              ? new Date(Math.max(...envoyes.map((d) => d.getTime())))
              : null,
            recuLe: recus.length ? new Date(Math.max(...recus.map((d) => d.getTime()))) : null,
            nbReponsesEquipe: equipe,
          },
    contacts,
  };

  const dernierChangement = plusRecent(
    [
      client.updatedAt,
      ...client.contacts.map((c) => c.updatedAt),
      ...factures.map((f) => f.emiseAt),
      ...envoyes,
      ...recus,
    ],
    maintenant,
  );
  return { entree, dernierChangement };
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
    if (evenement === null) return "ignore";

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
    where: {
      type: "entreprise",
      fusionsAbsorbee: { none: { defaiteLe: null } },
      ...(curseurBalayage === null ? {} : { id: { gt: curseurBalayage } }),
    },
    orderBy: { id: "asc" },
    take: BALAYAGE_DOSSIERS_MAX,
    select: { id: true },
  });
  if (clients.length >= BALAYAGE_DOSSIERS_MAX) {
    curseurBalayage = clients[clients.length - 1]!.id;
    console.warn(
      `[crm-sync] balayage des dossiers : plafond de ${BALAYAGE_DOSSIERS_MAX} fiches atteint, la suite au prochain passage`,
    );
  } else {
    curseurBalayage = null;
  }
  let emis = 0;
  let erreurs = 0;
  for (const { id } of clients) {
    const issue = await synchroniserDossierClient(id, maintenant);
    if (issue === "emis") emis += 1;
    if (issue === "erreur") erreurs += 1;
  }
  return { lus: clients.length, emis, erreurs };
}
