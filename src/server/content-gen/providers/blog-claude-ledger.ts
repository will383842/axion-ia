/**
 * Registre de coût du texte du blog via Claude : réservation puis solde.
 *
 * Une SEULE ligne `cost_ledger` par appel, créée AVANT l'appel au coût maximal
 * possible, dans UNE transaction qui tient `pg_advisory_xact_lock` : le cumul du
 * jour et du mois (propres au blog) est recalculé en incluant la ligne, et tout
 * dépassement annule la transaction. Aucune tolérance de `trackCost` ici : toute
 * erreur de base lève.
 *
 * ⚠️ N'appelle JAMAIS `trackCost` (qui avale P2021/P2025/connexion).
 */

import { UnrecoverableError } from "bullmq";
import { Prisma } from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { BLOG_TYPES, tousLesTypes, typesClaudeAutorises } from "./types-claude";

/**
 * Les 4 types blog (défaut de `CONTENT_GEN_CLAUDE_TYPES`). Ré-exporté pour compatibilité ;
 * l'ensemble des types AUTORISÉS se lit dans `types-claude.ts`.
 */
export { BLOG_TYPES };

/** Bornes de GARDE du dépôt (pas les plafonds réels, posés en base). */
export const BORNE_DURE_JOUR_USD = 20;
export const BORNE_DURE_MOIS_USD = 300;
/** Marge d'estimation historique d'un appel (anthropic.ts), ajoutée à la réserve Qualiopi. */
export const MARGE_ESTIMATION_USD = 0.15;

export type CodeRefusBlogClaude =
  | "eteint"
  | "modele_interdit"
  | "config_invalide"
  | "suspendu"
  | "plafond_jour"
  | "plafond_mois"
  | "reserve_qualiopi"
  | "juge_limite"
  | "base_indisponible"
  | "credit_refuse"
  | "plafond_job";

/** Refus de la porte : NON relançable par BullMQ (UnrecoverableError). */
export class BlogClaudeRefusError extends UnrecoverableError {
  constructor(
    message: string,
    public readonly code: CodeRefusBlogClaude,
  ) {
    super(message);
    this.name = "BlogClaudeRefusError";
  }
}

// ── Heure de Paris ────────────────────────────────────────────────────────────

const FORMAT_PARIS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface ChampsParis {
  year: number;
  month: number;
  day: number;
}

function champsParis(instant: Date): ChampsParis & { offsetMs: number } {
  const p: Record<string, number> = {};
  for (const part of FORMAT_PARIS.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  const offsetMs = asUtc - Math.floor(instant.getTime() / 1000) * 1000;
  return { year: p.year!, month: p.month!, day: p.day!, offsetMs };
}

/** Instant UTC du minuit (heure de Paris) du jour/mois `jour` de `year`-`month`. */
function minuitParisDe(year: number, month: number, day: number): Date {
  // Les changements d'heure ont lieu la nuit, jamais à 00:00 : deux passes suffisent.
  let guess = Date.UTC(year, month - 1, day);
  for (let i = 0; i < 2; i++) {
    const off = champsParis(new Date(guess)).offsetMs;
    guess = Date.UTC(year, month - 1, day) - off;
  }
  return new Date(guess);
}

/** Minuit du jour courant, heure de Paris (changements d'heure inclus). */
export function minuitParis(now: Date = new Date()): Date {
  const c = champsParis(now);
  return minuitParisDe(c.year, c.month, c.day);
}

/** Minuit du 1er du mois courant, heure de Paris. */
export function debutMoisParis(now: Date = new Date()): Date {
  const c = champsParis(now);
  return minuitParisDe(c.year, c.month, 1);
}

/** Jour de Paris au format AAAA-MM-JJ (clé des compteurs quotidiens). */
export function jourParis(now: Date = new Date()): string {
  const c = champsParis(now);
  return `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
}

// ── Réservation ───────────────────────────────────────────────────────────────

export interface ParamsReservation {
  readonly jobId: string;
  readonly model: string;
  /** Jetons d'entrée estimés (informatif, stocké sur la ligne). */
  readonly tokensInputEstimes: number;
  /** Coût maximal possible de l'appel. */
  readonly coutMaxUsd: number;
  readonly plafondJourUsd: number;
  readonly plafondMoisBlogUsd: number;
  /** Barrière globale de la ligne `anthropic` (partagée avec Qualiopi). */
  readonly plafondMoisGlobalUsd: number;
  readonly reserveQualiopiUsd: number;
  readonly maintenant?: Date;
}

export interface Reservation {
  readonly id: string;
  readonly cumulJourUsd: number;
  readonly cumulMoisBlogUsd: number;
}

function enNombre(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number.NaN;
}

/**
 * Filtre du cumul : TOUT job de contenu (toute l'énumération `ContentType`), pas seulement
 * les types actuellement autorisés. Le budget (jour, mois) est celui de tout le contenu via
 * Claude : si le dirigeant réduit la liste de types en cours de mois, ce qui a déjà été
 * dépensé sur les types retirés reste compté (on compte large, jamais trop peu). Les lignes
 * Qualiopi / chatbot n'ont pas de job de contenu : elles restent hors du cumul.
 */
function filtreContenuSql(): Prisma.Sql {
  return Prisma.sql`"jobId" IN (SELECT id FROM content_gen_jobs WHERE "contentType"::text IN (${Prisma.join([...tousLesTypes()])}))`;
}

/** Arrondi au centime SUPÉRIEUR (le compteur mensuel est un Decimal(10,2) : on compte large). */
export function auCentimeSuperieur(v: number): number {
  return Math.ceil(Math.round(v * 1e6) / 1e4) / 100;
}

/**
 * La transaction de réservation garde des délais EXPLICITES (les défauts de Prisma
 * sont 2 s d'attente / 5 s d'exécution) : l'attente du verrou consultatif compte
 * dedans. Un dépassement est un refus sûr `base_indisponible` (rien n'est écrit,
 * le job est perdu, jamais rejoué) : on préfère perdre un job que dépenser à l'aveugle.
 */
export const TRANSACTION_MAX_WAIT_MS = 10_000;
export const TRANSACTION_TIMEOUT_MS = 15_000;

async function cumulContenu(tx: Prisma.TransactionClient, depuis: Date): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ total: number | string | null }>>(
    Prisma.sql`SELECT COALESCE(SUM("costUsd"), 0)::float8 AS total
      FROM cost_ledger
      WHERE provider::text = 'anthropic' AND "timestamp" >= ${depuis} AND ${filtreContenuSql()}`,
  );
  const total = Number(rows[0]?.total ?? 0);
  if (!Number.isFinite(total)) {
    throw new BlogClaudeRefusError("Cumul du contenu via Claude illisible", "base_indisponible");
  }
  return total;
}

/**
 * Crée la ligne de réservation et incrémente le compteur dans UNE transaction
 * sous verrou consultatif. Lève (`BlogClaudeRefusError`) si un plafond serait
 * dépassé ou si la base répond mal : la transaction est alors annulée.
 */
export async function reserverCout(p: ParamsReservation): Promise<Reservation> {
  const maintenant = p.maintenant ?? new Date();
  const coutMaxUsd = auCentimeSuperieur(p.coutMaxUsd);
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('blog_claude_cap'))`;

        // Le job doit exister ET être d'un type AUTORISÉ (`CONTENT_GEN_CLAUDE_TYPES`) :
        // sinon la ligne échapperait au cumul ou l'appel dépasserait la liste voulue.
        const autorises = [...typesClaudeAutorises()];
        if (autorises.length === 0) {
          throw new BlogClaudeRefusError("Aucun type de contenu autorisé", "config_invalide");
        }
        const job = await tx.$queryRaw<Array<unknown>>(
          Prisma.sql`SELECT "inputPayload"->>'plafondJobUsd' AS "plafondJobUsd" FROM content_gen_jobs WHERE id = ${p.jobId} AND "contentType"::text IN (${Prisma.join(autorises)})`,
        );
        if (!Array.isArray(job) || job.length === 0) {
          throw new BlogClaudeRefusError(
            "Job inconnu ou d'un type non autorisé : appel refusé",
            "config_invalide",
          );
        }

        const ligne = await tx.costLedger.create({
          data: {
            jobId: p.jobId,
            provider: "anthropic",
            model: p.model,
            tokensInput: Math.max(0, Math.round(p.tokensInputEstimes)),
            tokensOutput: 0,
            costUsd: coutMaxUsd,
          },
          select: { id: true },
        });

        // Plafond PAR JOB (optionnel, posé par le script d'essai : `inputPayload.plafondJobUsd`).
        const brut = (job[0] as { plafondJobUsd?: unknown } | undefined)?.plafondJobUsd;
        if (brut !== undefined && brut !== null) {
          const plafondJob = Number(brut);
          if (!(Number.isFinite(plafondJob) && plafondJob > 0)) {
            throw new BlogClaudeRefusError("Plafond du job illisible", "config_invalide");
          }
          const lignes = await tx.$queryRaw<Array<{ total: number | string | null }>>(
            Prisma.sql`SELECT COALESCE(SUM("costUsd"), 0)::float8 AS total FROM cost_ledger WHERE "jobId" = ${p.jobId}`,
          );
          if (Number(lignes[0]?.total ?? 0) > plafondJob) {
            throw new BlogClaudeRefusError("Plafond du job atteint", "plafond_job");
          }
        }

        // Cumuls recalculés EN INCLUANT la ligne qui vient d'être posée.
        const cumulJourUsd = await cumulContenu(tx, minuitParis(maintenant));
        const cumulMoisBlogUsd = await cumulContenu(tx, debutMoisParis(maintenant));
        if (cumulJourUsd > p.plafondJourUsd) {
          throw new BlogClaudeRefusError(
            "Plafond du jour du contenu via Claude atteint",
            "plafond_jour",
          );
        }
        if (cumulMoisBlogUsd > p.plafondMoisBlogUsd) {
          throw new BlogClaudeRefusError(
            "Plafond du mois du contenu via Claude atteint",
            "plafond_mois",
          );
        }

        // Le blog ne doit jamais couper Qualiopi (même ligne `anthropic`).
        const cfg = await tx.providerConfig.findUnique({
          where: { provider: "anthropic" },
          select: { currentMonthSpentUsd: true },
        });
        const depenseGlobale = enNombre(cfg?.currentMonthSpentUsd);
        if (!Number.isFinite(depenseGlobale)) {
          throw new BlogClaudeRefusError("Compteur global illisible", "base_indisponible");
        }
        if (
          depenseGlobale + coutMaxUsd + MARGE_ESTIMATION_USD >
          p.plafondMoisGlobalUsd - p.reserveQualiopiUsd
        ) {
          throw new BlogClaudeRefusError(
            "Réserve Qualiopi entamée : appel du contenu via Claude refusé",
            "reserve_qualiopi",
          );
        }

        await tx.providerConfig.update({
          where: { provider: "anthropic" },
          data: { currentMonthSpentUsd: { increment: coutMaxUsd } },
        });
        return { id: ligne.id, cumulJourUsd, cumulMoisBlogUsd };
      },
      { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: TRANSACTION_TIMEOUT_MS },
    );
  } catch (err) {
    if (err instanceof BlogClaudeRefusError) throw err;
    throw new BlogClaudeRefusError(
      "Réservation de coût impossible (base en erreur) : appel refusé",
      "base_indisponible",
    );
  }
}

/**
 * Solde une réservation au coût réel : met la ligne à jour et déplace le
 * compteur de l'écart (réel − montant actuellement porté par la ligne), dans une
 * transaction. IDEMPOTENT (un second appel au même coût ne change rien).
 * Si le solde échoue, la réservation est conservée au maximum (on compte trop,
 * jamais trop peu) et l'échec est journalisé : ne lève jamais.
 */
export async function solderReservation(
  id: string,
  coutReelUsd: number,
  tokens?: { readonly input: number; readonly output: number },
): Promise<void> {
  try {
    if (!(Number.isFinite(coutReelUsd) && coutReelUsd >= 0)) return;
    await prisma.$transaction(async (tx) => {
      const ligne = await tx.costLedger.findUnique({
        where: { id },
        select: { costUsd: true },
      });
      if (!ligne) {
        // Ligne introuvable : rien à corriger, mais on le dit (jamais de clé ni de montant).
        // Cas voisin : après la remise à zéro mensuelle du compteur, le solde d'une
        // réservation du mois précédent applique un écart négatif sur un compteur déjà
        // remis à 0 — il peut donc le rendre transitoirement inférieur au vrai cumul.
        console.warn("[blog-claude] solde de réservation : ligne introuvable", id);
        return;
      }
      const actuel = enNombre(ligne.costUsd);
      if (!Number.isFinite(actuel)) return;
      // Écart calculé sur des valeurs arrondies au centime supérieur (compteur Decimal(10,2)).
      const ecart =
        Math.round((auCentimeSuperieur(coutReelUsd) - auCentimeSuperieur(actuel)) * 100) / 100;
      await tx.costLedger.update({
        where: { id },
        data: {
          costUsd: coutReelUsd,
          ...(tokens ? { tokensInput: tokens.input, tokensOutput: tokens.output } : {}),
        },
      });
      if (ecart !== 0) {
        await tx.providerConfig.update({
          where: { provider: "anthropic" },
          data: { currentMonthSpentUsd: { increment: ecart } },
        });
      }
    });
  } catch (err) {
    console.warn(
      "[blog-claude] solde de réservation impossible, réservation maximale conservée :",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Coût cumulé d'UN job (toutes les lignes du registre portant son `jobId`, réservations
 * comprises : on compte large). Lecture seule, sans verrou : sert au plafond par article de
 * l'équipe éditoriale. Lève si la base répond mal ou si le total est illisible : l'appelant
 * traite l'erreur comme « plafond non vérifiable » (relecture humaine), jamais comme zéro.
 */
export async function coutCumuleJobUsd(jobId: string): Promise<number> {
  const agg = await prisma.costLedger.aggregate({
    where: { jobId },
    _sum: { costUsd: true },
  });
  const total = enNombre(agg._sum.costUsd ?? 0);
  if (!Number.isFinite(total) || total < 0) {
    throw new BlogClaudeRefusError("Coût cumulé du job illisible", "base_indisponible");
  }
  return total;
}
