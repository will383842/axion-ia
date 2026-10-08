/**
 * LE CANDIDAT RENVOIE SA VERSION PAR SON LIEN — côté PUBLIC (Candidatures unifiées L5b, plan [B2]).
 *
 *   GET  /api/partage/<id>/<jeton>/deposer   → la page de dépôt (`ouvrirPageDepot`)
 *   POST /api/partage/<id>/<jeton>/deposer   → les étapes de l'envoi (`traiterDepot`) :
 *        commencer · signer · reprendre · terminer
 *
 * 🔑 BORNÉ AU LIEN, À CHAQUE APPEL. Ordre — chaque refus d'accès rend la MÊME
 * réponse neutre :
 *   1. base factice du build (`stub.invalid`) ou bibliothèque éteinte → neutre ;
 *   2. forme et jeton vérifiés AVANT toute requête (un jeton faux ne coûte rien,
 *      le jeton d'un autre lien ne vaut rien ici) ;
 *   3. lien introuvable, expiré, retiré, d'un futur apporteur, ou qui
 *      n'autorise pas le dépôt → neutre ;
 *   4. un fichier se signe, se reprend, se termine SEULEMENT s'il a été ouvert
 *      par CE lien (`lien_depot_id`) et par une personne : un fichier de
 *      l'équipe, ou d'un autre lien, est « introuvable ».
 *
 * Un dépôt rejoint donc UNE seule fiche : celle du lien. Le nom, la taille (4 Go
 * au plus) et les premiers octets (vidéo ou ZIP) sont vérifiés AVANT le premier
 * morceau ; le moteur (`depot.ts`) relit les premiers octets dans le stockage à
 * la fin, puis passe le fichier à l'antivirus. Rien n'est montré sans verdict.
 *
 * Toutes les dépendances sont injectables (`DepsDepot`) : testé sans base, sans
 * Redis, sans stockage. Les dépendances réelles sont chargées à la demande.
 */

import type { PrismaClient } from "../../../prisma/generated/client";

import type { AlertePartage } from "./acces";
import { configPartages } from "./config";
import type { DepotCommence, EtatReprise, MorceauSigne, Resultat } from "./depot";
import { cheminLien, jetonLienValide } from "./jeton";
import { etatLien } from "./liens";
import { pageDepot } from "./page-publique";
import {
  LIBELLE_CATEGORIE,
  MORCEAUX_PAR_SIGNATURE,
  OCTETS_SIGNATURE,
  verifierDemandeDepotPersonne,
  type DemandeDepotPersonne,
} from "./regles";

type Env = Readonly<Record<string, string | undefined>>;
type Db = Pick<PrismaClient, "lienPartage" | "fichierPartage">;

/** Au plus, fichiers ouverts par un même lien (envois arrêtés compris). */
export const DEPOTS_PAR_LIEN_MAX = 10;

/** Appels du dépôt par lien et par quart d'heure (un fichier de 4 Go en demande une dizaine). */
export const APPELS_DEPOT_PAR_QUART_D_HEURE = 120;

/** Taille maximale du corps JSON d'une étape. */
export const CORPS_DEPOT_MAX_OCTETS = 8 * 1024;

/** Le moteur du dépôt (`depot.ts`), injecté. */
export interface MoteurDepot {
  commencer(d: DemandeDepotPersonne, lienId: string): Promise<Resultat<DepotCommence>>;
  signer(fichierId: string, numeros: ReadonlyArray<number>): Promise<Resultat<MorceauSigne[]>>;
  reprendre(fichierId: string): Promise<Resultat<EtatReprise>>;
  terminer(fichierId: string): Promise<Resultat<{ fichierId: string }>>;
}

export interface DepsDepot {
  readonly db: Db;
  readonly env: Env;
  readonly maintenant: () => Date;
  readonly limiter: (cle: string) => Promise<{ allowed: boolean }>;
  readonly notifier: (alerte: AlertePartage) => Promise<void>;
  readonly moteur: MoteurDepot;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MSG_LIEN_INDISPONIBLE =
  "Ce lien n'est plus disponible. Si vous devez encore nous envoyer votre version, écrivez-nous : contact@axion-ia.com.";
const MSG_INTROUVABLE = "Cet envoi est introuvable. Choisissez à nouveau votre fichier.";
const MSG_INVALIDE = "Demande invalide.";

// ── Dépendances réelles (chargées à la demande) ─────────────────────────────

export async function depsDepotParDefaut(): Promise<DepsDepot> {
  const [{ prisma }, { checkRateLimit }, depot] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/rate-limit"),
    import("./depot"),
  ]);
  return {
    db: prisma as unknown as Db,
    env: process.env,
    maintenant: () => new Date(),
    limiter: (cle) =>
      checkRateLimit(cle, {
        limit: APPELS_DEPOT_PAR_QUART_D_HEURE,
        windowSec: 15 * 60,
        surPanne: "laisser-passer",
      }),
    notifier: async (a) => {
      try {
        const { notify } = await import("@/server/notifications");
        await notify(a as never);
      } catch (e) {
        console.warn("[partages] alerte non envoyée :", (e as Error).message);
      }
    },
    moteur: {
      commencer: depot.commencerDepotPersonne,
      signer: depot.signerMorceaux,
      reprendre: depot.reprendreDepot,
      terminer: depot.terminerDepot,
    },
  };
}

// ── Le lien ─────────────────────────────────────────────────────────────────

interface LienDepot {
  id: string;
  applicationId: string;
  expireLe: Date;
  offre: string;
}

async function lireLienDepot(
  id: string,
  jeton: string,
  deps: DepsDepot,
): Promise<LienDepot | null> {
  if (deps.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  if (configPartages(deps.env) === null) return null;
  if (!UUID.test(id) || !jetonLienValide(id, jeton, deps.env)) return null;
  const lien = (await deps.db.lienPartage.findUnique({
    where: { id: id.toLowerCase() },
    select: {
      id: true,
      applicationId: true,
      expireLe: true,
      revoqueLe: true,
      depotAutorise: true,
      application: { select: { offerTitleSnap: true } },
    },
  })) as {
    id: string;
    applicationId: string | null;
    expireLe: Date;
    revoqueLe: Date | null;
    depotAutorise: boolean;
    application: { offerTitleSnap: string } | null;
  } | null;
  if (!lien || lien.depotAutorise !== true || !lien.applicationId) return null;
  if (etatLien(lien, deps.maintenant()) !== "actif") return null;
  return {
    id: lien.id,
    applicationId: lien.applicationId,
    expireLe: lien.expireLe,
    offre: lien.application?.offerTitleSnap ?? "—",
  };
}

// ── La page ─────────────────────────────────────────────────────────────────

export type IssuePageDepot = { issue: "neutre" } | { issue: "page"; html: string };

export async function ouvrirPageDepot(
  d: { id: string; jeton: string },
  deps: DepsDepot,
): Promise<IssuePageDepot> {
  const lien = await lireLienDepot(d.id, d.jeton, deps);
  if (!lien) return { issue: "neutre" };
  const chemin = cheminLien(lien.id, deps.env);
  if (!chemin) return { issue: "neutre" };
  const recus = (await deps.db.fichierPartage.findMany({
    where: { lienDepotId: lien.id, origine: "personne", etatDepot: "disponible" },
    orderBy: { creeLe: "asc" },
    take: DEPOTS_PAR_LIEN_MAX,
    select: { nomFichier: true, tailleOctets: true, disponibleLe: true },
  })) as Array<{
    nomFichier: string | null;
    tailleOctets: bigint | null;
    disponibleLe: Date | null;
  }>;
  return {
    issue: "page",
    html: pageDepot({
      chemin,
      expireLe: lien.expireLe,
      recus: recus
        .filter((f) => f.nomFichier && f.tailleOctets !== null && f.disponibleLe)
        .map((f) => ({
          nomFichier: f.nomFichier!,
          tailleOctets: Number(f.tailleOctets),
          recuLe: f.disponibleLe!,
        })),
    }),
  };
}

// ── Les étapes ──────────────────────────────────────────────────────────────

export interface ReponseDepot {
  readonly statut: number;
  readonly json: Record<string, unknown>;
}

const refus = (statut: number, erreur: string): ReponseDepot => ({
  statut,
  json: { ok: false, erreur },
});

function decoderEntete(brut: unknown): Uint8Array | null {
  if (typeof brut !== "string" || brut.length === 0 || brut.length > 64) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(brut)) return null;
  const o = Buffer.from(brut, "base64");
  return o.length > 0 ? new Uint8Array(o.subarray(0, OCTETS_SIGNATURE)) : null;
}

/** Le fichier appartient-il à CE lien ? (ouvert par lui, par une personne) */
async function fichierDuLien(
  fichierId: unknown,
  lien: LienDepot,
  deps: DepsDepot,
): Promise<string | null> {
  if (typeof fichierId !== "string" || !UUID.test(fichierId)) return null;
  const id = fichierId.toLowerCase();
  const f = (await deps.db.fichierPartage.findUnique({
    where: { id },
    select: { lienDepotId: true, origine: true },
  })) as { lienDepotId: string | null; origine: string } | null;
  if (!f || f.origine !== "personne" || f.lienDepotId !== lien.id) return null;
  return id;
}

export async function traiterDepot(
  d: { id: string; jeton: string; contentType: string | null; corps: unknown },
  deps: DepsDepot,
): Promise<ReponseDepot> {
  // Du JSON seulement : une page tierce ne peut pas en poster sans pré-vérification CORS.
  if (!(d.contentType ?? "").toLowerCase().startsWith("application/json")) {
    return refus(415, MSG_INVALIDE);
  }
  const lien = await lireLienDepot(d.id, d.jeton, deps);
  if (!lien) return refus(404, MSG_LIEN_INDISPONIBLE);

  const quota = await deps.limiter(`partages:depot:${lien.id}`);
  if (!quota.allowed) {
    return refus(
      429,
      "Trop de demandes en peu de temps. Patientez quelques minutes, puis cliquez à nouveau sur « Envoyer ».",
    );
  }

  const c = (d.corps && typeof d.corps === "object" ? d.corps : {}) as Record<string, unknown>;
  switch (c["etape"]) {
    case "commencer": {
      const demande: DemandeDepotPersonne = {
        nom: typeof c["nom"] === "string" ? c["nom"].slice(0, 1000) : "",
        taille: typeof c["taille"] === "number" ? c["taille"] : NaN,
        entete: decoderEntete(c["entete"]),
      };
      // Taille, format et premiers octets : refusés AVANT le premier morceau.
      const v = verifierDemandeDepotPersonne(demande);
      if (!v.ok) return refus(400, v.erreur);
      const deja = await deps.db.fichierPartage.count({ where: { lienDepotId: lien.id } });
      if (deja >= DEPOTS_PAR_LIEN_MAX) {
        return refus(
          409,
          "Plusieurs fichiers ont déjà été envoyés par ce lien. Pour en envoyer un autre, écrivez-nous : contact@axion-ia.com.",
        );
      }
      const r = await deps.moteur.commencer(demande, lien.id);
      if (!r.ok) return refus(400, r.erreur);
      return { statut: 200, json: { ok: true, ...r.valeur } };
    }
    case "signer": {
      const id = await fichierDuLien(c["fichierId"], lien, deps);
      if (!id) return refus(404, MSG_INTROUVABLE);
      const numeros = c["numeros"];
      if (
        !Array.isArray(numeros) ||
        numeros.length === 0 ||
        numeros.length > MORCEAUX_PAR_SIGNATURE ||
        !numeros.every((n) => Number.isInteger(n))
      ) {
        return refus(400, MSG_INVALIDE);
      }
      const r = await deps.moteur.signer(id, numeros as number[]);
      if (!r.ok) return refus(400, r.erreur);
      return { statut: 200, json: { ok: true, morceaux: r.valeur } };
    }
    case "reprendre": {
      const id = await fichierDuLien(c["fichierId"], lien, deps);
      if (!id) return refus(404, MSG_INTROUVABLE);
      const r = await deps.moteur.reprendre(id);
      if (!r.ok) return refus(400, r.erreur);
      return { statut: 200, json: { ok: true, ...r.valeur } };
    }
    case "terminer": {
      const id = await fichierDuLien(c["fichierId"], lien, deps);
      if (!id) return refus(404, MSG_INTROUVABLE);
      const r = await deps.moteur.terminer(id);
      if (!r.ok) return refus(400, r.erreur);
      // « Un candidat a rendu son essai » — sans nom, sans adresse, sans nom de
      // fichier (il porte souvent le nom de la personne) : l'offre et la fiche.
      await deps.notifier({
        category: "FICHIERS_PARTAGES",
        payload: {
          kind: "essai_rendu",
          offre: lien.offre,
          fichier: LIBELLE_CATEGORIE.essai_rendu,
          applicationId: lien.applicationId,
        },
        dedupKey: `partages:essai:${id}`,
        dedupTtlSec: 30 * 24 * 3600,
      });
      return { statut: 200, json: { ok: true, fichierId: id } };
    }
    default:
      return refus(400, MSG_INVALIDE);
  }
}
