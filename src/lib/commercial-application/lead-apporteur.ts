// Premier contact d'un apporteur d'affaires — formulaire COURT du tunnel
// Facebook (2026-09-03).
//
// ── Pourquoi un second formulaire, et pas le wizard ─────────────────────────
// Le wizard `/devenir-commercial-ia/candidature` est un DOSSIER : neuf écrans,
// expériences, pitch de 150 caractères minimum. Il convertit très bien quelqu'un
// qui a lu une annonce et décidé de candidater. Un visiteur venu d'un post
// Facebook n'a rien décidé : il a donné dix secondes à une page, sur son
// téléphone. Lui présenter neuf écrans, c'est le perdre au premier.
//
// Ce formulaire ne demande que ce qu'il faut pour RAPPELER la personne : cinq
// champs. Le dossier complet arrive ensuite, par le lien de l'e-mail, une fois
// l'appel proposé — et le wizard s'ouvre pré-rempli (brouillon local posé par
// la landing, cf. `LeadApporteurForm`).
//
// ── Ce que le schéma NE FAIT PAS ────────────────────────────────────────────
// Il ne note pas, ne trie pas, ne refuse rien : un premier contact n'a pas de
// score. La console l'affiche « à qualifier », et c'est l'appel qui qualifie.
//
// Partagé serveur / client (Zod pur, aucune dépendance Node) — comme `model.ts`.

import { z } from "zod";
import { STATUT_OPTIONS } from "./model";

/**
 * Version du texte de consentement du formulaire court. Distincte de celle du
 * wizard (`COMMERCIAL_APPLICATION_CONSENT_VERSION`) : le texte est différent,
 * la preuve doit pointer vers le bon texte.
 */
export const LEAD_APPORTEUR_CONSENT_VERSION = "lead-apporteur-facebook-v1-2026-09-03";

/** Étape portée par `Submission.details.etape` — distingue le premier contact
 *  du dossier complet dans la même file console. */
export const LEAD_APPORTEUR_ETAPE = "premier-contact";

/** Canal posé automatiquement — doit exister dans `SOURCE_OPTIONS`. */
export const LEAD_APPORTEUR_SOURCE = "facebook";

/** Chemin de la landing, tel qu'il apparaît dans `details.source`.
 *
 * ⚠️ Le nom des constantes reste `TUNNEL_FACEBOOK_*` — elles désignent le
 * CANAL (la campagne Meta), pas le slug. Seule l'URL PUBLIQUE a changé le
 * 2026-09-04 : `/facebook` → `/apporteur-affaires` (demande Will — le mot
 * « facebook » dans l'URL ne dit rien au prospect ; « apporteur d'affaires »
 * annonce le sujet avant même le clic). L'attribution au canal reste portée
 * par `LEAD_APPORTEUR_SOURCE = "facebook"` ci-dessus, PAS par ce chemin.
 *
 * Toute modification ici doit être propagée à `TUNNEL_FACEBOOK_SEGMENTS`
 * (`lib/analytics/tunnel-facebook-routes.ts`, gating du pixel Meta), au
 * dossier de route `app/[locale]/apporteur-affaires/` et aux redirections
 * (`next.config.ts` + `lib/legacy-redirects.ts`). Le test
 * `tunnel-facebook-routes.spec.ts` verrouille l'ensemble. */
export const TUNNEL_FACEBOOK_PATH = "/apporteur-affaires";
export const TUNNEL_FACEBOOK_MERCI_PATH = "/apporteur-affaires/merci";

/** Cible du dossier complet — le wizard existant, pré-rempli par le brouillon. */
export const DOSSIER_COMPLET_PATH = "/devenir-commercial-ia/candidature";

const STATUT_IDS = STATUT_OPTIONS.map((o) => o.id) as [string, ...string[]];

/** Un téléphone plausible : commence par un chiffre ou `+`, au moins six chiffres. */
const TELEPHONE_RE = /^\+?[\d\s().-]{6,}$/;

/**
 * Contexte d'attribution posté PAR LE NAVIGATEUR. Il n'est jamais fiable
 * (n'importe qui peut poster n'importe quoi) : chaque champ est BORNÉ et le
 * serveur ne le lit que pour l'attribution, jamais pour décider.
 */
export const leadContexteSchema = z
  .object({
    /**
     * `location.search` brut au moment de l'envoi. Le serveur en extrait les
     * `utm_*` avec `parseUtmFromUrl` (assainisseur existant) et le `fbclid`
     * (identifiant de clic Meta, base du cookie `_fbc` côté API Conversions).
     */
    query: z.string().max(2000).optional(),
    /** Cookie `_fbp` posé par le pixel — n'existe que si le visiteur a consenti. */
    fbp: z
      .string()
      .regex(/^fb\.1\.\d{6,20}\.\d{1,25}$/)
      .optional(),
    /**
     * Ce que le visiteur a répondu à la bannière. `accepted` est la SEULE
     * valeur qui autorise l'envoi vers l'API Conversions Meta : sans elle, rien
     * ne part, même si le jeton est configuré.
     */
    consentPub: z.enum(["accepted", "declined", "unknown"]).optional(),
    /** Page d'où vient le visiteur (souvent vide depuis l'app Facebook). */
    referrer: z.string().max(300).optional(),
  })
  .strict();

export type LeadContexte = z.infer<typeof leadContexteSchema>;

export const leadApporteurSchema = z
  .object({
    prenom: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(180),
    telephone: z.string().trim().min(6).max(40).regex(TELEPHONE_RE),
    /**
     * 🔴 2026-09-04 — RETIRÉE du mini formulaire, décision de Will.
     *
     * La ville reste une donnée UTILE : elle sert à recruter par région plus
     * tard, et à savoir de quels bassins viennent les contacts. Mais elle n'a
     * rien à faire à l'étape de CAPTURE, pour deux raisons :
     *
     *   1. La page elle-même affirme « Partout en France — ta ville n'a aucune
     *      importance ». Exiger à l'écran un champ que la page déclare sans
     *      objet est une contradiction que le visiteur ressent, même s'il ne la
     *      formule pas.
     *   2. Chaque champ de l'étape de capture se paie en abandons. Passer de
     *      quatre à trois, c'est un quart d'effort en moins là où la perte est
     *      TOTALE — un visiteur qui renonce ici ne laisse rien, pas même un
     *      numéro à rappeler.
     *
     * Elle est demandée au DOSSIER (`model.ts`, écran « Qui es-tu ? »), où elle
     * est obligatoire, et sur l'appel. Le champ reste accepté ici s'il est
     * fourni — un lien ou un test qui la transmettrait n'est pas refusé.
     */
    ville: z.string().trim().max(120).optional(),
    statut: z.enum(STATUT_IDS).optional(),
    /**
     * Case NON pré-cochée (RGPD art. 4.11 : acte positif clair). `literal(true)`
     * et non `boolean` : un `false` qui passerait le schéma serait enregistré
     * comme un consentement absent sur une ligne pourtant créée.
     */
    consent: z.literal(true),
    contexte: leadContexteSchema.optional(),
  })
  .strict();

export type LeadApporteurInput = z.infer<typeof leadApporteurSchema>;

/** Extrait le `fbclid` d'une chaîne de requête, borné à ce que Meta émet. */
export function extraireFbclid(query: string | undefined): string | null {
  if (!query) return null;
  try {
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    const v = params.get("fbclid");
    if (!v) return null;
    return /^[A-Za-z0-9_-]{8,255}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}
