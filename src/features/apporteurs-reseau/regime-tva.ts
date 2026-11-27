/**
 * Réseau d'apporteurs — CHANGER LE RÉGIME DE TVA d'un apporteur APRÈS la signature (contrat 2.8,
 * art. 4.7 et 6.3 ; décisions de Will du 26/11).
 *
 * Règles :
 *   · réservé au droit « contresigner » (contrôlé par l'action serveur) ;
 *   · contrat signé des deux parties et non résilié (avant la signature, l'apporteur corrige son
 *     dossier lui-même) ;
 *   · le changement vaut pour les autofactures ÉTABLIES à partir de la date d'effet. AUCUNE pièce déjà
 *     émise n'est modifiée : chaque pièce a son régime figé (`tva-pieces.ts`). Avant d'écrire, les
 *     pièces sans régime figé sont figées AU RÉGIME D'AVANT, dans la même transaction ;
 *   · une date passée est admise (la vraie date du changement) : les pièces émises depuis restent au
 *     régime d'alors, la console les liste, la confirmation est obligatoire. Aucune rectification
 *     automatique : c'est une décision à part (art. 6.3 : l'apporteur supporte l'information tardive) ;
 *   · une date future est admise ; un seul changement à venir à la fois ;
 *   · passage à assujetti : n° de TVA obligatoire, au format du dossier ; passage en franchise : le
 *     n° est effacé de la fiche (l'ancien reste dans l'historique) ;
 *   · la commission reste 500 € HT, jamais TTC : ce module ne touche à aucun montant.
 *
 * ⚠️ `basculerRegimesDuJour` est appelé par le passage quotidien (WORKER) : aucun `server-only`.
 * La facturation, elle, ne dépend pas de la bascule : elle lit `regimeApplicableAu`.
 */

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { jourParis } from "./autofacture-donnees";
import { envoyer } from "./envois";
import { numeroTvaValide, normaliserNumeroTva } from "./regles-dossier";
import { signalerErreurReseau } from "./signaler";
import { figerPiecesManquantes, piecesFigeesDisponible, regimeApplicableAu } from "./tva-pieces";

export type RegimeCible = "assujetti" | "franchise_293b";

export const MOIS_MAX_A_L_AVANCE = 12;

/** Clé « une fois » de l'e-mail d'un changement. */
export const jobIdEmailRegimeTva = (changementId: string, annule = false): string =>
  annule ? `apporteur-regime-tva-annule-${changementId}` : `apporteur-regime-tva-${changementId}`;

/** « 01/12/2026 » → « 2026-12-01 », ou `null` si la date n'existe pas. */
export function jourDepuisSaisie(saisie: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(saisie.trim());
  if (!m) return null;
  const [j, mo, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mo - 1, j, 12));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) return null;
  return `${String(a).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

const dateCivile = (jour: string): Date => {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, j!, 12));
};

/** « 1er décembre 2026 ». */
export function jourEnClair(jour: string): string {
  const d = dateCivile(jour);
  const j = d.getUTCDate();
  const mois = d.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  return `${j === 1 ? "1er" : j} ${mois} ${d.getUTCFullYear()}`;
}

function plusMois(jour: string, n: number): string {
  const d = dateCivile(jour);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export interface PieceEmiseDepuis {
  numero: string;
  emiseLe: string;
}

/**
 * Les autofactures et avoirs ÉMIS à partir de `depuis` (jour de Paris) : ils restent au régime
 * d'alors. Sert à avertir la console avant un changement daté dans le passé.
 */
export async function piecesEmisesDepuis(
  apporteurId: string,
  depuis: string,
): Promise<PieceEmiseDepuis[]> {
  const lignes = await prisma.commissionApporteur.findMany({
    where: {
      apporteurId,
      OR: [{ autofactureNumero: { not: null } }, { avoirNumero: { not: null } }],
    },
    select: { autofactureNumero: true, avoirNumero: true, autofactureEmiseAt: true, majAt: true },
  });
  const vues = new Map<string, string>();
  for (const l of lignes) {
    const jour = jourParis(l.autofactureEmiseAt ?? l.majAt);
    if (jour < depuis) continue;
    for (const n of [l.autofactureNumero, l.avoirNumero]) if (n && !vues.has(n)) vues.set(n, jour);
  }
  return [...vues]
    .map(([numero, emiseLe]) => ({ numero, emiseLe }))
    .sort((a, b) => a.numero.localeCompare(b.numero));
}

export type ResultatChangement =
  | { ok: true; changementId: string; message: string }
  | { ok: false; message: string; piecesEmises?: PieceEmiseDepuis[] };

const A_VENIR = (jour: string, aujourdhui: string) => jour > aujourdhui;

export async function changerRegimeTva(e: {
  apporteurId: string;
  regimeTva: RegimeCible;
  numeroTva?: string | null;
  /** « JJ/MM/AAAA » (jour de Paris). */
  effetAu: string;
  acteurId: string | null;
  confirmePiecesEmises?: boolean;
  maintenant?: Date;
}): Promise<ResultatChangement> {
  const maintenant = e.maintenant ?? new Date();
  const aujourdhui = jourParis(maintenant);
  const effet = jourDepuisSaisie(e.effetAu);
  if (!effet) return { ok: false, message: "Date invalide : écrivez-la JJ/MM/AAAA." };
  if (e.regimeTva !== "assujetti" && e.regimeTva !== "franchise_293b")
    return { ok: false, message: "Choisissez un régime de TVA." };

  const a = await prisma.apporteurReseau.findUnique({
    where: { id: e.apporteurId },
    select: {
      id: true,
      statut: true,
      prenom: true,
      email: true,
      regimeTva: true,
      numeroTva: true,
      signeParSocieteAt: true,
    },
  });
  if (!a) return { ok: false, message: "Apporteur introuvable." };
  if (!a.signeParSocieteAt || a.statut === "resilie")
    return {
      ok: false,
      message:
        "Le contrat n'est pas signé des deux parties (ou il est résilié) : avant la signature, l'apporteur corrige lui-même son dossier.",
    };
  if (effet < jourParis(a.signeParSocieteAt))
    return { ok: false, message: "La date ne peut pas précéder la contresignature du contrat." };
  if (effet > plusMois(aujourdhui, MOIS_MAX_A_L_AVANCE))
    return { ok: false, message: `La date ne peut pas dépasser ${MOIS_MAX_A_L_AVANCE} mois.` };

  let numeroTva: string | null = null;
  if (e.regimeTva === "assujetti") {
    numeroTva = normaliserNumeroTva(e.numeroTva ?? "");
    if (!numeroTvaValide(numeroTva))
      return {
        ok: false,
        message:
          "Un numéro de TVA valide est obligatoire pour facturer la TVA (ex. FR12345678901).",
      };
  }
  const sansChangement =
    a.regimeTva === e.regimeTva &&
    (e.regimeTva === "franchise_293b" || (a.numeroTva ?? "") === numeroTva);

  if (!(await piecesFigeesDisponible()))
    return {
      ok: false,
      message: "La mise à jour technique n'est pas encore en ligne : réessayez plus tard.",
    };

  // Pièces émises depuis la date (date passée ou du jour) : restent au régime d'alors.
  const emises = effet <= aujourdhui ? await piecesEmisesDepuis(e.apporteurId, effet) : [];
  if (emises.length > 0 && !e.confirmePiecesEmises)
    return {
      ok: false,
      piecesEmises: emises,
      message: `Ces ${emises.length} autofactures restent au régime d'alors (art. 4.7). Toute rectification est une décision à part. L'apporteur supporte les conséquences d'une information tardive (art. 6.3). Confirmez pour enregistrer.`,
    };

  // Aucune pièce ne peut plus basculer ensuite : on les fige AU RÉGIME D'AVANT, juste avant la
  // transaction (idempotent, sans danger si la saisie est ensuite refusée).
  await figerPiecesManquantes(e.apporteurId);

  const resultat = await prisma
    .$transaction(
      async (tx) => {
        // Un seul changement à la fois par apporteur (verrou), et un seul changement à venir.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`regime-tva-${e.apporteurId}`}))`;
        const fiche = await tx.apporteurReseau.findUnique({
          where: { id: e.apporteurId },
          select: { regimeTva: true, numeroTva: true },
        });
        if (!fiche) return { ok: false as const, message: "Apporteur introuvable." };
        const memeQueLaFiche =
          fiche.regimeTva === e.regimeTva &&
          (e.regimeTva === "franchise_293b" || (fiche.numeroTva ?? "") === numeroTva);
        const avenir = await tx.apporteurRegimeTvaChangement.findFirst({
          where: {
            apporteurId: e.apporteurId,
            annuleAt: null,
            effetAu: { gt: dateCivile(aujourdhui) },
          },
          select: { id: true },
        });
        if (avenir)
          return {
            ok: false as const,
            message: "Un changement est déjà prévu : annulez-le d'abord pour en saisir un autre.",
          };
        if ((sansChangement || memeQueLaFiche) && !A_VENIR(effet, aujourdhui))
          return { ok: false as const, message: "Aucun changement." };
        // Un changement daté AVANT un changement non annulé déjà saisi ferait diverger la fiche (qui
        // suit la saisie) et la facturation (qui suit la plus grande date d'effet) : refusé.
        const dernier = await tx.apporteurRegimeTvaChangement.findFirst({
          where: { apporteurId: e.apporteurId, annuleAt: null },
          orderBy: [{ effetAu: "desc" }, { saisiAt: "desc" }],
          select: { effetAu: true },
        });
        if (dernier && dernier.effetAu.toISOString().slice(0, 10) > effet)
          return {
            ok: false as const,
            message:
              "Un changement de régime est déjà enregistré à une date postérieure : annulez-le ou choisissez une date au moins égale.",
          };
        // Un changement à venir identique au régime alors applicable n'est qu'un doublon.
        const alors = await regimeApplicableAu(e.apporteurId, effet);
        if (
          alors.regimeTva === e.regimeTva &&
          (e.regimeTva === "franchise_293b" || (alors.numeroTva ?? "") === numeroTva)
        )
          return { ok: false as const, message: "Aucun changement." };

        const ch = await tx.apporteurRegimeTvaChangement.create({
          data: {
            apporteurId: e.apporteurId,
            regimeAvant: fiche.regimeTva,
            numeroTvaAvant: fiche.numeroTva,
            regimeTva: e.regimeTva,
            numeroTva,
            effetAu: dateCivile(effet),
            saisiPar: e.acteurId,
          },
          select: { id: true },
        });
        if (!A_VENIR(effet, aujourdhui)) {
          const r = await tx.apporteurReseau.updateMany({
            where: { id: e.apporteurId, regimeTva: fiche.regimeTva },
            data: { regimeTva: e.regimeTva, numeroTva },
          });
          if (r.count !== 1) throw new Error("La fiche a changé : réessayez.");
        }
        await tx.activityLog.create({
          data: {
            adminUserId: e.acteurId,
            action: "apporteur.regime_tva_change",
            targetType: "ApporteurReseau",
            targetId: e.apporteurId,
            changes: {
              avant: { regimeTva: fiche.regimeTva, numeroTva: fiche.numeroTva },
              apres: { regimeTva: e.regimeTva, numeroTva },
              effetAu: effet,
              piecesEmisesDepuis: emises.map((p) => p.numero),
            },
          },
        });
        return { ok: true as const, changementId: ch.id };
      },
      { timeout: 15_000 },
    )
    .catch((err: unknown) => {
      if (err instanceof Error && err.message.startsWith("La fiche a changé"))
        return { ok: false as const, message: err.message };
      throw err;
    });
  if (!resultat.ok) return resultat;

  // Hors transaction, sans jamais bloquer : l'apporteur est prévenu une fois.
  try {
    const destinataire = decryptPii(a.email) ?? "";
    if (destinataire)
      await envoyer({
        gabarit: "apporteur-regime-tva",
        destinataire,
        payload: {
          contactName: decryptPii(a.prenom) ?? "",
          regime: e.regimeTva,
          ...(numeroTva ? { numeroTva } : {}),
          effetAu: jourEnClair(effet),
        },
        entityType: "ApporteurReseau",
        entityId: e.apporteurId,
        jobId: jobIdEmailRegimeTva(resultat.changementId),
      });
  } catch (err) {
    signalerErreurReseau("régime de TVA : e-mail à l'apporteur", err);
  }
  return {
    ok: true,
    changementId: resultat.changementId,
    message: A_VENIR(effet, aujourdhui)
      ? `Changement enregistré : à compter du ${jourEnClair(effet)}.`
      : "Changement enregistré et appliqué.",
  };
}

/** Annule un changement À VENIR (jamais un changement déjà en vigueur). */
export async function annulerChangementAVenir(e: {
  changementId: string;
  /** Si fourni : le changement doit appartenir à cet apporteur. */
  apporteurId?: string;
  acteurId: string | null;
  maintenant?: Date;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const aujourdhui = jourParis(e.maintenant ?? new Date());
  const c = await prisma.apporteurRegimeTvaChangement.findUnique({
    where: { id: e.changementId },
    select: { id: true, apporteurId: true, regimeTva: true, effetAu: true, annuleAt: true },
  });
  if (!c || c.annuleAt || (e.apporteurId && c.apporteurId !== e.apporteurId))
    return { ok: false, message: "Changement introuvable." };
  if (c.effetAu.toISOString().slice(0, 10) <= aujourdhui)
    return { ok: false, message: "Ce changement est déjà en vigueur : il ne s'annule plus." };
  const r = await prisma.apporteurRegimeTvaChangement.updateMany({
    where: { id: c.id, annuleAt: null },
    data: { annuleAt: e.maintenant ?? new Date() },
  });
  if (r.count !== 1) return { ok: false, message: "Changement introuvable." };
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: e.acteurId,
        action: "apporteur.regime_tva_change_annule",
        targetType: "ApporteurReseau",
        targetId: c.apporteurId,
        changes: { changementId: c.id, regimeTva: c.regimeTva },
      },
    });
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: c.apporteurId },
      select: { prenom: true, email: true },
    });
    const destinataire = a ? (decryptPii(a.email) ?? "") : "";
    if (destinataire)
      await envoyer({
        gabarit: "apporteur-regime-tva",
        destinataire,
        payload: {
          contactName: decryptPii(a!.prenom) ?? "",
          regime: c.regimeTva,
          effetAu: jourEnClair(c.effetAu.toISOString().slice(0, 10)),
          annule: true,
        },
        entityType: "ApporteurReseau",
        entityId: c.apporteurId,
        jobId: jobIdEmailRegimeTva(c.id, true),
      });
  } catch (err) {
    signalerErreurReseau("régime de TVA : annulation, trace ou e-mail", err);
  }
  return { ok: true, message: "Changement annulé." };
}

/**
 * Passage quotidien : la fiche prend le régime des changements arrivés à échéance (idempotent).
 * Ne sert qu'à l'affichage et au dossier : la facturation lit `regimeApplicableAu`. Rend le nombre de
 * fiches mises à jour ; 0 si la table manque.
 */
export async function basculerRegimesDuJour(maintenant: Date = new Date()): Promise<number> {
  if (!(await piecesFigeesDisponible())) return 0;
  const aujourdhui = jourParis(maintenant);
  const echus = await prisma.apporteurRegimeTvaChangement.findMany({
    where: { annuleAt: null, effetAu: { lte: dateCivile(aujourdhui) } },
    orderBy: [{ effetAu: "asc" }, { saisiAt: "asc" }],
    select: { apporteurId: true, regimeTva: true, numeroTva: true, effetAu: true },
  });
  // Le dernier de chaque apporteur l'emporte (même règle que `regimeApplicableAu`).
  const dernier = new Map<string, (typeof echus)[number]>();
  for (const c of echus) dernier.set(c.apporteurId, c);
  let n = 0;
  for (const c of dernier.values()) {
    const numero = c.regimeTva === "assujetti" ? c.numeroTva : null;
    const fiche = await prisma.apporteurReseau.findUnique({
      where: { id: c.apporteurId },
      select: { regimeTva: true, numeroTva: true },
    });
    if (!fiche || (fiche.regimeTva === c.regimeTva && (fiche.numeroTva ?? null) === numero))
      continue;
    const r = await prisma.apporteurReseau.updateMany({
      where: { id: c.apporteurId, regimeTva: fiche.regimeTva },
      data: { regimeTva: c.regimeTva, numeroTva: numero },
    });
    if (r.count !== 1) continue;
    n += 1;
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: null,
          action: "apporteur.regime_tva_bascule",
          targetType: "ApporteurReseau",
          targetId: c.apporteurId,
          changes: {
            avant: { regimeTva: fiche.regimeTva, numeroTva: fiche.numeroTva },
            apres: { regimeTva: c.regimeTva, numeroTva: numero },
            effetAu: c.effetAu.toISOString().slice(0, 10),
          },
        },
      });
    } catch {
      // La trace ne fait jamais échouer la bascule.
    }
  }
  return n;
}
