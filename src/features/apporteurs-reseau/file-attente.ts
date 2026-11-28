/**
 * La file d'attente de l'article 3.5 (contrat 2.8) : une déclaration à qui l'on a répondu « Pas
 * disponible » (l'entreprise était prise) est CONSERVÉE EN ATTENTE, à raison de deux au plus par
 * entreprise, dans l'ordre d'horodatage. La troisième est refusée (art. 3.3 bis c).
 *
 * Quand l'entreprise est libre (attribution échue, prise en charge terminée, ou fin des 30 jours de
 * repos), le PREMIER rang seul reçoit un e-mail et dispose de 15 jours pour la déclarer à nouveau. Sans
 * nouvelle déclaration, la sienne est effacée (la `PresentationEntreprise` reste ; rien n'est supprimé)
 * et l'entreprise redevient librement déclarable par tous. Le second rang reste en attente, sans fenêtre ni
 * e-mail (Q-F1, `RANG_2_PROMU_AVEC_FENETRE`), et s'éteint 12 mois après son enregistrement.
 *
 * ⛔ L'e-mail ne porte jamais que le prénom, l'entreprise et la date : aucun nom d'occupant.
 * ⛔ Journaux et Sentry sans donnée personnelle : des identifiants seulement.
 * Sans clé étrangère, tolérant à la table absente EN LECTURE (fenêtre app/worker).
 *
 * ⚠️ Atteint par le WORKER : aucun `server-only`.
 */

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { lireEtablissements, type Etablissement } from "./etablissement-presentation";
import { envoyer, type EnvoiApporteur, type ResultatEnvoi } from "./envois";
import {
  RANG_2_PROMU_AVEC_FENETRE,
  cleFile,
  eteinteLe,
  finFenetre,
  jusquAuLisible,
  ordreDeFile,
  peutEntrerEnFile,
} from "./file-attente-regles";
import { perimetreOccupe } from "./occupation";
import { tableAbsente } from "./reservation-presentation";
import { signalerErreurReseau } from "./signaler";

type DbFile = Pick<typeof prisma, "declarationEnAttente">;

export interface BilanFileAttente {
  fileAttenteInformes?: number;
  fileAttenteEffacees?: number;
  fileAttenteEteintes?: number;
  erreurs: number;
}

const VIVANTES = ["en_attente", "informee"];

export const gabaritFileAttente = "apporteur-file-attente-premier-rang" as const;
export const jobIdFileAttente = (id: string): string => `apporteur-file-attente-${id}`;

/** Les clés de file qui visent le même périmètre qu'une déclaration au SIRET donné (ou à tout le SIREN). */
function clesDuPerimetre(siren: string, siret: string | null): string[] {
  return siret ? [siret, siren] : [siren];
}

/**
 * Met en attente la déclaration à qui l'on répond « Pas disponible ». Appelée DANS la transaction
 * sérialisable de la réponse. « file_complete » : deux déclarations sont déjà vivantes sur ce périmètre.
 * Aucune erreur rattrapée : l'écriture d'une réponse ne passe pas en silence.
 */
export async function mettreEnAttente(
  tx: Pick<
    typeof prisma,
    "declarationEnAttente" | "presentationEntreprise" | "presentationEtablissement"
  >,
  presentationId: string,
  _maintenant: Date,
): Promise<"en_attente" | "file_complete"> {
  const p = await tx.presentationEntreprise.findUnique({
    where: { id: presentationId },
    select: { siren: true, apporteurId: true, recueAt: true },
  });
  if (!p) return "file_complete";
  const deja = await tx.declarationEnAttente.findUnique({
    where: { presentationId },
    select: { id: true },
  });
  if (deja) return "en_attente";
  const etab = (await lireEtablissements([presentationId], tx)).get(presentationId)!;
  const siret = etab.entreprise ? null : etab.siret;
  // Q-F2 : « par entreprise » = le périmètre déclaré. Une déclaration à tout le SIREN compte pour
  // tous ses établissements, et inversement.
  const vivantes = await tx.declarationEnAttente.count({
    where: siret
      ? { statut: { in: VIVANTES }, cleFile: { in: clesDuPerimetre(p.siren, siret) } }
      : { statut: { in: VIVANTES }, siren: p.siren },
  });
  if (!peutEntrerEnFile(vivantes)) return "file_complete";
  await tx.declarationEnAttente.create({
    data: {
      presentationId,
      apporteurId: p.apporteurId,
      siren: p.siren,
      siret,
      cleFile: cleFile(p.siren, siret),
      recueAt: p.recueAt,
      statut: "en_attente",
    },
  });
  return "en_attente";
}

/**
 * Le dernier jour du premier rang est-il encore à venir pour ce périmètre ? Renvoie la ligne informée d'un
 * AUTRE apporteur dont la fenêtre court, sinon `null`. Lu hors transaction, tolérant à la table absente.
 */
export async function fenetreOuverteParUnAutre(
  p: { siren: string; apporteurId: string },
  perimetre: Etablissement,
  maintenant: Date,
  db: DbFile = prisma,
): Promise<boolean> {
  try {
    const l = await db.declarationEnAttente.findMany({
      where: {
        siren: p.siren,
        statut: "informee",
        apporteurId: { not: p.apporteurId },
        fenetreFinAt: { gte: maintenant },
      },
      select: { siret: true },
      take: 20,
    });
    return l.some(
      (x) =>
        perimetre.siret === null ||
        perimetre.entreprise ||
        x.siret === null ||
        x.siret === perimetre.siret,
    );
  } catch (err) {
    if (tableAbsente(err)) return false;
    throw err;
  }
}

/**
 * Le déclarant a-t-il une ligne `informee` sur ce périmètre ? Sa nouvelle déclaration la consomme
 * (`redeclaree`). Ne lève jamais vers `declarerEntreprise` : la déclaration est déjà écrite.
 */
export async function consommerSiRedeclaration(
  nouvelle: { id: string; apporteurId: string; siren: string; siret: string; recueAt: Date },
  db: DbFile = prisma,
): Promise<boolean> {
  try {
    const l = await db.declarationEnAttente.findFirst({
      where: {
        apporteurId: nouvelle.apporteurId,
        statut: "informee",
        cleFile: { in: clesDuPerimetre(nouvelle.siren, nouvelle.siret) },
      },
      select: { id: true },
    });
    if (!l) return false;
    const r = await db.declarationEnAttente.updateMany({
      where: { id: l.id, statut: "informee" },
      data: {
        statut: "redeclaree",
        redeclareePresentationId: nouvelle.id,
        clotureeAt: nouvelle.recueAt,
      },
    });
    return r.count === 1;
  } catch (err) {
    if (tableAbsente(err)) return false;
    signalerErreurReseau("file d'attente : redéclaration", err);
    return false;
  }
}

/**
 * Parmi ces déclarations, lesquelles sont conservées en attente (vivantes) ? Table absente : aucune.
 * Sert à l'état montré à l'apporteur : jamais le rang ni l'état informé.
 */
export async function lireIdsEnAttente(
  ids: readonly string[],
  db: DbFile = prisma,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  try {
    const l = await db.declarationEnAttente.findMany({
      where: { presentationId: { in: [...ids] }, statut: { in: VIVANTES } },
      select: { presentationId: true },
    });
    return new Set(l.map((x) => x.presentationId));
  } catch (err) {
    if (tableAbsente(err)) return new Set();
    throw err;
  }
}

interface Ligne {
  id: string;
  presentationId: string;
  apporteurId: string;
  siren: string;
  siret: string | null;
  cleFile: string;
  recueAt: Date;
  statut: string;
  fenetreFinAt: Date | null;
  clotureeAt?: Date | null;
}

const PARTI: ReadonlySet<ResultatEnvoi> = new Set(["envoye", "en-validation"]);

/**
 * L'entreprise a-t-elle eu un nouvel occupant depuis que le premier rang a été écarté ? Q-F1 : le second
 * rang n'est informé qu'à la PROCHAINE fin d'occupation, pas aussitôt que le premier est effacé.
 */
async function nouvelleOccupationDepuis(
  db: Pick<typeof prisma, "presentationEntreprise">,
  l: Ligne,
  depuis: Date,
): Promise<boolean> {
  const n = await db.presentationEntreprise.count({
    where: {
      siren: l.siren,
      statut: { in: ["reservee", "confirmee", "terminee"] },
      recueAt: { gte: depuis },
    },
  });
  return n > 0;
}

/** L'étape quotidienne « file-attente ». Une ligne en échec ne bloque pas les suivantes. */
export async function passerFileAttente(
  maintenant: Date,
  bilan: BilanFileAttente,
  db: Pick<
    typeof prisma,
    "declarationEnAttente" | "presentationEntreprise" | "apporteurReseau"
  > = prisma,
): Promise<void> {
  let vivantes: Ligne[];
  try {
    vivantes = (await db.declarationEnAttente.findMany({
      where: { statut: { in: VIVANTES } },
      orderBy: [{ recueAt: "asc" }, { id: "asc" }],
      take: 2000,
    })) as Ligne[];
  } catch (err) {
    if (tableAbsente(err)) return;
    throw err;
  }
  const parCle = new Map<string, Ligne[]>();
  for (const l of vivantes) parCle.set(l.cleFile, [...(parCle.get(l.cleFile) ?? []), l]);

  for (const [, lignes] of parCle) {
    try {
      await passerUneFile(db, lignes, maintenant, bilan);
    } catch (err) {
      bilan.erreurs += 1;
      signalerErreurReseau("file d'attente", err);
    }
  }
}

async function passerUneFile(
  db: Pick<typeof prisma, "declarationEnAttente" | "presentationEntreprise" | "apporteurReseau">,
  lignes: Ligne[],
  maintenant: Date,
  bilan: BilanFileAttente,
): Promise<void> {
  const cloturer = async (l: Ligne, statut: "eteinte" | "effacee"): Promise<boolean> => {
    const r = await db.declarationEnAttente.updateMany({
      where: { id: l.id, statut: l.statut },
      data: { statut, clotureeAt: maintenant },
    });
    return r.count === 1;
  };

  // 1. Extinction : 12 mois après l'enregistrement, sans aucun e-mail.
  let restantes: Ligne[] = [];
  for (const l of lignes) {
    if (eteinteLe(l.recueAt).getTime() <= maintenant.getTime()) {
      if (await cloturer(l, "eteinte"))
        bilan.fileAttenteEteintes = (bilan.fileAttenteEteintes ?? 0) + 1;
    } else restantes.push(l);
  }

  // 2. Fenêtres échues sans nouvelle déclaration : la déclaration est effacée.
  const effacees: Ligne[] = [];
  const apres: Ligne[] = [];
  for (const l of restantes) {
    if (
      l.statut === "informee" &&
      l.fenetreFinAt &&
      l.fenetreFinAt.getTime() < maintenant.getTime()
    ) {
      if (await cloturer(l, "effacee")) {
        bilan.fileAttenteEffacees = (bilan.fileAttenteEffacees ?? 0) + 1;
        effacees.push({ ...l, clotureeAt: maintenant });
      }
    } else apres.push(l);
  }
  restantes = apres;
  if (effacees.length > 0 && !RANG_2_PROMU_AVEC_FENETRE) return; // Q-F1 : le suivant attend la prochaine fin d'occupation.

  // 3. Ouverture : le premier rang, seulement si personne n'est déjà informé et si l'entreprise est libre.
  if (restantes.some((l) => l.statut === "informee")) return;
  const premier = ordreDeFile(restantes.filter((l) => l.statut === "en_attente"))[0];
  if (!premier) return;
  if (!(await perimetreLibre(db, premier, maintenant))) return;
  if (!(await avoirEuUneFinDOccupationDepuisLEcartement(db, premier, maintenant))) return;
  await informerPremierRang(db, premier, maintenant, bilan);
}

async function perimetreLibre(
  db: Pick<typeof prisma, "presentationEntreprise">,
  l: Ligne,
  maintenant: Date,
): Promise<boolean> {
  return !(await perimetreOccupe(
    db,
    { siren: l.siren, siret: l.siret, entreprise: l.siret === null },
    maintenant,
  ));
}

/**
 * Un premier rang déjà écarté (`effacee`, `redeclaree`) avant ce rang l'a été à une fin d'occupation : le
 * rang suivant attend la PROCHAINE. Vrai s'il n'y a eu aucun écart avant lui, ou si une occupation est née
 * depuis (et, l'entreprise étant libre, s'est terminée).
 */
async function avoirEuUneFinDOccupationDepuisLEcartement(
  db: Pick<typeof prisma, "declarationEnAttente" | "presentationEntreprise">,
  l: Ligne,
  _maintenant: Date,
): Promise<boolean> {
  const ecartes = (await db.declarationEnAttente.findMany({
    where: {
      siren: l.siren,
      cleFile: { in: clesDuPerimetre(l.siren, l.siret) },
      statut: { in: ["effacee", "redeclaree"] },
      recueAt: { lt: l.recueAt },
    },
    select: { clotureeAt: true },
    orderBy: { clotureeAt: "desc" },
    take: 1,
  })) as Array<{ clotureeAt: Date | null }>;
  const dernier = ecartes[0]?.clotureeAt;
  if (!dernier) return true;
  return nouvelleOccupationDepuis(db, l, dernier);
}

async function informerPremierRang(
  db: Pick<typeof prisma, "declarationEnAttente" | "presentationEntreprise" | "apporteurReseau">,
  l: Ligne,
  maintenant: Date,
  bilan: BilanFileAttente,
): Promise<void> {
  const p = await db.presentationEntreprise.findUnique({
    where: { id: l.presentationId },
    select: {
      denomination: true,
      apporteur: { select: { prenom: true, email: true } },
    },
  });
  if (!p) return;
  const email = decryptPii(p.apporteur.email) ?? "";
  if (!email) return;
  const fin = finFenetre(maintenant);
  const jobId = jobIdFileAttente(l.id);
  const envoi: EnvoiApporteur = {
    gabarit: gabaritFileAttente,
    destinataire: email,
    // Rien d'autre : ni l'occupant, ni son état, ni l'ordre de la file.
    payload: {
      prenom: decryptPii(p.apporteur.prenom) ?? "",
      entreprise: p.denomination,
      jusquAu: jusquAuLisible(fin),
    },
    entityType: "PresentationEntreprise",
    entityId: l.presentationId,
    jobId,
  };
  const r = await envoyer(envoi);
  if (r === "fiche-retiree") {
    // L'apporteur n'est plus au réseau : sa déclaration n'a plus de suite, le rang suivant avance.
    await db.declarationEnAttente.updateMany({
      where: { id: l.id, statut: "en_attente" },
      data: { statut: "eteinte", clotureeAt: maintenant },
    });
    bilan.fileAttenteEteintes = (bilan.fileAttenteEteintes ?? 0) + 1;
    return;
  }
  // `informeeAt` n'est posé QUE si la mise en file a réussi : sinon on réessaie au passage suivant.
  if (!PARTI.has(r)) return;
  const u = await db.declarationEnAttente.updateMany({
    where: { id: l.id, statut: "en_attente" },
    data: { statut: "informee", informeeAt: maintenant, fenetreFinAt: fin, emailJobId: jobId },
  });
  if (u.count === 1) bilan.fileAttenteInformes = (bilan.fileAttenteInformes ?? 0) + 1;
}
