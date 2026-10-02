/**
 * Le JETON D'APPAREIL de l'extension Meet (chantier visio, ADR 0054 ; PR 5).
 *
 *   · 32 octets aléatoires → 64 caractères hexadécimaux, montrés UNE fois à
 *     Will dans la console, collés une fois dans les options de l'extension ;
 *   · stocké HACHÉ (SHA-256) : la base ne permet pas de le retrouver ;
 *   · comparaison à temps constant (même posture que `api/mcp/route.ts`) ;
 *   · SANS EXPIRATION (révision du 02/10, décision de Williams) : valable
 *     jusqu'à sa RÉVOCATION dans la console ; renouvelable ;
 *   · titulaire REVÉRIFIÉ à chaque appel : compte suspendu ou rôle retiré =
 *     appareil refusé, même avec un jeton valide.
 *
 * Module sans `server-only` : la clôture du worker lit aussi les appareils.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { PrismaClient } from "../../../prisma/generated/client";
import { peutVoirLesEchanges } from "@/features/dossier-client/roles-echanges";

/**
 * Le jeton n'expire pas (révision du 02/10, décision de Williams). La colonne
 * `AppareilEnregistrement.expireLe` reste NON nulle en base (aucune migration) :
 * elle reçoit cette date sentinelle, et c'est elle que le site renvoie à
 * l'extension (`jetonExpireLe`) — y compris pour un jeton créé avant la
 * révision, dont la date d'origine (90 jours) n'est plus jamais lue pour
 * refuser. Seules la révocation et le rôle du titulaire comptent.
 */
export const JETON_SANS_EXPIRATION = new Date("9999-12-31T00:00:00.000Z");

/** Forme exacte d'un jeton. Tout le reste est refusé avant la base. */
export const FORMAT_JETON = /^[0-9a-f]{64}$/;

/** Empreinte SHA-256 hexadécimale d'un jeton. */
export function hacherJeton(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}

/** Un jeton neuf et son empreinte. Le jeton ne doit jamais être écrit ailleurs qu'à l'écran. */
export function genererJeton(): { readonly jeton: string; readonly empreinte: string } {
  const jeton = randomBytes(32).toString("hex");
  return { jeton, empreinte: hacherJeton(jeton) };
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer <64 hex>`, ou `null`. */
export function lireJetonBearer(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const m = /^Bearer ([0-9a-f]{64})$/.exec(authorization.trim());
  return m?.[1] ?? null;
}

/** Comparaison de deux empreintes à temps constant (tailles fixées par le hachage). */
export function empreintesEgales(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

export type ResultatAuthentification =
  | {
      readonly ok: true;
      readonly appareil: {
        readonly id: string;
        readonly adminUserId: string;
        readonly expireLe: Date;
      };
    }
  | {
      readonly ok: false;
      readonly statut: 401 | 403;
      readonly erreur: "jeton_inconnu" | "jeton_revoque" | "titulaire_non_habilite";
      readonly message: string;
    };

type DbJeton = Pick<PrismaClient, "appareilEnregistrement" | "adminUser">;

/**
 * Authentifie un jeton déjà extrait par `lireJetonBearer`. Aucune écriture :
 * la date de dernière utilisation est posée par l'appelant, une fois la
 * requête acceptée. Aucune expiration : `expireLe` n'est pas lu pour refuser,
 * et l'appareil rendu porte toujours `JETON_SANS_EXPIRATION`.
 */
export async function authentifierAppareil(
  db: DbJeton,
  jeton: string,
  _maintenant: Date,
): Promise<ResultatAuthentification> {
  const empreinte = hacherJeton(jeton);
  const appareil = await db.appareilEnregistrement.findUnique({
    where: { jetonHash: empreinte },
    select: { id: true, jetonHash: true, adminUserId: true, revoqueLe: true },
  });
  // La recherche par empreinte suffit ; la comparaison à temps constant ferme
  // en plus toute différence de traitement selon le contenu de la colonne.
  if (!appareil || !empreintesEgales(appareil.jetonHash, empreinte)) {
    return {
      ok: false,
      statut: 401,
      erreur: "jeton_inconnu",
      message: "Jeton inconnu : créez un jeton dans la console (Rendez-vous → Enregistreur).",
    };
  }
  if (appareil.revoqueLe !== null) {
    return {
      ok: false,
      statut: 401,
      erreur: "jeton_revoque",
      message: "Ce jeton a été révoqué : créez-en un nouveau dans la console.",
    };
  }
  const titulaire = await db.adminUser.findUnique({
    where: { id: appareil.adminUserId },
    select: { role: true, status: true },
  });
  if (!titulaire || titulaire.status !== "active" || !peutVoirLesEchanges(titulaire.role)) {
    return {
      ok: false,
      statut: 403,
      erreur: "titulaire_non_habilite",
      message:
        "Le compte qui a créé ce jeton n'est plus habilité à enregistrer (compte suspendu ou rôle retiré).",
    };
  }
  return {
    ok: true,
    appareil: {
      id: appareil.id,
      adminUserId: appareil.adminUserId,
      expireLe: JETON_SANS_EXPIRATION,
    },
  };
}

type DbAppareil = Pick<PrismaClient, "appareilEnregistrement">;

/** Crée un appareil et rend son jeton EN CLAIR — à afficher une seule fois. */
export async function creerAppareil(
  db: DbAppareil,
  entree: { readonly nom: string; readonly adminUserId: string; readonly maintenant: Date },
): Promise<{ readonly appareilId: string; readonly jeton: string; readonly expireLe: Date }> {
  const nom = entree.nom.trim().slice(0, 80) || "Poste de Williams";
  const { jeton, empreinte } = genererJeton();
  const expireLe = JETON_SANS_EXPIRATION;
  const cree = await db.appareilEnregistrement.create({
    data: { nom, jetonHash: empreinte, adminUserId: entree.adminUserId, expireLe },
    select: { id: true },
  });
  return { appareilId: cree.id, jeton, expireLe };
}

export type ResultatRenouvellement =
  | {
      readonly ok: true;
      readonly appareilId: string;
      readonly jeton: string;
      readonly expireLe: Date;
    }
  | { readonly ok: false; readonly message: string };

/**
 * « Renouveler » (V1, S5) : dans UNE transaction, révoquer l'ancien appareil
 * D'ABORD — et seulement s'il est encore actif — puis créer le nouveau sous le
 * même nom. Jamais deux jetons valides à la fois, jamais un jeton recréé pour
 * un appareil déjà révoqué (poste perdu). Garde :
 * `renouveler-un-appareil-revoque-est-refuse.spec.ts`.
 */
export async function renouvelerAppareil(
  db: Pick<PrismaClient, "$transaction">,
  entree: { readonly appareilId: string; readonly adminUserId: string; readonly maintenant: Date },
): Promise<ResultatRenouvellement> {
  return db.$transaction(async (tx) => {
    const ancien = await tx.appareilEnregistrement.findUnique({
      where: { id: entree.appareilId },
      select: { id: true, nom: true },
    });
    if (!ancien) return { ok: false, message: "Appareil introuvable." };
    // Révoquer SEULEMENT un appareil encore actif : 0 ligne = déjà révoqué
    // (avant, ou par un autre onglet entre la lecture et l'écriture).
    const n = await tx.appareilEnregistrement.updateMany({
      where: { id: ancien.id, revoqueLe: null },
      data: { revoqueLe: entree.maintenant },
    });
    if (n.count === 0) {
      return {
        ok: false,
        message:
          "Cet appareil est déjà révoqué : créez un nouveau jeton plutôt que de le renouveler.",
      };
    }
    const cree = await creerAppareil(tx, {
      nom: ancien.nom,
      adminUserId: entree.adminUserId,
      maintenant: entree.maintenant,
    });
    return { ok: true, ...cree };
  });
}

/** Révoque un appareil (idempotent : une révocation déjà posée n'est pas déplacée). */
export async function revoquerAppareil(
  db: DbAppareil,
  appareilId: string,
  maintenant: Date,
): Promise<void> {
  await db.appareilEnregistrement.updateMany({
    where: { id: appareilId, revoqueLe: null },
    data: { revoqueLe: maintenant },
  });
}
