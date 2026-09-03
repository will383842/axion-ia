// API Conversions Meta — envoi SERVEUR de l'événement `Lead` du tunnel Facebook
// (2026-09-03).
//
// ── Pourquoi un envoi serveur en plus du pixel ──────────────────────────────
// Le pixel navigateur perd une part des conversions : bloqueurs, Safari ITP,
// onglet fermé avant le tir. Meta optimise la diffusion d'une campagne sur les
// conversions qu'elle VOIT : chaque « Lead » manqué dégrade le ciblage et
// renchérit le coût par candidature. L'envoi serveur ne dépend pas du
// navigateur ; les deux tirs portent le MÊME `event_id` (l'identifiant de la
// Submission) et Meta les dédoublonne.
//
// ── Ce que cet envoi NE FAIT JAMAIS ─────────────────────────────────────────
//  1. Partir sans consentement. Le navigateur dit ce qu'il a répondu à la
//     bannière (`consentPub`) ; seul `accepted` déclenche l'appel. Un jeton
//     configuré ne suffit pas. C'est la même règle que le pixel : le serveur
//     n'a pas plus de droits que la page.
//  2. Transmettre une donnée en clair. E-mail, téléphone, prénom et ville sont
//     hachés SHA-256 après normalisation (le format que Meta exige pour
//     l'appariement). L'IP et le user-agent partent tels quels — c'est ce que
//     le pixel enverrait de toute façon, et ils servent au dédoublonnage.
//  3. Bloquer la candidature. Best-effort intégral : jeton absent, réseau
//     muet, 4xx, 5xx — on journalise, on rend `{ envoye: false }`, la
//     Submission est déjà en base et l'e-mail déjà en file.
//
// Sous-traitant déclaré dans `src/content/subprocessors.ts` (Meta Platforms
// Ireland) et registre art. 30 `_AUDIT/DPA-REGISTER.md`.

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/env";

/** Version de l'API Graph. À relever avec les dépréciations Meta (~2 ans). */
export const META_GRAPH_VERSION = "v21.0";

/** Délai au-delà duquel on abandonne : une action serveur ne doit pas attendre Meta. */
const DELAI_MS = 3000;

export interface LeadMetaInput {
  /** Identifiant de la Submission — sert d'`event_id` pour le dédoublonnage pixel/serveur. */
  submissionId: string;
  email: string;
  telephone: string;
  prenom: string;
  ville: string;
  /** IP et user-agent du visiteur, tels que reçus par l'action serveur. */
  ip: string | null;
  userAgent: string | null;
  /** Cookie `_fbp` posé par le pixel (n'existe qu'après consentement). */
  fbp?: string | null;
  /** `fbclid` de l'URL d'arrivée — devient `fbc` au format `fb.1.<ts>.<fbclid>`. */
  fbclid?: string | null;
  /** URL de la page d'où part la candidature. */
  sourceUrl: string;
  /** Horodatage de l'événement. */
  at: Date;
}

/** Objet `data[0]` tel que Meta l'attend. Construit à part pour être testable. */
export interface EvenementMeta {
  event_name: "Lead";
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: {
    em: string[];
    ph: string[];
    fn: string[];
    ct: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbp?: string;
    fbc?: string;
  };
}

function sha256(v: string): string {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

/**
 * Normalisation Meta : minuscules, sans espaces autour. Pour le prénom et la
 * ville, Meta demande en plus de retirer ponctuation et espaces internes.
 */
export function normaliserTexteMeta(v: string): string {
  return v
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normaliserEmailMeta(v: string): string {
  return v.trim().toLowerCase();
}

/**
 * Téléphone en chiffres seuls avec indicatif pays, sans `+` (format Meta).
 * Un numéro français saisi « 06 12 34 56 78 » devient `33612345678`. Renvoie
 * `null` si, une fois nettoyé, il ne ressemble pas à un numéro.
 */
export function normaliserTelephoneMeta(v: string): string | null {
  let chiffres = v.replace(/\D/g, "");
  if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
  else if (chiffres.length === 10 && chiffres.startsWith("0")) chiffres = `33${chiffres.slice(1)}`;
  if (chiffres.length < 8 || chiffres.length > 15) return null;
  return chiffres;
}

/** Construit l'événement — PUR, sans réseau ni environnement. */
export function construireEvenementLead(input: LeadMetaInput): EvenementMeta {
  const tel = normaliserTelephoneMeta(input.telephone);
  const userData: EvenementMeta["user_data"] = {
    em: [sha256(normaliserEmailMeta(input.email))],
    ph: tel ? [sha256(tel)] : [],
    fn: [sha256(normaliserTexteMeta(input.prenom))],
    ct: [sha256(normaliserTexteMeta(input.ville))],
  };
  if (input.ip) userData.client_ip_address = input.ip;
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbclid) userData.fbc = `fb.1.${input.at.getTime()}.${input.fbclid}`;

  return {
    event_name: "Lead",
    event_time: Math.floor(input.at.getTime() / 1000),
    event_id: input.submissionId,
    event_source_url: input.sourceUrl,
    action_source: "website",
    user_data: userData,
  };
}

export type ResultatEnvoiMeta =
  | { envoye: true }
  | { envoye: false; motif: "non_configure" | "sans_consentement" | "refus" | "reseau" };

export interface EnvoyerLeadMetaOptions {
  /** Réponse du visiteur à la bannière — seul `accepted` autorise l'envoi. */
  consentPub: "accepted" | "declined" | "unknown" | undefined;
  /** Injection pour les tests ; `globalThis.fetch` sinon. */
  fetchImpl?: typeof fetch;
}

/**
 * Envoie l'événement `Lead` à Meta. Ne throw JAMAIS.
 *
 * Trois variables d'environnement : `NEXT_PUBLIC_META_PIXEL_ID` (le même
 * identifiant que le pixel navigateur), `META_CAPI_ACCESS_TOKEN` (jeton
 * système généré dans le Gestionnaire d'événements, serveur uniquement) et,
 * facultatif, `META_CAPI_TEST_EVENT_CODE` — code « Événements de test » du
 * Gestionnaire, qui fait apparaître l'envoi dans l'onglet de test au lieu de
 * la production. À poser le temps de vérifier l'installation, puis à retirer.
 */
export async function envoyerLeadMeta(
  input: LeadMetaInput,
  options: EnvoyerLeadMetaOptions,
): Promise<ResultatEnvoiMeta> {
  const pixelId = env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return { envoye: false, motif: "non_configure" };
  if (options.consentPub !== "accepted") return { envoye: false, motif: "sans_consentement" };

  const corps: Record<string, unknown> = { data: [construireEvenementLead(input)] };
  const testCode = env.META_CAPI_TEST_EVENT_CODE;
  if (testCode) corps.test_event_code = testCode;

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`;
  const doFetch = options.fetchImpl ?? globalThis.fetch;

  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Le jeton part dans le CORPS et non dans l'URL : une URL finit dans les
      // journaux d'accès, un corps chiffré en transit n'y finit pas.
      body: JSON.stringify({ ...corps, access_token: token }),
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(
        "[meta-capi] refus",
        JSON.stringify({ status: res.status, detail: detail.slice(0, 300) }),
      );
      Sentry.captureMessage("meta-capi refus", {
        level: "warning",
        tags: { service: "meta-capi" },
        extra: { status: res.status },
      });
      return { envoye: false, motif: "refus" };
    }
    return { envoye: true };
  } catch (err) {
    console.warn("[meta-capi] réseau", err instanceof Error ? err.message : String(err));
    Sentry.captureException(err, { tags: { service: "meta-capi" } });
    return { envoye: false, motif: "reseau" };
  }
}
