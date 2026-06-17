"use server";

// Observatoire IA 2026 — Server Action PUBLIQUE (sans requireAdmin).
// Persiste une réponse anonyme au questionnaire. Anti-spam : honeypot +
// horodatage + rate-limit IP. Aucune PII collectée (enquête anonyme) ;
// `visitorId` = IP hashée SHA-256 (RGPD). Pas de recalcul snapshot synchrone
// (le snapshot est recalculé via l'action admin / le worker).

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  CompanySize,
  RespondentRole,
  MaturityLevel,
  CompetitorsUseAi,
  HasStrategy,
  AnnualBudget,
  TimeSavedPerDay,
  RgpdConcern,
  TeamTrained,
  Satisfaction,
  InvestmentIntent,
  Locale,
} from "../../../../prisma/generated/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { hashIp } from "@/lib/security/ip-hash";
import {
  SECTOR_SLUGS,
  REGION_SLUGS,
  USE_CASE_VALUES,
  TOOL_VALUES,
  BARRIER_VALUES,
  BARRIERS_MAX_SELECTIONS,
  MATURITY_GE_POC,
} from "@/content/observatoire/questions";

export type SubmitBarometerState = { ok: true } | { ok: false; error: string };

const sectorSchema = z.string().refine((s) => SECTOR_SLUGS.includes(s), "secteur invalide");
const regionSchema = z.string().refine((s) => REGION_SLUGS.includes(s), "région invalide");

const inputSchema = z
  .object({
    companySize: z.nativeEnum(CompanySize),
    sector: sectorSchema,
    region: regionSchema,
    respondentRole: z.nativeEnum(RespondentRole),
    maturityLevel: z.nativeEnum(MaturityLevel),
    competitorsUseAi: z.nativeEnum(CompetitorsUseAi),
    hasStrategy: z.nativeEnum(HasStrategy),
    useCases: z.array(z.enum(USE_CASE_VALUES)).min(1).max(USE_CASE_VALUES.length),
    tools: z.array(z.enum(TOOL_VALUES)).min(1).max(TOOL_VALUES.length),
    annualBudget: z.nativeEnum(AnnualBudget),
    barriers: z.array(z.enum(BARRIER_VALUES)).min(1).max(BARRIERS_MAX_SELECTIONS),
    timeSavedPerDay: z.nativeEnum(TimeSavedPerDay),
    rgpdConcern: z.nativeEnum(RgpdConcern),
    teamTrained: z.nativeEnum(TeamTrained),
    satisfaction: z.nativeEnum(Satisfaction).nullish(),
    investmentIntent: z.nativeEnum(InvestmentIntent),
    locale: z.nativeEnum(Locale).optional(),
    // Anti-spam (non persistés tels quels)
    website: z.string().optional(), // honeypot — doit rester vide
    startedAt: z.number().optional(), // ms epoch d'ouverture du formulaire
  })
  .strict();

/** Délai minimal plausible de remplissage (anti-bot) : 3 s. */
const MIN_FILL_MS = 3000;

export async function submitBarometerResponse(input: unknown): Promise<SubmitBarometerState> {
  try {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Réponses invalides." };
    }
    const data = parsed.data;

    // Honeypot : un bot remplit le champ caché → succès silencieux (pas d'écriture).
    if (data.website && data.website.trim().length > 0) {
      return { ok: true };
    }
    // Horodatage : soumission trop rapide → bot probable → succès silencieux.
    if (typeof data.startedAt === "number" && Date.now() - data.startedAt < MIN_FILL_MS) {
      return { ok: true };
    }

    // Rate-limit par IP.
    const ip = await getClientIp();
    const rl = await checkRateLimit(`barometer:${ip}`, { limit: 5, windowSec: 600 });
    if (!rl.allowed) {
      return { ok: false, error: "Trop de soumissions. Merci de réessayer plus tard." };
    }

    // Satisfaction n'a de sens que si maturité ≥ POC.
    const satisfaction =
      (MATURITY_GE_POC as readonly string[]).includes(data.maturityLevel) && data.satisfaction
        ? data.satisfaction
        : null;

    const rawAnswers = {
      companySize: data.companySize,
      sector: data.sector,
      region: data.region,
      respondentRole: data.respondentRole,
      maturityLevel: data.maturityLevel,
      competitorsUseAi: data.competitorsUseAi,
      hasStrategy: data.hasStrategy,
      useCases: data.useCases,
      tools: data.tools,
      annualBudget: data.annualBudget,
      barriers: data.barriers,
      timeSavedPerDay: data.timeSavedPerDay,
      rgpdConcern: data.rgpdConcern,
      teamTrained: data.teamTrained,
      satisfaction,
      investmentIntent: data.investmentIntent,
    };

    await prisma.barometerResponse.create({
      data: {
        locale: data.locale ?? Locale.fr,
        visitorId: hashIp(ip),
        companySize: data.companySize,
        sector: data.sector,
        region: data.region,
        respondentRole: data.respondentRole,
        maturityLevel: data.maturityLevel,
        competitorsUseAi: data.competitorsUseAi,
        hasStrategy: data.hasStrategy,
        annualBudget: data.annualBudget,
        timeSavedPerDay: data.timeSavedPerDay,
        rgpdConcern: data.rgpdConcern,
        teamTrained: data.teamTrained,
        satisfaction,
        investmentIntent: data.investmentIntent,
        useCases: data.useCases,
        tools: data.tools,
        barriers: data.barriers,
        rawAnswers,
      },
    });

    return { ok: true };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "observatoire", action: "submitBarometerResponse" },
    });
    return { ok: false, error: "Une erreur est survenue. Merci de réessayer." };
  }
}
