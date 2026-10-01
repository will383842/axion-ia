/**
 * La lecture derrière le LIEN PUBLIC d'une page envoyée au client
 * (`/document/<id>/<jeton>`, ADR 0063, D12).
 *
 * 🔑 L'UN DES DEUX SEULS LECTEURS DES OCTETS (`documentProjetContenu`), avec
 * `telecharger.ts`.
 *
 * Ordre — chaque refus rend `null`, et la route sert le MÊME 404 neutre :
 *   1. base factice du build (`stub.invalid`) → rien ;
 *   2. forme et jeton vérifiés AVANT toute requête (un jeton faux ne coûte rien) ;
 *   3. métadonnées → `estPartageable` (la définition unique) ;
 *   4. octets ;
 *   5. ouverture comptée — SEULEMENT si `DOCUMENTS_OUVERTURES_SUIVIES=true`
 *      (lu à chaque requête), pour un GET, sous la limite de 30 par quart
 *      d'heure et par document ; best-effort : un échec n'empêche jamais de
 *      servir. Ni IP, ni navigateur : le document, l'origine probable, la date.
 *
 * ⚠️ Le comptage reste ÉTEINT tant que Will n'a pas validé la base légale et
 * l'information du destinataire (ADR 0063, « Négatives » 2). La variable n'est
 * pas définie en production à la livraison.
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import type { RateLimitConfig } from "@/lib/rate-limit";
import { jetonDocumentValide } from "./jeton";
import { estPartageable, origineOuverture } from "./partage";

type Db = Pick<
  PrismaClient,
  "documentProjet" | "documentProjetContenu" | "documentProjetOuverture"
>;

type Limiteur = (cle: string, config: RateLimitConfig) => Promise<{ allowed: boolean }>;

export interface DemandePagePublique {
  readonly id: string;
  readonly jeton: string;
  readonly methode: "GET" | "HEAD";
  readonly entetes: Headers;
}

/** Interrupteur du suivi d'ouverture : exactement « true », lu à chaque requête. */
export function ouverturesSuivies(): boolean {
  return process.env["DOCUMENTS_OUVERTURES_SUIVIES"] === "true";
}

export const LIMITE_OUVERTURES: RateLimitConfig = {
  limit: 30,
  windowSec: 15 * 60,
  surPanne: "laisser-passer",
};

async function limiteurParDefaut(cle: string, config: RateLimitConfig) {
  const { checkRateLimit } = await import("@/lib/rate-limit");
  return checkRateLimit(cle, config);
}

/** Les octets de la page, ou `null` (404 neutre, quel que soit le motif). */
export async function lirePagePublique(
  db: Db,
  d: DemandePagePublique,
  deps: { readonly limiter?: Limiteur } = {},
): Promise<Uint8Array | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  if (!jetonDocumentValide(d.id, d.jeton)) return null;
  const id = d.id.toLowerCase();

  const doc = await db.documentProjet.findUnique({
    where: { id },
    select: {
      id: true,
      archiveLe: true,
      cote: true,
      nature: true,
      fichierFormat: true,
      analyseAntivirus: true,
    },
  });
  if (doc === null || !estPartageable(doc)) return null;

  const contenu = await db.documentProjetContenu.findUnique({
    where: { documentId: doc.id },
  });
  if (contenu === null) return null;

  if (d.methode === "GET" && ouverturesSuivies()) {
    try {
      const limiter = deps.limiter ?? limiteurParDefaut;
      const r = await limiter(`documents:ouverture:${doc.id}`, LIMITE_OUVERTURES);
      if (r.allowed) {
        await db.documentProjetOuverture.create({
          data: { documentId: doc.id, origine: origineOuverture(d.entetes) },
        });
      }
    } catch (err) {
      console.error("[documents-projet] ouverture non comptée :", err);
    }
  }
  return new Uint8Array(contenu.octets);
}
