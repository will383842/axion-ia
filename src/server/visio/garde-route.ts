/**
 * LA GARDE COMMUNE des routes `/api/enregistreur/*` (PR 5), sur le modèle de
 * `src/app/api/mcp/route.ts`.
 *
 * Dans cet ordre, et rien n'est lu de la base avant l'étape 6 :
 *
 *   1. build hors ligne (`stub.invalid`, ADR 0026) → 503, avant toute lecture ;
 *   2. drapeau `ferme` → 503 (rien n'est servi tant que Will n'a rien ouvert) ;
 *   3. `Authorization: Bearer <64 hex>` → 401 sinon. AVANT la version du
 *      contrat : un appel anonyme (le `curl` du critère d'acceptation, sans
 *      en-tête de contrat) reçoit 401, pas 400 ;
 *   4. version du contrat (`x-enregistreur-contrat: 1`) → 400 sinon ;
 *   5. type de contenu : seule la route des morceaux accepte du son
 *      (`application/octet-stream`, ≤ 262 144 octets) ; toutes les autres
 *      refusent `audio/*` et `application/octet-stream` (415) ;
 *   6. témoin de clé de chiffrement → 503 si la clé manque ou diffère ;
 *   7. jeton : connu, non révoqué, non expiré, titulaire toujours habilité ;
 *   8. limite de débit PAR APPAREIL (60/min pour les morceaux, 120/min sinon).
 *
 * ⚠️ AUCUN COOKIE LU, AUCUN EN-TÊTE CORS. L'appelant est le service worker de
 * l'extension, qui déclare `host_permissions` et n'est donc pas soumis au CORS.
 * Une réponse avec `Access-Control-Allow-Origin` ouvrirait ces routes à
 * n'importe quelle page web ; lire un cookie les ouvrirait à la session de la
 * console. Test `les-routes-de-l-enregistreur-ignorent-le-cookie-et-le-cors`.
 *
 * Aucune dépendance à Next : `Request` et `Response` du standard web.
 */

import type { PrismaClient } from "../../../prisma/generated/client";
import {
  ENTETE_CONTRAT,
  TAILLE_MAX_JSON_OCTETS,
  TAILLE_MAX_MORCEAU_OCTETS,
  VERSION_CONTRAT_ENREGISTREUR,
} from "@/lib/schemas/enregistreur";
import { cloturerEnregistrements } from "./cloture";
import { lireDrapeauEnregistrement, type ModeEnregistrement } from "./drapeau";
import { authentifierAppareil, lireJetonBearer } from "./jeton";
import type { Resultat } from "./resultat";
import { reprendrePurgesDesRefus, type Appareil } from "./sessions";
import { stockageR2 } from "./stockage-audio";
import { assurerTemoinCle, type EtatTemoin } from "./temoin-cle";

/** La chaîne magique du build hors ligne (ADR 0026) — ne pas la changer sans la propager. */
export const HOTE_DE_BUILD = "stub.invalid";

export type FamilleRoute = "morceaux" | "json" | "lecture";

export const LIMITE_PAR_MINUTE: Readonly<Record<FamilleRoute, number>> = {
  morceaux: 60,
  json: 120,
  lecture: 120,
};

const ENTETES_DE_REPONSE = {
  [ENTETE_CONTRAT]: String(VERSION_CONTRAT_ENREGISTREUR),
  "cache-control": "no-store",
} as const;

/** Une réponse JSON de l'enregistreur. Jamais d'en-tête CORS. */
export function repondre(statut: number, corps: Readonly<Record<string, unknown>>): Response {
  return Response.json(corps, { status: statut, headers: ENTETES_DE_REPONSE });
}

export function repondreResultat(r: Resultat): Response {
  return repondre(r.statut, r.corps);
}

function erreur(statut: number, code: string, message: string): Response {
  return repondre(statut, { erreur: code, message });
}

/** 503 du build hors ligne : aucune lecture, aucun compteur. */
export function indisponibleAuBuild(): Response {
  return erreur(503, "indisponible", "Service indisponible.");
}

/** `OPTIONS` et toute méthode non prévue : 405, sans en-tête CORS. */
export function methodeRefusee(): Response {
  return erreur(405, "methode_refusee", "Méthode non autorisée.");
}

export function estBuildHorsLigne(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env["DATABASE_URL"]?.includes(HOTE_DE_BUILD) ?? false;
}

export interface DependancesGarde {
  readonly db: () => Promise<PrismaClient>;
  readonly limiter: (cle: string, limite: number) => Promise<boolean>;
  readonly temoin: (db: PrismaClient, maintenant: Date) => Promise<EtatTemoin>;
  readonly cloturer: (db: PrismaClient, maintenant: Date) => Promise<unknown>;
  readonly env: () => Readonly<Record<string, string | undefined>>;
  readonly maintenant: () => Date;
}

/** Les vraies dépendances, chargées paresseusement (rien n'est instancié à l'import). */
export const dependancesParDefaut: DependancesGarde = {
  db: async () => (await import("@/lib/prisma")).prisma as unknown as PrismaClient,
  limiter: async (cle, limite) => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const r = await checkRateLimit(cle, {
      limit: limite,
      windowSec: 60,
      surPanne: "laisser-passer",
    });
    return r.allowed;
  },
  temoin: (db, maintenant) => assurerTemoinCle(db, maintenant),
  // Clôture d'office, puis reprise des purges de refus (un son qui a résisté à
  // la suppression, un morceau arrivé pendant un refus) : sans attendre le
  // balayage du worker, qui les refait aussi.
  cloturer: async (db, maintenant) => {
    await cloturerEnregistrements(db, maintenant);
    await reprendrePurgesDesRefus(db, stockageR2, maintenant);
  },
  env: () => process.env,
  maintenant: () => new Date(),
};

export type Garde =
  | {
      readonly ok: true;
      readonly db: PrismaClient;
      readonly appareil: Appareil & { readonly expireLe: Date };
      readonly mode: Exclude<ModeEnregistrement, "ferme">;
      readonly maintenant: Date;
    }
  | { readonly ok: false; readonly reponse: Response };

const TYPES_DE_SON = /^(audio\/|application\/octet-stream)/i;

/** Applique la garde commune. `famille` décide du type de contenu admis et du débit. */
export async function garderEnregistreur(
  req: Request,
  famille: FamilleRoute,
  deps: DependancesGarde = dependancesParDefaut,
): Promise<Garde> {
  const env = deps.env();
  // 1. Build hors ligne.
  if (estBuildHorsLigne(env)) return { ok: false, reponse: indisponibleAuBuild() };

  // 2. Drapeau.
  const maintenant = deps.maintenant();
  const drapeau = lireDrapeauEnregistrement(env);
  if (drapeau.effectif === "ferme") {
    return {
      ok: false,
      reponse: erreur(503, "enregistrement_ferme", "L'enregistrement des visios n'est pas ouvert."),
    };
  }

  // 3. Jeton : la forme, sans la base. Avant le contrat : sans jeton, 401.
  const jeton = lireJetonBearer(req.headers.get("authorization"));
  if (!jeton) {
    return {
      ok: false,
      reponse: erreur(
        401,
        "jeton_absent",
        "Jeton absent : collez-le dans les options de l'extension.",
      ),
    };
  }

  // 4. Version du contrat.
  if (req.headers.get(ENTETE_CONTRAT) !== String(VERSION_CONTRAT_ENREGISTREUR)) {
    return {
      ok: false,
      reponse: erreur(
        400,
        "contrat_incompatible",
        "Version de l'extension incompatible : rechargez-la.",
      ),
    };
  }

  // 5. Type de contenu et taille, AVANT de lire le corps.
  const type = req.headers.get("content-type") ?? "";
  const longueur = Number(req.headers.get("content-length") ?? "0");
  if (famille === "morceaux") {
    if (type.split(";")[0]?.trim().toLowerCase() !== "application/octet-stream") {
      return {
        ok: false,
        reponse: erreur(
          415,
          "type_refuse",
          "Le morceau doit être envoyé en application/octet-stream.",
        ),
      };
    }
    if (!Number.isFinite(longueur) || longueur > TAILLE_MAX_MORCEAU_OCTETS) {
      return { ok: false, reponse: erreur(413, "morceau_trop_gros", "Morceau trop gros.") };
    }
  } else {
    if (TYPES_DE_SON.test(type)) {
      return {
        ok: false,
        reponse: erreur(415, "type_refuse", "Cette route n'accepte pas de son."),
      };
    }
    if (!Number.isFinite(longueur) || longueur > TAILLE_MAX_JSON_OCTETS) {
      return { ok: false, reponse: erreur(413, "corps_trop_gros", "Corps trop gros.") };
    }
  }

  const db = await deps.db();

  // 6. Témoin de clé.
  const temoin = await deps.temoin(db, maintenant);
  if (!temoin.ok) {
    return {
      ok: false,
      reponse: erreur(
        503,
        "cle_chiffrement",
        "Le chiffrement n'est pas prêt sur le site : rien n'est accepté.",
      ),
    };
  }

  // 7. Jeton : connu, valide, titulaire habilité.
  const auth = await authentifierAppareil(db, jeton, maintenant);
  if (!auth.ok) return { ok: false, reponse: erreur(auth.statut, auth.erreur, auth.message) };

  // 8. Débit par appareil.
  if (
    !(await deps.limiter(`enregistreur:${famille}:${auth.appareil.id}`, LIMITE_PAR_MINUTE[famille]))
  ) {
    return {
      ok: false,
      reponse: erreur(429, "trop_de_requetes", "Trop de requêtes : nouvel essai dans une minute."),
    };
  }

  // Clôture d'office des enregistrements abandonnés, puis date d'utilisation.
  // Ni l'une ni l'autre ne doit faire échouer la requête.
  try {
    await deps.cloturer(db, maintenant);
    await db.appareilEnregistrement.update({
      where: { id: auth.appareil.id },
      data: { derniereUtilisationLe: maintenant },
    });
  } catch (err) {
    console.error("[enregistreur] clôture ou date d'utilisation non écrite :", err);
  }

  return { ok: true, db, appareil: auth.appareil, mode: drapeau.effectif, maintenant };
}

/**
 * Lit le corps EN FLUX, avec un compteur d'octets, et s'arrête dès que la
 * borne est franchie (S2, vérification finale du 30/09). `content-length` est
 * déclaré par l'appelant : absent (`Transfer-Encoding: chunked`) ou menteur,
 * il ne borne rien, et `req.arrayBuffer()` / `req.text()` liraient tout en
 * mémoire avant de mesurer. Test `un-corps-chunked-trop-gros-est-coupe`.
 */
async function lireBorne(
  req: Request,
  max: number,
): Promise<
  | { readonly ok: true; readonly octets: Buffer }
  | { readonly ok: false; readonly raison: "trop_gros" | "illisible" }
> {
  if (req.body === null) return { ok: true, octets: Buffer.alloc(0) };
  const lecteur = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await lecteur.cancel().catch(() => undefined);
        return { ok: false, raison: "trop_gros" };
      }
      morceaux.push(value);
    }
  } catch {
    return { ok: false, raison: "illisible" };
  }
  return { ok: true, octets: Buffer.concat(morceaux, total) };
}

/**
 * Lit un corps JSON borné EN OCTETS et le valide. Rend la valeur, ou la
 * réponse 400/413.
 */
export async function lireCorpsJson<T>(
  req: Request,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
): Promise<
  { readonly ok: true; readonly valeur: T } | { readonly ok: false; readonly reponse: Response }
> {
  const lu = await lireBorne(req, TAILLE_MAX_JSON_OCTETS);
  if (!lu.ok) {
    return {
      ok: false,
      reponse:
        lu.raison === "trop_gros"
          ? erreur(413, "corps_trop_gros", "Corps trop gros.")
          : erreur(400, "corps_illisible", "Corps illisible."),
    };
  }
  let brut: unknown;
  try {
    brut = JSON.parse(lu.octets.toString("utf8"));
  } catch {
    return { ok: false, reponse: erreur(400, "json_invalide", "Corps JSON invalide.") };
  }
  const r = schema.safeParse(brut);
  if (!r.success) {
    return {
      ok: false,
      reponse: erreur(400, "message_invalide", "Message hors contrat : mettez l'extension à jour."),
    };
  }
  return { ok: true, valeur: r.data };
}

/** Lit un morceau de son borné (la taille annoncée peut mentir, ou manquer : on compte en lisant). */
export async function lireOctets(
  req: Request,
): Promise<
  | { readonly ok: true; readonly octets: Buffer }
  | { readonly ok: false; readonly reponse: Response }
> {
  const lu = await lireBorne(req, TAILLE_MAX_MORCEAU_OCTETS);
  if (!lu.ok) {
    return {
      ok: false,
      reponse:
        lu.raison === "trop_gros"
          ? erreur(413, "morceau_trop_gros", "Morceau trop gros.")
          : erreur(400, "corps_illisible", "Corps illisible."),
    };
  }
  return { ok: true, octets: lu.octets };
}

/** Un identifiant d'enregistrement dans le chemin : un UUID, sinon 404. */
export function identifiantValide(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}

export function introuvable(): Response {
  return erreur(404, "enregistrement_inconnu", "Enregistrement introuvable.");
}
