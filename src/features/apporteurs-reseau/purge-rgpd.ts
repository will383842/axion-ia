// Réseau d'apporteurs — PR N (#2464, point 6) : la purge RGPD des données d'identité et de paiement.
// Aucun `server-only` : tourne dans le WORKER (passage quotidien).
//
// ⛔ ON N'EFFACE JAMAIS UNE PERSONNE. Ni la fiche, ni les présentations, ni les commissions, ni les
// autofactures, avoirs, relevés ou comptes de virement ne sont supprimés ici. On efface seulement :
// les octets des pièces d'identité et des RIB, les octets des RIB de demandes de changement, et les
// IBAN chiffrés (fiche → `null`, historique et demandes → « purge », empreinte et fin4 gardées).
//
// Les échéances (durées à confirmer par Will) sont dans `purge-rgpd-regles.ts`. Mode « essai » : rien
// n'est écrit, une alerte récapitulative sans aucun nom. Mode « appliquer » : une transaction par
// apporteur, au plus `PURGE_MAX_PAR_PASSAGE` apporteurs par passage, une ligne de journal par purge.
import { prisma } from "@/lib/prisma";

import { alerteInterne } from "./alerte-interne";
import {
  ajouterMois,
  DUREE_CONTRAT_TERMINE_ANS,
  DUREE_INACTIF_MOIS,
  DUREE_PIECE_RETRANSMISE_MOIS,
  DUREE_REFUSE_MOIS,
  echeancePiece,
  echeancePurge,
  type ReglePurge,
} from "./purge-rgpd-regles";
import { signalerErreurReseau } from "./signaler";

export type ModePurge = "essai" | "appliquer";

export const PURGE_MAX_PAR_PASSAGE = 20;
const CANDIDATS_MAX = 200;
/** Lecture seule du statut « contrat terminé » : la purge n'écrit jamais un statut (cf. la-resiliation-n-est-jamais-immediate). */
const STATUT_TERMINE = "resilie" as const;

/**
 * L'interrupteur : ABSENT = rien ne tourne ; seules « essai » et « appliquer » (exactes) allument.
 * Lu à chaque appel, côté WORKER.
 */
export function modePurgeRgpd(): ModePurge | null {
  const v = process.env.APPORTEURS_PURGE_RGPD;
  return v === "essai" || v === "appliquer" ? v : null;
}

export interface BilanPurgeRgpd {
  mode: ModePurge;
  parRegle: Record<ReglePurge, number>;
  purgees: number;
  erreurs: number;
}

function bilanVide(mode: ModePurge): BilanPurgeRgpd {
  return {
    mode,
    parRegle: { contrat_termine_5ans: 0, refuse_6mois: 0, inactif_24mois: 0, piece_6mois: 0 },
    purgees: 0,
    erreurs: 0,
  };
}

function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

/** Le journal de purge existe-t-il ? Sans lui, rien n'est fait (une purge sans trace est interdite). */
async function lireDejaPurges(regles: ReglePurge[]): Promise<Set<string> | null> {
  try {
    const l = await prisma.apporteurPurgeRgpd.findMany({
      where: { regle: { in: regles } },
      select: { apporteurId: true },
    });
    return new Set(l.map((x) => x.apporteurId));
  } catch (err) {
    if (tableAbsente(err)) return null;
    throw err;
  }
}

async function ibanTablesPresentes(): Promise<boolean> {
  try {
    await prisma.apporteurChangementIban.count({
      where: { apporteurId: "00000000-0000-0000-0000-000000000000" },
    });
    return true;
  } catch (err) {
    if (tableAbsente(err)) return false;
    throw err;
  }
}

async function contexte(apporteurId: string, tablesIban: boolean) {
  const [argent, litige, virement, pieceAf] = await Promise.all([
    prisma.commissionApporteur.count({
      where: { apporteurId, statut: { notIn: ["versee", "annulee"] } },
    }),
    prisma.commissionApporteur.count({ where: { apporteurId, litigeDepuis: { not: null } } }),
    prisma.commissionApporteur.aggregate({ where: { apporteurId }, _max: { verseeAt: true } }),
    prisma.pieceAutofactureApporteur.aggregate({ where: { apporteurId }, _max: { emiseAt: true } }),
  ]);
  let dernierCompte: Date | null = null;
  let changementCompteEnCours = false;
  if (tablesIban) {
    const [vc, enCours] = await Promise.all([
      prisma.apporteurVirementCompte.aggregate({ where: { apporteurId }, _max: { verseAt: true } }),
      prisma.apporteurChangementIban.count({
        where: { apporteurId, statut: { in: ["a_confirmer", "confirmee"] } },
      }),
    ]);
    dernierCompte = vc._max.verseAt;
    changementCompteEnCours = enCours > 0;
  }
  const v = [virement._max.verseeAt, dernierCompte].filter((d): d is Date => !!d);
  return {
    argentEnJeu: argent > 0,
    litigeOuvert: litige > 0,
    changementCompteEnCours,
    dernierVirementAt: v.length ? new Date(Math.max(...v.map((d) => d.getTime()))) : null,
    dernierePieceAutofactureAt: pieceAf._max.emiseAt,
  };
}

/** Efface, dans UNE transaction, ce que la règle autorise pour un apporteur, puis écrit le journal. */
async function purgerUnApporteur(
  apporteurId: string,
  regle: ReglePurge,
  echeanceAt: Date,
  maintenant: Date,
  tablesIban: boolean,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Le déclencheur n'ouvre la réécriture de l'IBAN que sous ce réglage, qui ne survit pas à la transaction.
    await tx.$executeRawUnsafe("SET LOCAL axion.reecriture_pii = 'purge'");
    const elements: string[] = [];

    const pieces = await tx.pieceApporteur.findMany({
      where: { apporteurId, type: { in: ["identite", "rib"] } },
      select: { id: true, type: true },
    });
    if (pieces.length) {
      const ids = pieces.map((p) => p.id);
      const octets = await tx.pieceApporteurContenu.deleteMany({ where: { pieceId: { in: ids } } });
      await tx.pieceApporteur.updateMany({
        where: { id: { in: ids } },
        data: { nomFichier: "piece-purgee" },
      });
      await tx.pieceApporteur.updateMany({
        where: { id: { in: ids }, purgeeAt: null },
        data: { purgeeAt: maintenant },
      });
      if (octets.count > 0) {
        if (pieces.some((p) => p.type === "identite")) elements.push("pieces_identite");
        if (pieces.some((p) => p.type === "rib")) elements.push("rib");
      }
    }

    if (tablesIban) {
      const demandes = await tx.apporteurChangementIban.findMany({
        where: { apporteurId },
        select: { id: true },
      });
      if (demandes.length) {
        const ribs = await tx.apporteurChangementIbanRib.updateMany({
          where: { demandeId: { in: demandes.map((d) => d.id) }, octets: { not: null } },
          data: { octets: null, purgeAt: maintenant },
        });
        if (ribs.count > 0) elements.push("rib_demandes");
      }
      const hist = await tx.apporteurIbanHistorique.updateMany({
        where: { apporteurId, iban: { not: "purge" } },
        data: { iban: "purge", ibanPurgeAt: maintenant },
      });
      if (hist.count > 0) elements.push("iban_historique");
      const dem = await tx.apporteurChangementIban.updateMany({
        where: { apporteurId, iban: { not: "purge" } },
        data: { iban: "purge", ibanPurgeAt: maintenant },
      });
      if (dem.count > 0) elements.push("iban_demandes");
    }

    // La fiche : l'IBAN seulement, rien d'autre.
    const fiche = await tx.apporteurReseau.updateMany({
      where: { id: apporteurId, iban: { not: null } },
      data: { iban: null },
    });
    if (fiche.count > 0) elements.push("iban_fiche");

    await tx.apporteurPurgeRgpd.create({
      data: { apporteurId, regle, elements, echeanceAt, purgeeAt: maintenant },
    });
  });
}

/**
 * Une purge à échéance. `essai` n'écrit rien. Rend le bilan ; ne lève pas pour un apporteur isolé
 * (l'erreur est comptée et signalée sans donnée personnelle).
 */
export async function purgerDonneesApporteurs(
  maintenant: Date,
  mode: ModePurge,
): Promise<BilanPurgeRgpd> {
  const bilan = bilanVide(mode);
  const deja = await lireDejaPurges(["contrat_termine_5ans", "refuse_6mois", "inactif_24mois"]);
  if (!deja) return bilan; // table du journal absente : migration pas encore passée
  const tablesIban = await ibanTablesPresentes();

  const candidats = await prisma.apporteurReseau.findMany({
    where: {
      id: { notIn: [...deja] },
      OR: [
        { statut: "refuse", refuseAt: { lte: ajouterMois(maintenant, -DUREE_REFUSE_MOIS) } },
        {
          statut: STATUT_TERMINE,
          resilieAt: { lte: ajouterMois(maintenant, -12 * DUREE_CONTRAT_TERMINE_ANS) },
        },
        {
          statut: { in: ["dossier_en_cours", "a_completer", "a_verifier"] },
          signeParSocieteAt: null,
          majAt: { lte: ajouterMois(maintenant, -DUREE_INACTIF_MOIS) },
        },
      ],
    },
    select: {
      id: true,
      statut: true,
      refuseAt: true,
      resilieAt: true,
      majAt: true,
      signeParSocieteAt: true,
    },
    orderBy: { majAt: "asc" },
    take: CANDIDATS_MAX,
  });

  for (const c of candidats) {
    if (bilan.purgees >= PURGE_MAX_PAR_PASSAGE) break;
    try {
      const ctx = await contexte(c.id, tablesIban);
      const e = echeancePurge({ ...c, ...ctx });
      if (!e || e.echeanceAt > maintenant) continue;
      if (mode === "appliquer") {
        await purgerUnApporteur(c.id, e.regle, e.echeanceAt, maintenant, tablesIban);
      }
      bilan.parRegle[e.regle] += 1;
      bilan.purgees += 1;
    } catch (err) {
      bilan.erreurs += 1;
      signalerErreurReseau("purge RGPD : un apporteur", err);
    }
  }

  await purgerPiecesRetransmises(maintenant, mode, bilan);
  await rendreCompte(maintenant, bilan);
  return bilan;
}

/** Pièces d'identité ou de RIB à retransmettre ou remplacées, 6 mois après le dépôt : octets seulement. */
async function purgerPiecesRetransmises(
  maintenant: Date,
  mode: ModePurge,
  bilan: BilanPurgeRgpd,
): Promise<void> {
  const candidates = await prisma.pieceApporteur.findMany({
    where: {
      type: { in: ["identite", "rib"] },
      purgeeAt: null,
      contenu: { isNot: null },
      deposeeAt: { lte: ajouterMois(maintenant, -DUREE_PIECE_RETRANSMISE_MOIS) },
      OR: [{ statut: "a_retransmettre" }, { remplaceeAt: { not: null } }],
    },
    select: {
      id: true,
      apporteurId: true,
      type: true,
      statut: true,
      remplaceeAt: true,
      deposeeAt: true,
    },
    orderBy: { deposeeAt: "asc" },
    take: CANDIDATS_MAX,
  });
  const parApporteur = new Map<string, typeof candidates>();
  for (const p of candidates)
    parApporteur.set(p.apporteurId, [...(parApporteur.get(p.apporteurId) ?? []), p]);

  let n = 0;
  for (const [apporteurId, pieces] of parApporteur) {
    if (n >= PURGE_MAX_PAR_PASSAGE) break;
    try {
      const aPurger: typeof candidates = [];
      let echeance: Date | null = null;
      for (const p of pieces) {
        const e = echeancePiece(p);
        if (!e || e.echeanceAt > maintenant) continue;
        // La dernière pièce déposée de son type est celle qui sert : on n'y touche pas.
        const derniere = await prisma.pieceApporteur.findFirst({
          where: { apporteurId, type: p.type },
          orderBy: { deposeeAt: "desc" },
          select: { id: true },
        });
        if (derniere?.id === p.id) continue;
        aPurger.push(p);
        if (!echeance || e.echeanceAt > echeance) echeance = e.echeanceAt;
      }
      if (!aPurger.length || !echeance) continue;
      if (mode === "appliquer") {
        const ids = aPurger.map((p) => p.id);
        const elements = [
          ...new Set(aPurger.map((p) => (p.type === "identite" ? "pieces_identite" : "rib"))),
        ];
        const ech = echeance;
        await prisma.$transaction(async (tx) => {
          await tx.pieceApporteurContenu.deleteMany({ where: { pieceId: { in: ids } } });
          await tx.pieceApporteur.updateMany({
            where: { id: { in: ids } },
            data: { nomFichier: "piece-purgee", purgeeAt: maintenant },
          });
          await tx.apporteurPurgeRgpd.create({
            data: {
              apporteurId,
              regle: "piece_6mois",
              elements,
              echeanceAt: ech,
              purgeeAt: maintenant,
            },
          });
        });
      }
      bilan.parRegle.piece_6mois += 1;
      n += 1;
    } catch (err) {
      if (tableAbsente(err)) return;
      bilan.erreurs += 1;
      signalerErreurReseau("purge RGPD : pièces retransmises", err);
    }
  }
}

/** Mode essai : UNE alerte interne récapitulative (nombres par règle, aucun nom, aucun identifiant). */
async function rendreCompte(maintenant: Date, bilan: BilanPurgeRgpd): Promise<void> {
  if (bilan.mode !== "essai") return;
  const mois = maintenant.toISOString().slice(0, 7);
  const t = bilan.parRegle;
  await alerteInterne({
    jobId: `purge-rgpd-essai-${mois}`,
    code: "apporteur_purge_rgpd_essai",
    titre: "Purge RGPD des apporteurs : essai à blanc",
    message: `Essai à blanc, rien n'a été effacé. À purger : contrat terminé (5 ans) ${t.contrat_termine_5ans} ; dossier refusé (6 mois) ${t.refuse_6mois} ; dossier inactif (24 mois) ${t.inactif_24mois} ; pièces à retransmettre ou remplacées (6 mois) ${t.piece_6mois}.`,
    cibleType: "ApporteurPurgeRgpd",
    cibleId: mois,
    maintenant,
  });
}
