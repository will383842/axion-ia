/**
 * Le JETON D'APPAREIL de l'extension Meet (chantier visio, ADR 0054 ; PR 5).
 *
 *   · 32 octets aléatoires → 64 caractères hexadécimaux, montrés UNE fois à
 *     Will dans la console, collés une fois dans les options de l'extension ;
 *   · stocké HACHÉ (SHA-256) : la base ne permet pas de le retrouver ;
 *   · comparaison à temps constant (même posture que `api/mcp/route.ts`) ;
 *   · 90 jours, révocable, renouvelable ;
 *   · titulaire REVÉRIFIÉ à chaque appel : compte suspendu ou rôle retiré =
 *     appareil refusé, même avec un jeton valide.
 *
 * Module sans `server-only` : la clôture du worker lit aussi les appareils.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { PrismaClient } from "../../../prisma/generated/client";
import { peutVoirLesEchanges } from "@/features/dossier-client/roles-echanges";
import { SEUILS_ALERTE_JETON_JOURS } from "@/lib/schemas/enregistreur";

/** Durée de vie d'un jeton. */
export const DUREE_JETON_JOURS = 90;

/** Seuils d'alerte avant expiration : déclarés UNE fois, dans le contrat. */
export { SEUILS_ALERTE_JETON_JOURS };

/** Forme exacte d'un jeton. Tout le reste est refusé avant la base. */
export const FORMAT_JETON = /^[0-9a-f]{64}$/;

const JOUR_MS = 86_400_000;

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

/** Nombre de jours pleins avant l'expiration (négatif si expiré). */
export function joursAvantExpiration(expireLe: Date, maintenant: Date): number {
  return Math.floor((expireLe.getTime() - maintenant.getTime()) / JOUR_MS);
}

/**
 * Le seuil d'alerte franchi par un jeton, ou `null`. Un jeton à 10 jours est
 * au seuil 14 ; à 2 jours, au seuil 3. Un jeton expiré ou révoqué n'alerte plus
 * (la console le montre, l'extension refuse de démarrer).
 */
export function seuilAlerteJeton(
  appareil: { readonly expireLe: Date; readonly revoqueLe: Date | null },
  maintenant: Date,
): (typeof SEUILS_ALERTE_JETON_JOURS)[number] | null {
  if (appareil.revoqueLe !== null) return null;
  const jours = joursAvantExpiration(appareil.expireLe, maintenant);
  if (jours < 0) return null;
  let seuil: (typeof SEUILS_ALERTE_JETON_JOURS)[number] | null = null;
  for (const s of SEUILS_ALERTE_JETON_JOURS) if (jours <= s) seuil = s;
  return seuil;
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
      readonly erreur:
        "jeton_inconnu" | "jeton_revoque" | "jeton_expire" | "titulaire_non_habilite";
      readonly message: string;
    };

type DbJeton = Pick<PrismaClient, "appareilEnregistrement" | "adminUser">;

/**
 * Authentifie un jeton déjà extrait par `lireJetonBearer`. Aucune écriture :
 * la date de dernière utilisation est posée par l'appelant, une fois la
 * requête acceptée.
 */
export async function authentifierAppareil(
  db: DbJeton,
  jeton: string,
  maintenant: Date,
): Promise<ResultatAuthentification> {
  const empreinte = hacherJeton(jeton);
  const appareil = await db.appareilEnregistrement.findUnique({
    where: { jetonHash: empreinte },
    select: { id: true, jetonHash: true, adminUserId: true, expireLe: true, revoqueLe: true },
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
  if (appareil.expireLe.getTime() <= maintenant.getTime()) {
    return {
      ok: false,
      statut: 401,
      erreur: "jeton_expire",
      message: "Jeton expiré : renouvelez-le dans la console, et prenez des notes à la main.",
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
    appareil: { id: appareil.id, adminUserId: appareil.adminUserId, expireLe: appareil.expireLe },
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
  const expireLe = new Date(entree.maintenant.getTime() + DUREE_JETON_JOURS * JOUR_MS);
  const cree = await db.appareilEnregistrement.create({
    data: { nom, jetonHash: empreinte, adminUserId: entree.adminUserId, expireLe },
    select: { id: true },
  });
  return { appareilId: cree.id, jeton, expireLe };
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
