// Événement Meta `Schedule` — la réservation de l'échange apporteur
// (2026-10-05, lot 5 du tunnel vidéo).
//
// ── Pourquoi le serveur, et pourquoi à l'enrichissement Calendly ───────────
// Une réservation faite depuis le bouton de l'e-mail (B1, invitation) n'est vue
// par aucun script du site, et celle faite dans la page peut être perdue
// (bloqueur, onglet fermé). L'enrichissement Calendly (`server/calendly/enrich.ts`)
// est le seul endroit qui la connaisse de façon sûre : il appelle ce module,
// UNE fois par réservation.
//
// ── Ce qui décide d'envoyer, et ce qui ne décide jamais ────────────────────
//   · le CONSENTEMENT PUBLICITAIRE se lit sur la FICHE : l'étape 1 y a gardé la
//     réponse à la bannière avec sa date (`details.funnel.consentPub`). La
//     réservation arrive des heures plus tard : la requête ne porte plus rien.
//     Pas de réponse tracée, ou refus : rien ne part (règle de
//     `conversions-api.ts`, inchangée) ;
//   · seul un contact venu de Facebook / Instagram compte (`leadCompteChezMeta`) :
//     un contact LinkedIn ferait croire que la campagne convertit ce qu'elle n'a
//     pas amené ;
//   · une ligne « suspecte » (envoi trop rapide : un robot) ne compte pas — même
//     règle que `Lead` (2026-10-10) ;
//   · le `fbclid` et son HEURE D'ARRIVÉE sont lus sur la fiche (gardés à l'étape 1
//     avec le consentement) pour un `fbc` au bon horodatage.
//
// `event_id` = `schedule:<identifiant de la réservation Calendly>` : le navigateur
// tire `Schedule` avec le même `eventID`, Meta les dédoublonne.
//
// Ne lève jamais. Aucun `server-only` : appelé depuis l'enrichissement, qui tourne
// aussi dans le worker.

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import { leadCompteChezMeta } from "@/lib/commercial-application/lead-apporteur";
import { VSL_MERCI_PATH } from "@/lib/commercial-application/vsl-apporteur";
import { envoyerEvenementMeta, type ResultatEnvoiMeta } from "./conversions-api";

export type ConsentPubFiche = "accepted" | "declined" | "unknown";

export interface DonneesMetaFiche {
  readonly consentPub: ConsentPubFiche;
  readonly source: string | undefined;
  readonly fbp: string | null;
  readonly fbclid: string | null;
  readonly fbcCreeLe: Date | null;
}

function enregistrement(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Ce que la fiche a gardé pour Meta — lecture défensive, PURE. Une réponse à la
 * bannière absente ou mal formée vaut « unknown » : jamais un consentement
 * déduit.
 */
export function lireDonneesMetaFiche(details: unknown): DonneesMetaFiche {
  const d = enregistrement(details);
  const funnel = enregistrement(d["funnel"]);
  const reponse = enregistrement(funnel["consentPub"]);
  const consentPub: ConsentPubFiche =
    reponse["accepte"] === true
      ? "accepted"
      : reponse["accepte"] === false
        ? "declined"
        : "unknown";
  const candidature = enregistrement(d["candidature"]);
  const creeLe = typeof funnel["fbcCreeLe"] === "string" ? new Date(funnel["fbcCreeLe"]) : null;
  return {
    consentPub,
    source:
      typeof candidature["sourceConnaissance"] === "string"
        ? candidature["sourceConnaissance"]
        : undefined,
    fbp: typeof funnel["fbp"] === "string" ? funnel["fbp"] : null,
    fbclid: typeof funnel["fbclidValeur"] === "string" ? funnel["fbclidValeur"] : null,
    fbcCreeLe: creeLe && Number.isFinite(creeLe.getTime()) ? creeLe : null,
  };
}

export interface EnvoyerScheduleInput {
  /** Identifiant de la ligne `calendly_events` — dédoublonnage avec le navigateur. */
  calendlyEventId: string;
  submissionId: string;
  /** Adresse CONFIRMÉE par l'API Calendly (jamais celle d'un corps de requête public). */
  email: string;
  nom?: string | null;
  telephone?: string | null;
  at?: Date;
  fetchImpl?: typeof fetch;
}

export type ResultatSchedule =
  | ResultatEnvoiMeta
  | {
      envoye: false;
      motif: "fiche_introuvable" | "pas_facebook" | "suspect" | "base_indisponible";
    };

export async function envoyerScheduleApporteur(
  input: EnvoyerScheduleInput,
): Promise<ResultatSchedule> {
  let details: unknown;
  try {
    const fiche = await prisma.submission.findUnique({
      where: { id: input.submissionId },
      select: { details: true },
    });
    if (!fiche) return { envoye: false, motif: "fiche_introuvable" };
    details = fiche.details;
  } catch (err) {
    console.warn("[meta-schedule] fiche illisible", err instanceof Error ? err.message : err);
    return { envoye: false, motif: "base_indisponible" };
  }

  const m = lireDonneesMetaFiche(details);
  if (!leadCompteChezMeta(m.source)) return { envoye: false, motif: "pas_facebook" };
  // 2026-10-10 — même règle que `Lead` et `SubmitApplication` : une ligne marquée
  // « suspecte » (robot) n'entraîne pas Meta.
  const vsl = enregistrement(enregistrement(details)["vsl"]);
  if (vsl["suspect"] === true) return { envoye: false, motif: "suspect" };

  const prenom = (input.nom ?? "").trim().split(/\s+/)[0] ?? "";
  return envoyerEvenementMeta(
    "Schedule",
    {
      eventId: `schedule:${input.calendlyEventId}`,
      email: input.email,
      telephone: input.telephone ?? null,
      prenom: prenom || null,
      fbp: m.fbp,
      fbclid: m.fbclid,
      fbcCreeLe: m.fbcCreeLe,
      sourceUrl: `${SITE_URL}/fr${VSL_MERCI_PATH}`,
      at: input.at ?? new Date(),
    },
    {
      // La réponse tracée sur la fiche, telle quelle : « accepted » seulement si
      // la personne l'a donnée à l'étape 1.
      consentPub: m.consentPub,
      ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
    },
  );
}
