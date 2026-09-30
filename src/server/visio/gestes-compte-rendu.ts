/**
 * Les GESTES DE WILL sur un compte rendu (chantier visio, PR 6) — fonctions
 * de domaine, appelées par les actions serveur de la console
 * (`src/features/dossier-client/compte-rendu-gestes.ts`) et par la chaîne
 * de Gate D. Aucune ne parle à OpenAI : elles PROGRAMMENT des étapes, que le
 * worker exécute.
 *
 *   · Valider le compte rendu (⇒ purge du son, décision B1) — REFUSÉ tant
 *     que les voix de la piste client ne sont pas attribuées quand il y en a
 *     plusieurs, et tant que le signal G16 « accord d'une personne non
 *     retrouvé » n'est pas levé par Will ;
 *   · Réécrire (P5 sur les mêmes faits), Réextraire (P1 depuis la
 *     transcription), Compléter après rattachement (P2 et suivantes, SANS
 *     refaire P1) ;
 *   · Attribuer une voix (« CLIENT_1 = … »), ajouter la personne comme contact,
 *     ou dire que c'est la voix de Williams (écho) ;
 *   · Confirmer à la main l'accord de chaque personne (G16) ;
 *   · Confirmer qu'un enregistrement de moins de 90 s doit être traité ;
 *   · Reprendre les étapes suspendues (crédit rechargé, configuration corrigée).
 */

import type { PrismaClient } from "../../../prisma/generated/client";
import { NOM_WILLIAMS } from "@/features/dossier-client/rencontre-calendly";
import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";
import {
  accordAConfirmer,
  EVT_ACCORD_CONFIRME_PAR_WILL,
  rencontreAccordAConfirmer,
} from "./accord-a-confirmer";
import { etatSansTexteBrut, lireEtat } from "./etat-compte-rendu";
import { ajouterAuJournal } from "./journal-enregistrement";
import { annulerEtapesDesVersions, planifierDans } from "./prise-d-etape";

type Db = PrismaClient;

export class GesteRefuse extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GesteRefuse";
  }
}

// ── Voix ─────────────────────────────────────────────────────────────────────

/** À qui les passages d'une voix de la piste client sont attribués (`null` : à personne). */
export interface AttributionVoix {
  readonly voix: string;
  readonly participantId: string | null;
}

/**
 * Les voix de la piste client sans personne attribuée, QUAND il y en a
 * plusieurs. Une seule voix n'exige rien (c'est l'interlocuteur).
 *
 * L'attribution se lit sur les PASSAGES (`transcription_segments.participant_id`),
 * pas sur la personne : une même personne peut porter DEUX voix (la
 * diarisation coupe parfois une personne en deux), et en attribuer une seconde
 * n'efface pas la première. Fonction PURE.
 */
export function voixNonAttribuees(
  voixClient: readonly string[],
  attributions: readonly AttributionVoix[],
): string[] {
  if (voixClient.length <= 1) return [];
  return voixClient.filter(
    (v) =>
      !attributions.some((a) => a.voix === v) ||
      attributions.some((a) => a.voix === v && a.participantId === null),
  );
}

type LecteurSegments = Pick<PrismaClient, "transcriptionSegment">;

/** Les voix de la piste client de la transcription retenue, et à qui chacune est attribuée. */
export async function lireVoix(
  db: LecteurSegments,
  rencontreId: string,
): Promise<{ readonly voixClient: string[]; readonly attributions: AttributionVoix[] }> {
  const lignes = await db.transcriptionSegment.findMany({
    where: {
      piste: "client",
      horsAccord: false,
      apresRefus: false,
      transcription: { statut: "retenue", enregistrement: { rencontreId } },
    },
    distinct: ["locuteurBrut", "participantId"],
    orderBy: { debutMs: "asc" },
    select: { locuteurBrut: true, participantId: true },
  });
  const attributions = lignes.map((l) => ({
    voix: l.locuteurBrut ?? "A",
    participantId: l.participantId ?? null,
  }));
  return { voixClient: [...new Set(attributions.map((a) => a.voix))], attributions };
}

/** Les voix de la piste client de la transcription retenue d'une rencontre. */
export async function voixDeLaRencontre(
  db: LecteurSegments,
  rencontreId: string,
): Promise<string[]> {
  return (await lireVoix(db, rencontreId)).voixClient;
}

/**
 * ⛔ « Valider tous » (et la validation du compte rendu) sont REFUSÉS tant que
 * la correspondance des voix n'est pas faite quand la piste client en porte
 * plusieurs. Appelée (par `exigerValidationPossible`) par `validerCompteRendu`
 * et, dans sa transaction, par `validerApresLAppel`
 * (`src/features/dossier-client/valider.ts`).
 */
export async function exigerVoixAttribuees(
  db: LecteurSegments,
  rencontreId: string,
): Promise<void> {
  const { voixClient, attributions } = await lireVoix(db, rencontreId);
  const manquantes = voixNonAttribuees(voixClient, attributions);
  if (manquantes.length > 0) {
    throw new GesteRefuse(
      `Plusieurs personnes ont parlé côté client : dites d'abord qui est qui (voix ${manquantes
        .map((v) => `CLIENT_${voixClient.indexOf(v) + 1}`)
        .join(", ")}).`,
    );
  }
}

/**
 * ⛔ G16 — « Valider tous » (et la validation du compte rendu) sont REFUSÉS
 * tant que le signal « accord d'une personne non retrouvé » n'a pas été levé
 * par la confirmation à la main de Will (`confirmerAccordALaMain`).
 */
export async function exigerAccordConfirme(
  db: Pick<PrismaClient, "enregistrement">,
  rencontreId: string,
): Promise<void> {
  const enregistrements = await db.enregistrement.findMany({
    where: { rencontreId },
    select: { evenements: true },
  });
  if (rencontreAccordAConfirmer(enregistrements)) {
    throw new GesteRefuse(
      "L'accord d'une personne qui a parlé côté client n'a pas été retrouvé dans l'enregistrement : " +
        "confirmez d'abord que chacune a donné son accord (ou retirez l'accord du client).",
    );
  }
}

/** Ce que les exigences de validation lisent (client ou transaction). */
type LecteurValidation = Pick<PrismaClient, "transcriptionSegment" | "enregistrement">;

/**
 * ⛔ Les DEUX exigences de toute validation d'un rendez-vous enregistré :
 * l'accord de chaque personne (G16), puis la correspondance des voix.
 */
export async function exigerValidationPossible(
  db: LecteurValidation,
  rencontreId: string,
): Promise<void> {
  await exigerAccordConfirme(db, rencontreId);
  await exigerVoixAttribuees(db, rencontreId);
}

/** G16 : Will confirme à la main que chaque personne qui a parlé a donné son accord. */
export async function confirmerAccordALaMain(
  db: Db,
  a: { readonly rencontreId: string; readonly maintenant: Date },
): Promise<void> {
  const enregistrements = await db.enregistrement.findMany({
    where: { rencontreId: a.rencontreId },
    select: { id: true, evenements: true },
  });
  const aConfirmer = enregistrements.filter((e) => accordAConfirmer(e.evenements));
  if (aConfirmer.length === 0) throw new GesteRefuse("Aucun accord n'attend votre confirmation.");
  await db.$transaction(async (tx) => {
    for (const e of aConfirmer) {
      await tx.enregistrement.update({
        where: { id: e.id },
        data: {
          evenements: ajouterAuJournal(e.evenements, {
            le: a.maintenant,
            type: EVT_ACCORD_CONFIRME_PAR_WILL,
          }),
        },
      });
    }
  });
}

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

/** Attribue les passages d'une voix à une personne (dans une transaction). */
async function attribuerDans(
  tx: Tx,
  a: {
    readonly rencontreId: string;
    readonly voix: string;
    readonly participantId: string;
    readonly maintenant: Date;
  },
): Promise<void> {
  // L'étiquette de la personne ne sert qu'à l'affichage : l'attribution qui
  // compte est celle des PASSAGES, qu'une seconde voix n'efface pas.
  await tx.rencontreParticipant.updateMany({
    where: { rencontreId: a.rencontreId, etiquetteVoix: a.voix, NOT: { id: a.participantId } },
    data: { etiquetteVoix: null, voixValideeLe: null },
  });
  await tx.rencontreParticipant.update({
    where: { id: a.participantId },
    data: { etiquetteVoix: a.voix, voixValideeLe: a.maintenant },
  });
  await tx.transcriptionSegment.updateMany({
    where: {
      piste: "client",
      locuteurBrut: a.voix,
      transcription: { statut: "retenue", enregistrement: { rencontreId: a.rencontreId } },
    },
    data: { participantId: a.participantId, etiquetteVoix: a.voix },
  });
}

/**
 * « CLIENT_1 = … » : attribue une voix à une personne présente — une personne
 * du client, ou Williams lui-même (écho de sa voix sur la piste client).
 */
export async function attribuerVoix(
  db: Db,
  a: {
    readonly rencontreId: string;
    readonly voix: string;
    readonly participantId: string;
    readonly maintenant: Date;
  },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const p = await tx.rencontreParticipant.findFirst({
      where: {
        id: a.participantId,
        rencontreId: a.rencontreId,
        role: { in: ["client", "axion"] },
      },
      select: { id: true },
    });
    if (!p) throw new GesteRefuse("Cette personne ne fait pas partie de ce rendez-vous.");
    await attribuerDans(tx, { ...a, participantId: p.id });
  });
}

/**
 * « Ajouter comme contact » : une personne a parlé sans être prévue (un
 * collègue absent de la réservation). Elle devient un participant du
 * rendez-vous — et une personne de la fiche client (`origine = saisie`) quand
 * le rendez-vous est rangé chez un client —, puis la voix lui est attribuée.
 * La correspondance des voix peut ainsi TOUJOURS être complétée.
 */
export async function ajouterPersonnePourVoix(
  db: Db,
  a: {
    readonly rencontreId: string;
    readonly voix: string;
    readonly nom: string;
    readonly fonction: string | null;
    readonly parAdminId: string;
    readonly maintenant: Date;
  },
): Promise<void> {
  const nom = a.nom.trim().replace(/\s+/g, " ");
  if (nom.length < 2 || nom.length > 200) throw new GesteRefuse("Écrivez le nom de la personne.");
  const fonction = a.fonction?.trim().slice(0, 150) || null;
  await db.$transaction(async (tx) => {
    const r = await tx.rencontre.findUnique({
      where: { id: a.rencontreId },
      select: { id: true, clientId: true },
    });
    if (!r) throw new GesteRefuse("Rendez-vous introuvable.");
    const contact =
      r.clientId === null
        ? null
        : await tx.clientContact.create({
            data: {
              clientId: r.clientId,
              nom,
              fonction,
              origine: "saisie",
              creeParId: a.parAdminId,
            },
            select: { id: true },
          });
    const p = await tx.rencontreParticipant.create({
      data: {
        rencontreId: r.id,
        clientId: r.clientId,
        contactId: contact?.id ?? null,
        nomAffiche: nom,
        role: "client",
      },
      select: { id: true },
    });
    await attribuerDans(tx, { ...a, participantId: p.id });
  });
}

/** « C'est ma voix (écho) » : la voix est celle de Williams, entendue sur la piste client. */
export async function marquerVoixDeWilliams(
  db: Db,
  a: { readonly rencontreId: string; readonly voix: string; readonly maintenant: Date },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const existant = await tx.rencontreParticipant.findFirst({
      where: { rencontreId: a.rencontreId, role: "axion" },
      select: { id: true },
    });
    const p =
      existant ??
      (await tx.rencontreParticipant.create({
        data: { rencontreId: a.rencontreId, nomAffiche: NOM_WILLIAMS, role: "axion" },
        select: { id: true },
      }));
    await attribuerDans(tx, { ...a, participantId: p.id });
  });
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Valide le compte rendu à valider ; programme la purge du son (B1). */
export async function validerCompteRendu(
  db: Db,
  a: { readonly compteRenduId: string; readonly parAdminId: string; readonly maintenant: Date },
): Promise<void> {
  const cr = await db.compteRendu.findUnique({
    where: { id: a.compteRenduId },
    select: { id: true, rencontreId: true, statut: true },
  });
  if (!cr || cr.statut !== "a_valider")
    throw new GesteRefuse("Ce compte rendu n'est pas à valider.");
  await exigerValidationPossible(db, cr.rencontreId);
  await db.$transaction(async (tx) => {
    await tx.compteRendu.updateMany({
      where: { rencontreId: cr.rencontreId, statut: "valide" },
      data: { statut: "remplace" },
    });
    await tx.compteRendu.update({
      where: { id: cr.id },
      data: { statut: "valide", valideParId: a.parAdminId, valideLe: a.maintenant },
    });
    await tx.enregistrement.updateMany({
      where: { rencontreId: cr.rencontreId, statut: { in: ["compte_rendu_pret", "transcrit"] } },
      data: { statut: "valide" },
    });
    await planifierDans(tx, cr.rencontreId, {
      etape: "purger_audio",
      compteRenduId: null,
      reinitialiser: true,
    });
  });
}

// ── Réécrire, réextraire, compléter ──────────────────────────────────────────

async function compteRenduCourant(db: Db, rencontreId: string) {
  return db.compteRendu.findFirst({
    where: { rencontreId, statut: { in: ["brouillon", "a_valider", "valide", "a_regenerer"] } },
    orderBy: { version: "desc" },
    select: { id: true, statut: true, verification: true, version: true },
  });
}

/** « Réécrire » : P5 sur les mêmes faits (une nouvelle version si le compte rendu est validé ou vidé). */
export async function reecrireCompteRendu(db: Db, rencontreId: string): Promise<void> {
  const cr = await compteRenduCourant(db, rencontreId);
  if (!cr) throw new GesteRefuse("Aucun compte rendu à réécrire.");
  await db.$transaction(async (tx) => {
    if (cr.statut === "a_valider") {
      await tx.compteRendu.update({
        where: { id: cr.id },
        data: { statut: "brouillon", contenu: "" },
      });
    }
    await planifierDans(tx, rencontreId, {
      etape: "rediger",
      compteRenduId: cr.id,
      reinitialiser: true,
    });
  });
}

/** « Réextraire » : P1 depuis la transcription retenue ; l'ancienne version est remplacée. */
export async function reextraireCompteRendu(db: Db, rencontreId: string): Promise<void> {
  const t = await db.transcription.count({
    where: { statut: "retenue", enregistrement: { rencontreId } },
  });
  if (t === 0) throw new GesteRefuse("La transcription n'existe plus : impossible de réextraire.");
  await db.$transaction((tx) =>
    planifierDans(tx, rencontreId, { etape: "extraire", compteRenduId: null, reinitialiser: true }),
  );
}

/**
 * ⛔ « Compléter après rattachement » : le circuit repart de P2 — jamais P1.
 * Une nouvelle version reprend l'état (faits déjà vérifiés, couverture) et
 * repart de `rattacher`. Appelée par le bouton « Compléter » et par le point
 * d'enfilage du rattachement (`relancerApresRattachement`,
 * `src/features/dossier-client/rattacher.ts`) — une seule implémentation.
 * Rend l'identifiant de la nouvelle version, ou `null` s'il n'y a pas de
 * compte rendu à compléter.
 */
export async function completerApresRattachement(
  db: Db,
  rencontreId: string,
): Promise<string | null> {
  const cr = await compteRenduCourant(db, rencontreId);
  if (!cr || cr.verification === null) return null;
  const etat = etatSansTexteBrut(lireEtat(dechiffrerParole(cr.verification)));
  return db.$transaction(async (tx) => {
    if (cr.statut === "brouillon" || cr.statut === "a_valider") {
      await tx.compteRendu.update({ where: { id: cr.id }, data: { statut: "remplace" } });
      // V1 P-1 : la version remplacée s'ARRÊTE. Sans cette annulation, ses
      // étapes déjà programmées (P3, P4, P5) repartaient chez OpenAI et la
      // ramenaient « à valider » à côté de la nouvelle.
      await annulerEtapesDesVersions(tx, [cr.id]);
    }
    const nouveau = await tx.compteRendu.create({
      data: {
        rencontreId,
        version: cr.version + 1,
        origine: "ia",
        mode: "completer_apres_rattachement",
        statut: "brouillon",
        schemaVersion: 1,
        contenu: "",
        verification: chiffrerParole(
          JSON.stringify({
            ...etat,
            rattachement: null,
            consolidation: [],
            ebauches: [],
            essaisRedaction: 0,
          }),
        ),
      },
      select: { id: true },
    });
    await planifierDans(tx, rencontreId, { etape: "rattacher", compteRenduId: nouveau.id });
    return nouveau.id;
  });
}

// ── Enregistrement court, reprise ────────────────────────────────────────────

/** G0b : Will confirme qu'un enregistrement de moins de 90 s doit être traité. */
export async function confirmerEnregistrementCourt(
  db: Db,
  rencontreId: string,
  maintenant: Date,
): Promise<void> {
  const e = await db.enregistrement.findFirst({
    where: { rencontreId, statut: "depose" },
    orderBy: { debut: "desc" },
    select: { id: true, evenements: true },
  });
  if (!e) throw new GesteRefuse("Aucun enregistrement court en attente.");
  await db.$transaction(async (tx) => {
    await tx.enregistrement.update({
      where: { id: e.id },
      data: {
        evenements: ajouterAuJournal(e.evenements, { le: maintenant, type: "court_confirme" }),
      },
    });
    await planifierDans(tx, rencontreId, {
      etape: "transcrire",
      compteRenduId: null,
      reinitialiser: true,
    });
  });
}

/** Reprise manuelle des étapes suspendues (crédit rechargé, configuration corrigée). */
export async function reprendreEtapesSuspendues(db: Db): Promise<number> {
  return db.$executeRaw`
    UPDATE "traitements_visio"
       SET "statut" = 'a_faire', "classe_erreur" = NULL, "derniere_erreur" = NULL, "prochaine_tentative_le" = NULL
     WHERE "statut" = 'suspendu' AND "classe_erreur" IN ('quota', 'configuration', 'plafond')`;
  // Une étape suspendue SANS classe attend une réponse de Will (enregistrement
  // de moins de 90 s) : elle ne reprend que par `confirmerEnregistrementCourt`.
}
