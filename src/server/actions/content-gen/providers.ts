/**
 * Content Generator — CRUD ProviderConfig (admin /settings/providers).
 *
 * § 12.5 + § 7.2 master prompt : toggles ON/OFF, cost caps, modèle par défaut,
 * rate-limits, fallback chain. Cost-cap reset mensuel via cron (Sprint 5).
 *
 * Lecture pure. Mutations strictement par Server Action.
 */

"use server";

import * as Sentry from "@sentry/nextjs";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/content-gen/audit-log";
import {
  CLES_PLAFONDS_BLOG,
  ErreurPlafondsBlog,
  LIBELLES_ECRAN,
  lireNombreStrict,
  lirePlafondsBlogExistants,
  validerPlafondsBlog,
} from "@/server/content-gen/providers/blog-claude-plafonds";
import type { ProviderKey, ProviderRole } from "../../../../prisma/generated/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin, requireAdminWriteRateLimited } from "./_auth";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const ProviderIdSchema = z.string().min(1).max(64);
const UpdateProviderInputSchema = z
  .object({
    id: ProviderIdSchema,
    enabled: z.boolean(),
    model: z.string().min(2).max(200),
    monthlyCapUsd: z.number().min(0).max(100_000),
    rateLimitRpm: z.number().int().min(0).max(1_000_000).optional(),
  })
  .strict();

const UpdatePlafondsBlogInputSchema = z
  .object({
    jour: z.string().max(16),
    mois: z.string().max(16),
    reserve: z.string().max(16),
    jugeMax: z.string().max(16),
  })
  .strict();

export interface UpdatePlafondsBlogInput {
  readonly jour: string;
  readonly mois: string;
  readonly reserve: string;
  readonly jugeMax: string;
}

export interface ProviderRow {
  readonly id: string;
  readonly provider: ProviderKey;
  readonly role: ProviderRole;
  readonly enabled: boolean;
  readonly primary: boolean;
  readonly model: string;
  readonly fallbackProviderId: string | null;
  readonly monthlyCapUsd: string;
  readonly currentMonthSpentUsd: string;
  readonly rateLimitRpm: number | null;
  readonly rateLimitTpm: number | null;
  readonly apiKeyEnvVar: string;
  readonly updatedAt: Date;
  readonly blogClaude: {
    jour: number | null;
    mois: number | null;
    reserve: number | null;
    jugeMax: number | null;
  } | null;
}

export async function listProviders(): Promise<ReadonlyArray<ProviderRow>> {
  // Fix 2026-08-15 (audit e2e, E5) — endpoint POST public sans garde sinon
  // (config providers = noms de variables d'env des clés API, budgets, modèles).
  await requireAdmin();
  const rows = await prisma.providerConfig.findMany({
    orderBy: [{ role: "asc" }, { provider: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    role: r.role,
    enabled: r.enabled,
    primary: r.primary,
    model: r.model,
    fallbackProviderId: r.fallbackProviderId,
    monthlyCapUsd: r.monthlyCapUsd.toString(),
    currentMonthSpentUsd: r.currentMonthSpentUsd.toString(),
    rateLimitRpm: r.rateLimitRpm,
    rateLimitTpm: r.rateLimitTpm,
    apiKeyEnvVar: r.apiKeyEnvVar,
    updatedAt: r.updatedAt,
    blogClaude: r.provider === "anthropic" ? lirePlafondsBlogExistants(r.extraConfig) : null,
  }));
}

export interface UpdateProviderInput {
  readonly id: string;
  readonly enabled: boolean;
  readonly model: string;
  readonly monthlyCapUsd: number;
  readonly rateLimitRpm?: number;
}

/**
 * Mutate ProviderConfig (toggle, model, cap, rate-limit).
 *
 * Sprint S+3 P0-1 (audit 2026-05-18 09-ADMIN-UI §2.7) — chokepoint financier
 * (caps mensuels USD, clés API env, fallback chain) durci par :
 *   1. `requireAdminWriteRateLimited` (60/min/admin/providerId, isolation cf.
 *      _auth.ts P1-30) — bloque les abus loop-script.
 *   2. `writeAuditLog` SOC2 (cf. content-gen/audit-log.ts P1-9) — diff
 *      oldValue → newValue tracé, best-effort fail-soft.
 */
export async function updateProvider(input: UpdateProviderInput): Promise<void> {
  // Sprint Final P1-3 — Zod runtime validation AVANT rate-limit (sinon un input
  // malveillant peut consommer le budget rate-limit avec des objets corrompus).
  UpdateProviderInputSchema.parse(input);
  // Rate-limit + auth admin (60 writes/min/admin/providerId — isolation par
  // provider pour permettre toggles parallèles sans bloquer l'admin).
  const session = await requireAdminWriteRateLimited(`updateProvider:${input.id}`);

  try {
    if (input.monthlyCapUsd < 0 || input.monthlyCapUsd > 100_000) {
      throw new Error("monthly_cap_out_of_range");
    }
    if (input.model.trim().length < 2) throw new Error("model_required");

    // SOC2 audit trail — lecture AVANT update pour capturer le delta.
    // Read-then-update n'est pas atomique vs lecture concurrente ; tolérable
    // car les écritures sont human-paced côté admin UI.
    const existing = await prisma.providerConfig.findUnique({
      where: { id: input.id },
      select: {
        enabled: true,
        model: true,
        monthlyCapUsd: true,
        rateLimitRpm: true,
      },
    });
    const oldValue = existing
      ? {
          enabled: existing.enabled,
          model: existing.model,
          monthlyCapUsd: existing.monthlyCapUsd.toString(),
          rateLimitRpm: existing.rateLimitRpm,
        }
      : null;

    const newValue = {
      enabled: input.enabled,
      model: input.model.trim(),
      monthlyCapUsd: input.monthlyCapUsd,
      rateLimitRpm: input.rateLimitRpm ?? null,
    };

    await prisma.providerConfig.update({
      where: { id: input.id },
      data: newValue,
    });

    // Audit log best-effort (helper writeAuditLog swallow déjà côté impl, mais
    // try/catch de défense en profondeur pour garantir que update n'échoue pas
    // si la table audit log devient indisponible).
    try {
      await writeAuditLog({
        action: "updateProvider",
        settingKey: `provider:${input.id}`,
        oldValue,
        newValue,
        actorUserId: session.userId,
        actorEmail: session.email,
      });
    } catch {
      // SOC2 tolère perte partielle si tracée. Best-effort — ne pas casser
      // l'update admin pour un problème observability.
    }

    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/providers`);
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "updateProvider" } });
    throw e;
  }
}

/**
 * Reset le compteur `currentMonthSpentUsd` d'un provider (manuel admin).
 *
 * Sprint S+3 P0-1 — opération SOC2-sensible (touche directement la métrique
 * cost-cap qui gouverne les budgets LLM mensuels). Cap stricte 10/heure/admin
 * pour bloquer un reset accidentel ou abusif en boucle.
 */
export async function resetProviderSpend(id: string): Promise<void> {
  // Sprint Final P1-3 — Zod runtime validation AVANT rate-limit.
  ProviderIdSchema.parse(id);
  // Rate-limit serré : 10/heure (window 3600s). Un reset doit rester une
  // action exceptionnelle (typiquement après bascule de billing cycle).
  const session = await requireAdminWriteRateLimited(`resetProviderSpend:${id}`, {
    limit: 10,
    windowSec: 3600,
  });
  try {
    // Capture l'ancien spend pour audit log (montre combien a été "remis à
    // zéro" — important pour reconstituer les caps mensuels en cas d'enquête).
    const existing = await prisma.providerConfig.findUnique({
      where: { id },
      select: { currentMonthSpentUsd: true },
    });
    const oldSpend = existing ? existing.currentMonthSpentUsd.toString() : null;

    await prisma.providerConfig.update({
      where: { id },
      data: { currentMonthSpentUsd: 0 },
    });

    try {
      await writeAuditLog({
        action: "resetProviderSpend",
        settingKey: `provider:${id}`,
        oldValue: { currentMonthSpentUsd: oldSpend },
        newValue: { currentMonthSpentUsd: "0" },
        actorUserId: session.userId,
        actorEmail: session.email,
      });
    } catch {
      // Best-effort (cf. updateProvider).
    }

    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/providers`);
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "resetProviderSpend" } });
    throw e;
  }
}

const MESSAGE_ANTHROPIC_ABSENTE =
  "ligne provider_config « anthropic » absente : rien posé (non créée ici)";

/**
 * Règle les 4 plafonds du contenu via Claude (clés blog_claude_* de extraConfig, ligne
 * `anthropic` uniquement). N'écrit jamais monthlyCapUsd, enabled, model ni les
 * compteurs. Les refus de validation sont RENVOYÉS (Next masque le texte des
 * erreurs levées par une action serveur).
 */
export async function updatePlafondsBlogClaude(
  input: UpdatePlafondsBlogInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // 1. Session d'abord : aucune donnée ne fuit sans authentification.
  const session = await requireAdmin();
  // 2. Rôle editor refusé par un retour (une erreur levée serait masquée par Next).
  if (session.role === "editor") return { ok: false, message: "Réservé aux administrateurs." };
  const analyse = UpdatePlafondsBlogInputSchema.safeParse(input);
  if (!analyse.success) {
    return { ok: false, message: "Valeurs invalides : vérifiez les quatre champs." };
  }
  const parsed = analyse.data;

  let cles: Record<string, number>;
  try {
    cles = validerPlafondsBlog(
      {
        jour: lireNombreStrict(parsed.jour, LIBELLES_ECRAN.jour),
        mois: lireNombreStrict(parsed.mois, LIBELLES_ECRAN.mois),
        reserve: lireNombreStrict(parsed.reserve, LIBELLES_ECRAN.reserve),
        jugeMax: lireNombreStrict(parsed.jugeMax, LIBELLES_ECRAN.jugeMax),
      },
      LIBELLES_ECRAN,
    );
  } catch (e) {
    if (e instanceof ErreurPlafondsBlog) return { ok: false, message: e.message };
    throw e;
  }

  // 3. Contrôle de débit seulement après validation : une saisie refusée ne consomme rien.
  const debit = await checkRateLimit(`admin:write:${session.userId}:updatePlafondsBlogClaude`, {
    limit: 10,
    windowSec: 3600,
  });
  if (!debit.allowed) {
    return { ok: false, message: "Trop de tentatives : réessayez dans une heure." };
  }

  try {
    const ligne = await prisma.providerConfig.findUnique({ where: { provider: "anthropic" } });
    if (!ligne) return { ok: false, message: MESSAGE_ANTHROPIC_ABSENTE };

    // Une seule requête : fusion jsonb côté base, les autres clés sont conservées.
    const touchees =
      await prisma.$executeRaw`UPDATE provider_config SET "extraConfig" = (CASE WHEN jsonb_typeof("extraConfig") = 'object' THEN "extraConfig" ELSE '{}'::jsonb END) || ${JSON.stringify(cles)}::jsonb, "updatedAt" = now() WHERE provider::text = 'anthropic'`;
    if (touchees === 0) return { ok: false, message: MESSAGE_ANTHROPIC_ABSENTE };

    const avant = lirePlafondsBlogExistants(ligne.extraConfig);
    const oldValue = {
      [CLES_PLAFONDS_BLOG.jour]: avant.jour,
      [CLES_PLAFONDS_BLOG.mois]: avant.mois,
      [CLES_PLAFONDS_BLOG.reserve]: avant.reserve,
      [CLES_PLAFONDS_BLOG.juge]: avant.jugeMax,
    };
    const ecrireAudit = async () => {
      try {
        await writeAuditLog({
          action: "updatePlafondsBlogClaude",
          settingKey: "provider:anthropic:blog_claude",
          oldValue,
          newValue: cles,
          actorUserId: session.userId,
          actorEmail: session.email,
        });
      } catch {
        // Best-effort (cf. updateProvider).
      }
    };

    // Un seul appel d'audit, dès que l'UPDATE a touché la ligne (avant la relecture).
    await ecrireAudit();

    const relu = await prisma.providerConfig.findUnique({ where: { provider: "anthropic" } });
    const extra = (relu?.extraConfig ?? {}) as Record<string, unknown>;
    const manquantes = Object.entries(cles)
      .filter(([cle, valeur]) => extra[cle] !== valeur)
      .map(([cle]) => cle);
    if (manquantes.length > 0) {
      const err = new Error(
        `relecture après écriture : clés absentes ou différentes (${manquantes.join(", ")}) : relancer`,
      );
      Sentry.captureException(err, {
        tags: { area: "content-gen", action: "updatePlafondsBlogClaude" },
      });
      // L'écran doit afficher les valeurs réelles.
      revalidatePath(
        `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/providers`,
      );
      return { ok: false, message: err.message };
    }

    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/providers`);
    return { ok: true };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "updatePlafondsBlogClaude" },
    });
    throw e;
  }
}
