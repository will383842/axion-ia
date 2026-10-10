/**
 * LE LIEN PRIVÉ, CÔTÉ PUBLIC — lire, journaliser, plafonner (Candidatures unifiées L5, ADR 0065 D6).
 *
 * Les deux routes `/api/partage/<id>/<jeton>` (la page) et
 * `/api/partage/<id>/<jeton>/<fichierId>` (le téléchargement) n'appellent que
 * ce module. Ordre — chaque refus rend la MÊME issue `neutre` :
 *   1. base factice du build (`stub.invalid`) ou fonction éteinte → neutre ;
 *   2. forme et jeton vérifiés AVANT toute requête (un jeton faux ne coûte rien) ;
 *   3. lien introuvable, expiré ou retiré → neutre.
 *
 * Journal [B1] : `liens_partage_acces`, en ajout seul, SANS clé étrangère ni
 * donnée personnelle (ni IP, ni navigateur) : le type, l'origine probable
 * (`navigateur` / `apercu_automatique`, heuristique de l'ADR 0063) et la date.
 * L'ouverture de page est écrite sous un compteur de 30 par quart d'heure et
 * par lien ; un téléchargement est TOUJOURS écrit (il compte pour le plafond).
 *
 * Plafond [I4] : 20 téléchargements d'un même fichier dans la période de
 * validité en cours (prolonger ouvre une période neuve). Compté sous verrou
 * consultatif, dans la transaction qui écrit l'accès : deux clics simultanés
 * ne franchissent pas le plafond ensemble. Le 20ᵉ prévient Will.
 *
 * Toutes les dépendances sont injectables (`DepsAcces`) : testé sans base, sans
 * Redis, sans R2. Les dépendances réelles sont chargées à la demande.
 */

import type { OrigineOuvertureDocument, PrismaClient } from "../../../prisma/generated/client";
import { origineOuverture } from "@/features/dossier-client/documents/partage";

import { configPartages } from "./config";
import { cheminLien, jetonLienValide } from "./jeton";
import {
  PLAFOND_TELECHARGEMENTS,
  debutPeriode,
  dureeUrlSigneeS,
  etatLien,
  porteDesRushs,
} from "./liens";
import { pageLien, type EtatFichierPage, type FichierPage } from "./page-publique";

type Env = Readonly<Record<string, string | undefined>>;
type Db = Pick<PrismaClient, "lienPartage" | "lienPartageAcces" | "$transaction" | "$executeRaw">;

export interface AlertePartage {
  readonly category: "FICHIERS_PARTAGES";
  readonly payload: {
    readonly kind: "rushs_telecharges" | "plafond_atteint" | "essai_rendu" | "analyse_en_retard";
    readonly offre: string;
    readonly fichier: string;
    readonly applicationId: string | null;
  };
  readonly severity?: "info" | "warn";
  readonly dedupKey?: string;
  readonly dedupTtlSec?: number;
}

export interface DepsAcces {
  readonly db: Db;
  readonly env: Env;
  readonly maintenant: () => Date;
  readonly limiter: (cle: string) => Promise<{ allowed: boolean }>;
  readonly notifier: (alerte: AlertePartage) => Promise<void>;
  readonly stockage: {
    /** L'objet existe-t-il ? LÈVE si le stockage ne répond pas. */
    existe(cle: string): Promise<boolean>;
    /** Adresse de lecture signée, en téléchargement, au nom d'origine. */
    signer(cle: string, nom: string, dureeS: number): Promise<string>;
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Dépendances réelles (chargées à la demande) ─────────────────────────────

/** Les dépendances de production. */
export async function depsParDefaut(): Promise<DepsAcces> {
  const [{ prisma }, r2, { checkRateLimit }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/r2-storage"),
    import("@/lib/rate-limit"),
  ]);
  const cible = () => {
    const c = configPartages();
    if (!c) throw new Error("partages éteints");
    return {
      accountId: c.accountId,
      bucket: c.bucket,
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
    };
  };
  return {
    db: prisma as unknown as Db,
    env: process.env,
    maintenant: () => new Date(),
    limiter: (cle) =>
      checkRateLimit(cle, { limit: 30, windowSec: 15 * 60, surPanne: "laisser-passer" }),
    notifier: async (a) => {
      try {
        const { notify } = await import("@/server/notifications");
        await notify(a as never);
      } catch (e) {
        console.warn("[partages] alerte non envoyée :", (e as Error).message);
      }
    },
    stockage: {
      existe: async (cle) => (await r2.tailleObjetR2(cible(), cle)) !== null,
      signer: (cle, nom, dureeS) =>
        r2.signerLectureR2(cible(), cle, dureeS, { nom, disposition: "attachment" }),
    },
  };
}

// ── Lecture du lien ─────────────────────────────────────────────────────────

interface FichierLu {
  id: string;
  titre: string;
  nature: string;
  categorie: string;
  nomFichier: string | null;
  tailleOctets: bigint | null;
  etatDepot: string;
  analyse: string | null;
  r2Cle: string | null;
  urlExterne: string | null;
}

interface LienLu {
  id: string;
  applicationId: string | null;
  expireLe: Date;
  revoqueLe: Date | null;
  /** L5b — « Déposer votre version » proposé sur la page. */
  depotAutorise?: boolean;
  application: { offerTitleSnap: string } | null;
  fichiers: Array<{ fichier: FichierLu }>;
}

async function lireLien(id: string, jeton: string, deps: DepsAcces): Promise<LienLu | null> {
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
      fichiers: {
        select: {
          fichier: {
            select: {
              id: true,
              titre: true,
              nature: true,
              categorie: true,
              nomFichier: true,
              tailleOctets: true,
              etatDepot: true,
              analyse: true,
              r2Cle: true,
              urlExterne: true,
            },
          },
        },
      },
    },
  })) as LienLu | null;
  if (!lien || etatLien(lien, deps.maintenant()) !== "actif") return null;
  return lien;
}

function categories(lien: LienLu): string[] {
  return lien.fichiers.map((x) => x.fichier.categorie);
}

/** L'état d'un fichier sur la page, AVANT le plafond. */
function etatDeBase(f: FichierLu): EtatFichierPage {
  if (f.nature === "lien_externe") return f.urlExterne ? "pret" : "indisponible";
  if (f.etatDepot !== "disponible" || !f.r2Cle || !f.nomFichier) return "indisponible";
  if (f.analyse === "sain" || f.analyse === "hors_limite") return "pret";
  if (f.analyse === "en_attente") return "verification";
  return "indisponible"; // infecté : jamais servi
}

async function telechargementsParFichier(
  lien: LienLu,
  deps: DepsAcces,
): Promise<Map<string, number>> {
  const groupes = (await deps.db.lienPartageAcces.groupBy({
    by: ["fichierId"],
    where: {
      lienId: lien.id,
      type: "telechargement",
      survenuLe: { gte: debutPeriode(lien.expireLe, categories(lien)) },
    },
    _count: { _all: true },
  })) as unknown as Array<{ fichierId: string | null; _count: { _all: number } }>;
  return new Map(groupes.map((g) => [g.fichierId ?? "", g._count._all]));
}

function ordonner(lien: LienLu): FichierLu[] {
  // Rushs d'abord, puis par titre : ordre stable d'une ouverture à l'autre.
  return lien.fichiers
    .map((x) => x.fichier)
    .sort(
      (a, b) =>
        Number(b.categorie === "rushs") - Number(a.categorie === "rushs") ||
        a.titre.localeCompare(b.titre, "fr"),
    );
}

// ── La page ─────────────────────────────────────────────────────────────────

export type IssuePage = { issue: "neutre" } | { issue: "page"; html: string };

export async function ouvrirPageLien(
  d: { id: string; jeton: string; methode: "GET" | "HEAD"; entetes: Headers },
  deps: DepsAcces,
): Promise<IssuePage> {
  const lien = await lireLien(d.id, d.jeton, deps);
  if (!lien) return { issue: "neutre" };
  const chemin = cheminLien(lien.id, deps.env);
  if (!chemin) return { issue: "neutre" };

  if (d.methode === "GET") {
    try {
      const r = await deps.limiter(`partages:ouverture:${lien.id}`);
      if (r.allowed) {
        await deps.db.lienPartageAcces.create({
          data: {
            lienId: lien.id,
            fichierId: null,
            type: "page_ouverte",
            origine: origineOuverture(d.entetes),
          },
        });
      }
    } catch (e) {
      // Best-effort : une ouverture non comptée n'empêche jamais de servir.
      console.warn("[partages] ouverture non comptée :", (e as Error).message);
    }
  }

  const comptes = await telechargementsParFichier(lien, deps);
  const fichiers: FichierPage[] = ordonner(lien).map((f) => {
    const base = etatDeBase(f);
    const etat: EtatFichierPage =
      base === "pret" && (comptes.get(f.id) ?? 0) >= PLAFOND_TELECHARGEMENTS ? "plafond" : base;
    return {
      id: f.id,
      titre: f.titre,
      nature: f.nature === "lien_externe" ? "lien_externe" : "fichier",
      nomFichier: f.nomFichier,
      tailleOctets: f.tailleOctets === null ? null : Number(f.tailleOctets),
      etat,
    };
  });
  return {
    issue: "page",
    html: pageLien({
      chemin,
      expireLe: lien.expireLe,
      rushs: porteDesRushs(categories(lien)),
      fichiers,
      // L5b — seulement pour un candidat (monde « emploi »), et si Will l'a coché.
      depotAutorise: lien.depotAutorise === true && lien.applicationId !== null,
    }),
  };
}

// ── Le téléchargement ───────────────────────────────────────────────────────

export type IssueTelechargement =
  | { issue: "neutre" }
  /** Rien à servir maintenant (plafond, antivirus en cours) : retour à la page, qui le dit. */
  | { issue: "retour"; chemin: string }
  | { issue: "indisponible" }
  | { issue: "redirection"; url: string };

export async function telechargerFichierLien(
  d: { id: string; jeton: string; fichierId: string; entetes: Headers },
  deps: DepsAcces,
): Promise<IssueTelechargement> {
  if (!UUID.test(d.fichierId)) return { issue: "neutre" };
  const lien = await lireLien(d.id, d.jeton, deps);
  if (!lien) return { issue: "neutre" };
  const chemin = cheminLien(lien.id, deps.env);
  const f = lien.fichiers.map((x) => x.fichier).find((x) => x.id === d.fichierId.toLowerCase());
  if (!f || !chemin) return { issue: "neutre" };
  if (etatDeBase(f) !== "pret") return { issue: "retour", chemin };

  // Avant d'écrire quoi que ce soit : l'adresse à servir.
  let url: string;
  if (f.nature === "lien_externe") {
    url = f.urlExterne!;
  } else {
    try {
      if (!(await deps.stockage.existe(f.r2Cle!))) return { issue: "indisponible" };
      url = await deps.stockage.signer(
        f.r2Cle!,
        f.nomFichier!,
        dureeUrlSigneeS(f.tailleOctets === null ? null : Number(f.tailleOctets)),
      );
    } catch (e) {
      console.warn("[partages] stockage injoignable :", (e as Error).message);
      return { issue: "indisponible" };
    }
  }

  const origine: OrigineOuvertureDocument = origineOuverture(d.entetes);
  const debut = debutPeriode(lien.expireLe, categories(lien));
  const rushsIds = lien.fichiers
    .map((x) => x.fichier)
    .filter((x) => x.categorie === "rushs")
    .map((x) => x.id);

  const issue = await deps.db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`partage:${lien.id}:${f.id}`}))`;
    const deja = await tx.lienPartageAcces.count({
      where: {
        lienId: lien.id,
        fichierId: f.id,
        type: "telechargement",
        survenuLe: { gte: debut },
      },
    });
    if (deja >= PLAFOND_TELECHARGEMENTS) return { refuse: true as const };
    const premierRushs =
      f.categorie === "rushs" && origine === "navigateur"
        ? (await tx.lienPartageAcces.count({
            where: {
              lienId: lien.id,
              type: "telechargement",
              origine: "navigateur",
              fichierId: { in: rushsIds },
            },
          })) === 0
        : false;
    await tx.lienPartageAcces.create({
      data: { lienId: lien.id, fichierId: f.id, type: "telechargement", origine },
    });
    return { refuse: false as const, total: deja + 1, premierRushs };
  });
  if (issue.refuse) return { issue: "retour", chemin };

  const base = {
    offre: lien.application?.offerTitleSnap ?? "—",
    fichier: f.titre,
    applicationId: lien.applicationId,
  };
  if (issue.premierRushs) {
    await deps.notifier({
      category: "FICHIERS_PARTAGES",
      payload: { kind: "rushs_telecharges", ...base },
      dedupKey: `partages:rushs:${lien.id}`,
      dedupTtlSec: 30 * 24 * 3600,
    });
  }
  if (issue.total === PLAFOND_TELECHARGEMENTS) {
    await deps.notifier({
      category: "FICHIERS_PARTAGES",
      payload: { kind: "plafond_atteint", ...base },
      severity: "warn",
      dedupKey: `partages:plafond:${lien.id}:${f.id}:${debut.getTime()}`,
      dedupTtlSec: 30 * 24 * 3600,
    });
  }
  return { issue: "redirection", url };
}
