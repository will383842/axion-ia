/**
 * Content Generator — Cost tracker (§ 0.4 + § 7.4 master prompt).
 *
 * Responsabilités :
 * 1. Vérifier le cost cap mensuel pré-call (assertion DB atomic).
 * 2. Logger un row `CostLedger` après chaque appel provider.
 * 3. Incrémenter `ProviderConfig.currentMonthSpentUsd` (transaction atomic).
 * 4. Activer kill switch si cap atteint.
 *
 * Cf. _AUDIT/SPRINT-1-DAY-BY-DAY.md Day 2 § 09:00.
 */

import { prisma } from "@/lib/prisma";
import { ProviderError } from "../providers/IProvider";
import { sendTelegram } from "@/lib/telegram";
import { safeTelegramContext } from "./pii-safe";
import type { ProviderKey, Prisma } from "../../../../prisma/generated/client";

/**
 * Fix 2026-08-15 (audit e2e, F2) — chaîne RÉELLE des providers texte.
 *
 * L'ancien code décidait du kill switch en comptant les `ProviderConfig`
 * role=text enabled EN BASE. Or `anthropic` est seedé role=text enabled=true
 * (prisma/seeds/content-gen/provider-config.ts) alors que la chaîne réelle du
 * routeur est `text: [openaiProvider]` SEUL (décision Will 2026-07-09,
 * commentée dans `provider-router.ts` — le fallback Anthropic est RETIRÉ).
 * Symptôme observé : cap OpenAI atteint → openai désactivé → le kill switch ne
 * se déclenchait PAS (anthropic comptait encore) → les jobs continuaient
 * d'échouer en `auth_failed` au lieu d'être mis en pause proprement.
 *
 * ⚠️ À maintenir aligné avec `ROLE_TO_PROVIDERS.text` de `provider-router.ts`
 * (constante non exportée là-bas — dupliquée ici à dessein, avec ce renvoi).
 * Même alignement que `CRITICAL_PROVIDERS` dans `providers/quota-guard.ts`.
 */
export const TEXT_CHAIN_PROVIDERS: ReadonlyArray<ProviderKey> = ["openai"];

/**
 * Audit final P1-9 fix — gestion automatique du dépassement cost cap.
 *
 * Actions cascadées (docstring aligné Fix 2026-08-15 F1/F2) :
 *  1. Désactive `ProviderConfig.enabled=false` pour ce provider, avec marqueur
 *     `extraConfig.disabled_by_cost_cap` (permet au reset mensuel de ré-armer).
 *  2. Alerte Telegram tag MONITORING (Will sait dans la minute).
 *  3. Si après désactivation plus aucun provider de la chaîne texte RÉELLE
 *     (`TEXT_CHAIN_PROVIDERS`) n'est enabled → activer kill switch global
 *     content-gen (`ContentGenConfig.kill_switch`, marqué auto/cost_cap).
 *  4. Trace dans `ContentGenConfig.cost_cap_events` (audit trail
 *     accessible dashboard admin).
 *
 * **Idempotent** : appeler 2× = même état final (enabled=false reste
 * false, kill switch reste true).
 * **Fail-soft** : si Telegram ou Prisma fail, on log et continue (l'objectif
 * principal — throw ProviderError — n'est pas compromis).
 */
async function handleCostCapHit(provider: ProviderKey, spent: number, cap: number): Promise<void> {
  try {
    // 1. Désactive le provider.
    //
    // Fix 2026-08-15 (audit e2e, F1) — on MARQUE la désactivation comme
    // automatique dans `extraConfig.disabled_by_cost_cap`. Symptôme observé :
    // le reset mensuel (`resetMonthlyCostCounters`) remettait le compteur à 0
    // mais ne ré-activait RIEN — un cap atteint le 20 du mois laissait la
    // génération morte à perpétuité (assertCostCapAvailable throw sur
    // `!config.enabled` quel que soit le compteur), alors que l'alerte Telegram
    // promettait « reset 1er du mois ». Ce marqueur permet au reset de
    // distinguer une désactivation cost-cap (à ré-armer) d'une désactivation
    // VOLONTAIRE par un admin (à ne jamais toucher). On ne pose le marqueur que
    // si le provider était encore enabled — s'il avait déjà été coupé à la main,
    // on ne requalifie pas la décision humaine.
    const existing = await prisma.providerConfig.findUnique({
      where: { provider },
      select: { enabled: true, extraConfig: true },
    });
    if (existing?.enabled !== false) {
      const extra = (existing?.extraConfig as Record<string, unknown> | null) ?? {};
      await prisma.providerConfig.update({
        where: { provider },
        data: {
          enabled: false,
          extraConfig: {
            ...extra,
            disabled_by_cost_cap: {
              at: new Date().toISOString(),
              spent_usd: Number(spent.toFixed(2)),
              cap_usd: Number(cap.toFixed(2)),
            },
          } as never,
        },
      });
    }
  } catch (err) {
    console.warn(
      `[cost-tracker] failed to auto-disable provider ${provider}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // 2. Alerte Telegram (fail-soft) — Pass B P1-7 : champs passés via
  // safeTelegramContext() pour garantir minimisation PII (ADR 0010) même
  // si un futur ajout introduit un email/name dans le payload alert.
  //
  // Fix 2026-08-15 (F2) — l'ancien message affirmait « Fallback chain prend le
  // relais » : FAUX pour le rôle text depuis la décision Will 2026-07-09
  // (chaîne = OpenAI seul, aucun fallback). Will lisait donc une alerte
  // rassurante pendant que la génération était en réalité à l'arrêt. Le
  // message dit maintenant la vérité selon que le provider a un relais ou non.
  try {
    const context = safeTelegramContext({
      provider,
      monthly_spent_usd: Number(spent.toFixed(2)),
      monthly_cap_usd: Number(cap.toFixed(2)),
    });
    const isTextChainProvider = TEXT_CHAIN_PROVIDERS.includes(provider);
    await sendTelegram({
      tag: "MONITORING",
      body:
        `*Cost cap content-gen atteint*\n` +
        `${context}\n` +
        `Action auto : provider désactivé. ` +
        (isTextChainProvider
          ? `⚠️ AUCUN fallback pour la génération texte (chaîne = OpenAI seul) : production texte à l'arrêt.\n`
          : `Impact limité à son rôle (pas de bascule automatique).\n`) +
        `Réactivation : admin /content-gen/settings/providers ou reset 1er du mois (automatique).`,
      silent: false,
    });
  } catch (err) {
    console.warn(
      "[cost-tracker] Telegram cost-cap alert failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 3. Vérifie s'il reste un provider de la chaîne texte RÉELLE → sinon kill
  // switch global.
  //
  // Fix 2026-08-15 (F2) — la décision portait sur `role=text enabled` EN BASE,
  // qui inclut anthropic (seedé text) alors que le routeur ne l'utilise plus
  // (cf. TEXT_CHAIN_PROVIDERS en tête de fichier). Résultat : openai en cap ne
  // déclenchait jamais le kill switch. On compte désormais les providers de la
  // chaîne réellement câblée dans `provider-router.ts`.
  //
  // Fix 2026-08-15 (F1) — la valeur porte `auto: true` + `source: "cost_cap"`
  // pour que le reset mensuel puisse lever CE kill switch-là (posé par le
  // cost-cap) sans jamais toucher à un kill switch manuel ni à celui du
  // quota-guard (quota épuisé ne guérit pas au changement de mois).
  try {
    const remaining = await prisma.providerConfig.count({
      where: { provider: { in: [...TEXT_CHAIN_PROVIDERS] }, enabled: true },
    });
    if (remaining === 0) {
      const killSwitchValue = {
        active: true,
        reason: `Auto-trigger : toute la chaîne texte en cost cap (dernier=${provider})`,
        triggered_at: new Date().toISOString(),
        triggered_by: "system:cost-tracker",
        auto: true,
        source: "cost_cap",
      };
      await prisma.contentGenConfig.upsert({
        where: { key: "kill_switch" },
        create: {
          key: "kill_switch",
          value: killSwitchValue as never,
          updatedBy: "system:cost-tracker",
        },
        update: {
          value: killSwitchValue as never,
          updatedBy: "system:cost-tracker",
          updatedAt: new Date(),
        },
      });
      try {
        await sendTelegram({
          tag: "INCIDENT",
          body:
            // Fix 2026-08-15 (F1/F2) : wording aligné sur le comportement réel —
            // chaîne texte (pas « tous les role=text » en base), et le reset du
            // 1er du mois lève désormais ce kill switch automatiquement.
            `*🛑 Kill switch global auto-activé*\n` +
            `Cause : toute la chaîne texte (OpenAI seul) en cost cap mensuel.\n` +
            `Dernier provider tombé : \`${provider}\`.\n` +
            `Workers content-gen en pause. Levée AUTOMATIQUE au reset du 1er du mois,\n` +
            `ou avant : augmenter le cap puis admin /content-gen/settings/kill-switch.`,
          silent: false,
        });
      } catch {
        // fail-soft sur 2e alerte
      }
    }
  } catch (err) {
    console.warn(
      "[cost-tracker] failed to check remaining providers / kill-switch trigger:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 4. Trace audit dans ContentGenConfig.cost_cap_events (cap 50 derniers).
  try {
    const existing = await prisma.contentGenConfig.findUnique({
      where: { key: "cost_cap_events" },
    });
    const prev =
      (existing?.value as Array<Record<string, unknown>> | null | undefined)?.filter(
        (e) => typeof e === "object" && e !== null,
      ) ?? [];
    const next = [
      {
        provider,
        spent_usd: spent,
        cap_usd: cap,
        at: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 50);
    await prisma.contentGenConfig.upsert({
      where: { key: "cost_cap_events" },
      create: { key: "cost_cap_events", value: next as never, updatedBy: "system:cost-tracker" },
      update: {
        value: next as never,
        updatedBy: "system:cost-tracker",
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn(
      "[cost-tracker] failed to write cost_cap_events trace:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export interface CostTrackingArgs {
  readonly jobId?: string;
  readonly provider: ProviderKey;
  readonly model: string;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly costUsd: number;
}

/**
 * Vérifie le cost cap mensuel AVANT un appel provider.
 * Throw `ProviderError("cost_cap_reached")` si dépassement.
 *
 * Méthode :
 * - Lit `ProviderConfig.monthlyCapUsd` + `currentMonthSpentUsd`.
 * - Si `currentMonthSpentUsd >= monthlyCapUsd * 1.0` → throw (kill switch hit).
 * - Si `>= 0.8 * monthlyCapUsd` → log warning (Telegram alert § 12.3bis Sprint 1 Day 5).
 *
 * V0 transitoire : si la table ProviderConfig n'existe pas en DB (migration pas
 * encore appliquée), bypass le check (return false) — anti-blocage build/test.
 */
export async function assertCostCapAvailable(
  provider: ProviderKey,
  estimatedCostUsd: number,
): Promise<void> {
  try {
    const config = await prisma.providerConfig.findUnique({
      where: { provider },
      select: { monthlyCapUsd: true, currentMonthSpentUsd: true, enabled: true },
    });
    if (!config) {
      // Provider pas seedé → skip (V0 transitoire avant pnpm content-gen:seed).
      // 2026-06-14 — En PROD réelle, un provider absent de ProviderConfig veut
      // dire que la génération tourne SANS plafond pour ce provider. On le rend
      // visible (au lieu d'un bypass silencieux) pour pouvoir réagir — même
      // logique d'observabilité que les bypass DB-down ci-dessous. Aucun bruit
      // hors prod (stub/build/test → warn no-op).
      warnCostGuardBypassed(provider, "provider absent de ProviderConfig (non seedé)");
      return;
    }
    if (!config.enabled) {
      throw new ProviderError(
        `Provider '${provider}' is disabled in ProviderConfig`,
        "auth_failed",
        provider,
        false,
      );
    }
    const cap = Number(config.monthlyCapUsd);
    if (cap <= 0) {
      // Cap = 0 → provider gratuit (Unsplash). Pas de check cost.
      return;
    }
    const spent = Number(config.currentMonthSpentUsd);
    // P1-17 fix audit opérationnel 2026-05-14 — warning à 80% pour anticiper
    // le hit 100%. Throttle : on n'alerte qu'au passage de seuil (spent
    // pre-call < 80%, post-call >= 80%) pour éviter spam Telegram.
    const threshold80 = cap * 0.8;
    if (spent < threshold80 && spent + estimatedCostUsd >= threshold80) {
      void (async () => {
        try {
          const { alertCostCap80 } = await import("@/server/content-gen/shared/content-gen-alerts");
          const queuedJobs = await prisma.contentGenJob.count({
            where: { status: "queued" },
          });
          await alertCostCap80(provider, spent + estimatedCostUsd, cap, queuedJobs);
        } catch {
          // best-effort
        }
        // UI banner : upsert ContentGenConfig so layout can display a banner.
        try {
          const pctValue = Math.round(((spent + estimatedCostUsd) / cap) * 100);
          await prisma.contentGenConfig.upsert({
            where: { key: "cost_cap_80_active" },
            create: {
              key: "cost_cap_80_active",
              value: {
                active: true,
                provider,
                pct: pctValue,
                spent_usd: Number((spent + estimatedCostUsd).toFixed(2)),
                cap_usd: Number(cap.toFixed(2)),
                triggered_at: new Date().toISOString(),
              } as never,
              updatedBy: "system:cost-tracker",
            },
            update: {
              value: {
                active: true,
                provider,
                pct: pctValue,
                spent_usd: Number((spent + estimatedCostUsd).toFixed(2)),
                cap_usd: Number(cap.toFixed(2)),
                triggered_at: new Date().toISOString(),
              } as never,
              updatedBy: "system:cost-tracker",
              updatedAt: new Date(),
            },
          });
        } catch {
          // fail-soft — DB indisponible ou migration manquante.
        }
      })();
    }
    if (spent + estimatedCostUsd > cap) {
      // UI banner : upsert cost_cap_80_active at 100% so layout shows red banner.
      void prisma.contentGenConfig
        .upsert({
          where: { key: "cost_cap_80_active" },
          create: {
            key: "cost_cap_80_active",
            value: {
              active: true,
              provider,
              pct: 100,
              spent_usd: Number(spent.toFixed(2)),
              cap_usd: Number(cap.toFixed(2)),
              triggered_at: new Date().toISOString(),
            } as never,
            updatedBy: "system:cost-tracker",
          },
          update: {
            value: {
              active: true,
              provider,
              pct: 100,
              spent_usd: Number(spent.toFixed(2)),
              cap_usd: Number(cap.toFixed(2)),
              triggered_at: new Date().toISOString(),
            } as never,
            updatedBy: "system:cost-tracker",
            updatedAt: new Date(),
          },
        })
        .catch(() => {
          // fail-soft
        });
      // Audit final P1-9 fix — auto-trigger cascade : disable provider +
      // Telegram + éventuel kill-switch global si fallback chain épuisée.
      // Helper isolé fail-soft, ne bloque jamais le throw ci-dessous.
      await handleCostCapHit(provider, spent, cap);
      throw new ProviderError(
        `Cost cap reached for ${provider}: $${spent.toFixed(4)}/$${cap.toFixed(2)} (+ $${estimatedCostUsd.toFixed(4)})`,
        "cost_cap_reached",
        provider,
        false,
      );
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    // P2021 = table doesn't exist (migration pas appliquée) → bypass V0
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2021") {
      warnCostGuardBypassed(provider, "table absente (P2021)");
      return;
    }
    // PrismaClientInitializationError = DB pas accessible (test sans DB) → bypass V0
    if (err instanceof Error && err.constructor.name === "PrismaClientInitializationError") {
      warnCostGuardBypassed(provider, "DB inaccessible");
      return;
    }
    throw err;
  }
}

/**
 * P1 2026-06-13 — Observabilité : le cost-cap se met en bypass (résilience) sur
 * erreur DB. C'est voulu au build/test, mais en PROD réelle ça veut dire que la
 * génération tourne SANS plafond → on le rend visible (au lieu d'un bypass
 * silencieux) pour pouvoir réagir. Aucun bruit hors prod (stub/build/test).
 */
function warnCostGuardBypassed(provider: ProviderKey, reason: string): void {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.DATABASE_URL?.includes("stub.invalid")
  ) {
    console.warn(
      `[cost-tracker] ⚠️ cost-cap bypassé en PROD (provider=${provider}, ${reason}) — génération NON plafonnée jusqu'au rétablissement DB.`,
    );
  }
}

/**
 * Enregistre un row CostLedger + incrémente ProviderConfig.currentMonthSpentUsd
 * dans la même transaction atomic (pas de désynchro possible).
 *
 * V0 transitoire : si tables manquent (P2021), no-op silencieux.
 */
export async function trackCost(args: CostTrackingArgs): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const data: Prisma.CostLedgerCreateInput = {
        provider: args.provider,
        model: args.model,
        tokensInput: args.tokensInput,
        tokensOutput: args.tokensOutput,
        costUsd: args.costUsd,
        ...(args.jobId ? { jobId: args.jobId } : {}),
      };
      await tx.costLedger.create({ data });
      await tx.providerConfig.update({
        where: { provider: args.provider },
        data: { currentMonthSpentUsd: { increment: args.costUsd } },
      });
    });
  } catch (err) {
    const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "";
    if (code === "P2021") {
      // Tables pas migrées → no-op
      warnCostGuardBypassed(args.provider, "trackCost: table absente (P2021)");
      return;
    }
    if (code === "P2025") {
      // Ligne provider_config absente pour ce provider → le suivi de coût agrégé
      // est best-effort (le coût par message est déjà persisté ailleurs, ex.
      // chat_messages.cout_estime pour le chatbot). On ne fait JAMAIS échouer la
      // génération à cause du tracking. (Le CostLedger.create a rollback avec la
      // transaction → pas de ligne orpheline.)
      return;
    }
    if (err instanceof Error && err.constructor.name === "PrismaClientInitializationError") {
      // DB pas accessible (tests sans DB) → no-op
      warnCostGuardBypassed(args.provider, "trackCost: DB inaccessible");
      return;
    }
    throw err;
  }
}

/** Récapitulatif du reset mensuel (loggé + alerté par cost-cap-reset-worker). */
export interface MonthlyResetSummary {
  /** Nombre de compteurs `currentMonthSpentUsd` remis à 0. */
  readonly countersReset: number;
  /** Providers ré-activés (désactivés automatiquement par le cost-cap). */
  readonly reenabledProviders: ReadonlyArray<ProviderKey>;
  /** true si le kill switch auto (posé par le cost-cap) a été levé. */
  readonly killSwitchLifted: boolean;
}

/**
 * Reset mensuel des compteurs de dépense + RÉARMEMENT de ce que le cost-cap a
 * coupé. À appeler par cron job 1er du mois 00:01 (cf. § 13.2 master prompt).
 *
 * Fix 2026-08-15 (audit e2e, F1) — l'ancienne version remettait seulement
 * `currentMonthSpentUsd = 0`. Or au cap 100 %, `handleCostCapHit` a mis
 * `enabled=false` (et éventuellement le kill switch), et
 * `assertCostCapAvailable` throw sur `!config.enabled` QUEL QUE SOIT le
 * compteur : cap atteint le 20 du mois ⇒ génération morte à perpétuité, alors
 * que l'en-tête du worker ET l'alerte Telegram affirmaient que le reset
 * relançait tout. Désormais le reset :
 *
 *  1. remet les compteurs à 0 (comme avant — toujours en premier, c'est le
 *     geste critique) ;
 *  2. ré-active les providers portant le marqueur
 *     `extraConfig.disabled_by_cost_cap` (posé par `handleCostCapHit`) — et
 *     SEULEMENT ceux-là : un provider désactivé à la main par un admin n'a pas
 *     ce marqueur et reste intouché ;
 *  3. lève le kill switch UNIQUEMENT s'il a été posé par le cost-cap
 *     (`triggered_by === "system:cost-tracker"`, ou `auto === true` +
 *     `source === "cost_cap"` pour les valeurs écrites après ce fix). Un kill
 *     switch manuel, ou posé par le quota-guard (compte à sec — le changement
 *     de mois n'y change rien), n'est JAMAIS touché ;
 *  4. éteint le bandeau admin `cost_cap_80_active` (F6 — aucun code ne le
 *     repassait à false : alerte périmée affichée indéfiniment = accoutumance).
 *
 * Chaque étape post-compteurs est fail-soft : une erreur est loggée mais
 * n'empêche pas les suivantes (le reset des compteurs, lui, throw si KO —
 * comportement d'origine conservé, le worker doit rougir).
 */
export async function resetMonthlyCostCounters(): Promise<MonthlyResetSummary> {
  // 1. Compteurs à 0 — critique, en premier, non protégé (échec = job failed).
  const result = await prisma.providerConfig.updateMany({
    data: { currentMonthSpentUsd: 0 },
  });

  const reenabledProviders: ProviderKey[] = [];
  let killSwitchLifted = false;

  // 2. Ré-activation des providers auto-désactivés par le cost-cap.
  try {
    const disabledRows = await prisma.providerConfig.findMany({
      where: { enabled: false },
      select: { provider: true, extraConfig: true },
    });
    for (const row of disabledRows) {
      const extra = row.extraConfig as Record<string, unknown> | null;
      // Pas de marqueur = désactivation VOLONTAIRE (admin) → on ne touche pas.
      if (!extra || extra["disabled_by_cost_cap"] === undefined) continue;
      const restExtra: Record<string, unknown> = { ...extra };
      delete restExtra["disabled_by_cost_cap"];
      await prisma.providerConfig.update({
        where: { provider: row.provider },
        data: { enabled: true, extraConfig: restExtra as never },
      });
      reenabledProviders.push(row.provider);
    }
  } catch (err) {
    console.warn(
      "[cost-tracker] reset mensuel : ré-activation providers échouée :",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 3. Levée du kill switch SI ET SEULEMENT SI posé par le cost-cap.
  try {
    const row = await prisma.contentGenConfig.findUnique({ where: { key: "kill_switch" } });
    const value = row?.value as {
      active?: boolean;
      auto?: boolean;
      source?: string;
      triggered_by?: string;
    } | null;
    const posedByCostCap =
      value?.triggered_by === "system:cost-tracker" ||
      (value?.auto === true && value?.source === "cost_cap");
    if (value?.active === true && posedByCostCap) {
      await prisma.contentGenConfig.update({
        where: { key: "kill_switch" },
        data: {
          value: {
            active: false,
            reason: "Levé automatiquement : reset mensuel du cost cap",
            resolved_at: new Date().toISOString(),
            resolved_by: "system:cost-cap-reset",
          } as never,
          updatedBy: "system:cost-cap-reset",
          updatedAt: new Date(),
        },
      });
      killSwitchLifted = true;
    }
  } catch (err) {
    console.warn(
      "[cost-tracker] reset mensuel : levée kill switch échouée :",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 4. F6 — extinction du bandeau « coût 80/100 % » (même motif que
  // `resolveAnomaly` dans content-monitoring-worker : updateMany no-op si la
  // clé n'existe pas, pas de création inutile).
  try {
    await prisma.contentGenConfig.updateMany({
      where: { key: "cost_cap_80_active" },
      data: {
        value: { active: false, resolvedAt: new Date().toISOString() } as never,
        updatedBy: "system:cost-cap-reset",
      },
    });
  } catch (err) {
    console.warn(
      "[cost-tracker] reset mensuel : extinction bandeau cost_cap_80_active échouée :",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 5. Journal + alerte Telegram de ce qui a été réarmé (best-effort).
  if (reenabledProviders.length > 0 || killSwitchLifted) {
    console.log(
      `[cost-tracker] reset mensuel : providers ré-activés=[${reenabledProviders.join(", ")}] ` +
        `killSwitchLifted=${killSwitchLifted}`,
    );
    try {
      await sendTelegram({
        tag: "MONITORING",
        silent: true,
        body:
          `*Reset mensuel cost cap*\n` +
          `Compteurs remis à 0 (${result.count} provider(s)).\n` +
          (reenabledProviders.length > 0
            ? `Providers ré-activés (coupés par le cost-cap) : ${reenabledProviders.map((p) => `\`${p}\``).join(", ")}.\n`
            : "") +
          (killSwitchLifted ? `Kill switch auto (cost-cap) levé — génération relancée.\n` : "") +
          `Les providers désactivés manuellement restent désactivés.`,
      });
    } catch {
      // best-effort — l'alerte ne conditionne pas le reset.
    }
  }

  return { countersReset: result.count, reenabledProviders, killSwitchLifted };
}
