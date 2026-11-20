"use server";

// Score IA TPE-PME — ajout VOLONTAIRE des réponses à l'Observatoire.
// Plan V2-10 §4. Ce qui est écrit : les 15 réponses, la source, la version du texte de
// consentement, l'empreinte du code de retrait, la date TRONQUÉE AU JOUR. Jamais :
// IP, empreinte d'IP, e-mail, agent navigateur, score, référent, identifiant (visitorId null).
// Double verrou : sans `consentement === true` ET version en vigueur, rien n'est écrit.

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
  InvestmentIntent,
  Locale,
} from "../../../../prisma/generated/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { hashIp } from "@/lib/security/ip-hash";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  SECTOR_SLUGS,
  REGION_SLUGS,
  USE_CASE_VALUES,
  TOOL_VALUES,
  BARRIER_VALUES,
  BARRIERS_MAX_SELECTIONS,
} from "@/content/observatoire/questions";
import { CONSENT_VERSION, RATE_LIMIT_PREFIX, SOURCE_SCORE } from "@/lib/score-ia-pme/constantes";

export type AjoutObservatoireState = { ok: true } | { ok: false; error: string };

const MIN_FILL_MS = 3000;

const sectorSchema = z.string().refine((s) => SECTOR_SLUGS.includes(s), "secteur invalide");
const regionSchema = z.string().refine((s) => REGION_SLUGS.includes(s), "région invalide");

/** « none » est exclusif : seul, ou absent. */
const choixExclusif = <T extends readonly [string, ...string[]]>(valeurs: T, max: number) =>
  z
    .array(z.enum(valeurs))
    .min(1)
    .max(max)
    .refine((a) => !a.includes("none") || a.length === 1, "« none » est exclusif")
    .refine((a) => new Set(a).size === a.length, "doublon");

const inputSchema = z
  .object({
    companySize: z.nativeEnum(CompanySize),
    sector: sectorSchema,
    region: regionSchema,
    respondentRole: z.nativeEnum(RespondentRole),
    maturityLevel: z.nativeEnum(MaturityLevel),
    competitorsUseAi: z.nativeEnum(CompetitorsUseAi),
    hasStrategy: z.nativeEnum(HasStrategy),
    useCases: choixExclusif(USE_CASE_VALUES, USE_CASE_VALUES.length),
    tools: choixExclusif(TOOL_VALUES, TOOL_VALUES.length),
    annualBudget: z.nativeEnum(AnnualBudget),
    barriers: z
      .array(z.enum(BARRIER_VALUES))
      .min(1)
      .max(BARRIERS_MAX_SELECTIONS)
      .refine((a) => new Set(a).size === a.length, "doublon"),
    timeSavedPerDay: z.nativeEnum(TimeSavedPerDay),
    rgpdConcern: z.nativeEnum(RgpdConcern),
    teamTrained: z.nativeEnum(TeamTrained),
    investmentIntent: z.nativeEnum(InvestmentIntent),
    locale: z.nativeEnum(Locale).optional(),
    // Consentement : double verrou serveur.
    consentement: z.literal(true),
    consentVersion: z.literal(CONSENT_VERSION),
    // SHA-256 (hex) du code de retrait, calculé dans le navigateur.
    codeRetraitHash: z.string().regex(/^[0-9a-f]{64}$/),
    turnstileToken: z.string().min(1).max(4096),
    // Anti-spam (non persistés)
    website: z.string().optional(),
    startedAt: z.number().optional(),
  })
  .strict();

/** Date tronquée au jour (00:00:00.000 UTC) : évite le recoupement avec les journaux d'accès. */
function auJour(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function ajouterALObservatoire(input: unknown): Promise<AjoutObservatoireState> {
  try {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Réponses invalides." };
    const data = parsed.data;

    // Honeypot / délai trop court : succès silencieux, aucune écriture.
    if (data.website && data.website.trim().length > 0) return { ok: true };
    if (typeof data.startedAt === "number" && Date.now() - data.startedAt < MIN_FILL_MS) {
      return { ok: true };
    }

    // Limite de débit par EMPREINTE d'IP (jamais l'IP en clair dans la clé Redis).
    const ip = await getClientIp();
    const rl = await checkRateLimit(`${RATE_LIMIT_PREFIX}:${hashIp(ip) ?? "inconnu"}`, {
      limit: 5,
      windowSec: 600,
    });
    if (!rl.allowed)
      return { ok: false, error: "Trop de tentatives. Merci de réessayer plus tard." };

    // Turnstile vérifié côté serveur (comme le formulaire existant).
    if (!(await verifyTurnstile(data.turnstileToken, ip))) {
      return { ok: false, error: "Vérification anti-robot refusée. Rien n'a été enregistré." };
    }

    const jour = auJour(new Date());
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
      investmentIntent: data.investmentIntent,
    };

    await prisma.barometerResponse.create({
      data: {
        locale: data.locale ?? Locale.fr,
        visitorId: null,
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
        satisfaction: null,
        investmentIntent: data.investmentIntent,
        useCases: data.useCases,
        tools: data.tools,
        barriers: data.barriers,
        rawAnswers,
        submittedAt: jour,
        createdAt: jour,
        source: SOURCE_SCORE,
        consentVersion: CONSENT_VERSION,
        codeRetraitHash: data.codeRetraitHash,
      },
    });
    return { ok: true };
  } catch (e) {
    // Aucun `extra` ni contexte de requête : les réponses ne vont jamais dans Sentry.
    Sentry.captureException(e, { tags: { area: "score-ia-pme", action: "ajouter" } });
    return { ok: false, error: "Une erreur est survenue. Rien n'a été enregistré." };
  }
}
