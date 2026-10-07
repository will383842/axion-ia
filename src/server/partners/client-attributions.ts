/**
 * client-attributions.ts — le client de l'API 1 d'Axion Partners (INT-T07-A, REQ-INT-014,
 * REQ-INT-015).
 *
 * `GET <origine de Partners>/api/integrations/axionia/attributions?siren=` dit si une entreprise est
 * libre, réservée par un apporteur, ou cliente apportée par lui. axion-ia l'interroge à la CRÉATION
 * d'un devis, avant son envoi, et en lecture sur la fiche du client (décision D3 de Williams du
 * 2026-10-01).
 *
 * ── L'appel ──────────────────────────────────────────────────────────────────────────────────
 * Porteur du jeton dédié (`AXIONIA_API_TOKEN`) et de son kid, `x-axionia-kid` = `kidDe(jeton)`
 * (avenant A01 du 2026-09-30, QA-T52) : Partners refuse un appel sans lui. L'origine est celle de
 * l'URL d'ingestion du canal (`PARTNERS_SYNC_URL`) : une seule adresse de Partners à configurer.
 *
 * ── L'échec ouvert ───────────────────────────────────────────────────────────────────────────
 * Le délai est de 2 s. Une panne ne LÈVE JAMAIS : elle rend un motif fermé (`timeout`, `http_<code>`,
 * `illisible`, `reseau`, `redirection`), signalé sur la console sans la réponse, sans le SIREN et sans
 * le nom. Une redirection n'est JAMAIS suivie (`redirect: "manual"`, dette de la sécurité, issue
 * Partners 754, 5987357109) : le jeton porteur ne part vers aucune autre adresse, et tout 3xx est
 * une panne. Le devis n'est jamais bloqué ; l'affichage, lui, dit la panne (jamais un « libre » par défaut).
 *
 * ── La donnée de personne ────────────────────────────────────────────────────────────────────
 * Le nom affichable (prénom et initiale) n'est conservé que le temps du cache : 5 minutes, en
 * mémoire du serveur, indexé par SIREN, pour les seules réponses CONFORMES. Une panne n'est jamais
 * mise en cache. Il n'entre dans aucun journal, et la réponse est jugée par un schéma FERMÉ, celui
 * du contrat publié par Partners (INT-T07-P, `api_attributions_reponse`).
 *
 * ── Inertie ──────────────────────────────────────────────────────────────────────────────────
 * Canal fermé, build, jeton absent ou trop court, URL absente : aucun appel, aucun signal.
 */
import { z } from "zod";

import { peutOuvrirDossierApporteur } from "@/server/auth/habilitations";

import { urlPartners } from "./config";
import { kidDe } from "./enveloppe";
import { canalPartnersOuvert } from "../partners-sync/config";

/** Le chemin de l'API 1, tel que le contrat le déclare. */
export const CHEMIN_API_ATTRIBUTIONS = "/api/integrations/axionia/attributions";
/** Le délai de l'appel (titre de la tâche). */
export const DELAI_API_ATTRIBUTIONS_MS = 2_000;
/** La durée du cache, et la seule conservation du nom côté axion-ia. */
export const CACHE_ATTRIBUTIONS_MS = 5 * 60_000;
/** Un jeton plus court n'est pas un jeton : le canal reste inerte. */
const LONGUEUR_MIN_JETON = 32;

const SIREN = /^[0-9]{9}$/;

/** Les motifs du contrat (`packages/contracts/api.ts` de Partners), recopiés : ils ne se devinent pas. */
const MOTIF_MOIS = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MOTIF_NOM_AFFICHABLE = /^[\p{L}][\p{L}'’-]*( [\p{L}][\p{L}'’-]*)* \p{L}\.$/u;
const LONGUEUR_MAX_NOM_AFFICHABLE = 64;

/** La réponse 200, FERMÉE, et ses règles par statut (`allOf` du contrat). */
const schemaReponse = () =>
  z
    .object({
      statut: z.enum(["libre", "attribuee", "cliente"]),
      until: z.string().regex(MOTIF_MOIS).nullable(),
      apporteurRef: z.string().regex(MOTIF_UUID).nullable(),
      nomAffichable: z
        .string()
        .max(LONGUEUR_MAX_NOM_AFFICHABLE)
        .regex(MOTIF_NOM_AFFICHABLE)
        .nullable(),
    })
    .strict()
    .refine((r) =>
      r.statut === "libre"
        ? r.until === null && r.apporteurRef === null && r.nomAffichable === null
        : r.statut === "attribuee"
          ? r.apporteurRef !== null
          : r.until === null && r.apporteurRef !== null,
    );

export type AttributionPartners = z.infer<ReturnType<typeof schemaReponse>>;

/** Les motifs fermés d'une lecture impossible. */
export type MotifDIndisponibilite =
  | "inactif"
  | "siren_invalide"
  | "timeout"
  | `http_${number}`
  | "illisible"
  | "reseau"
  | "redirection";

export type LectureAttribution =
  | { readonly ok: true; readonly attribution: AttributionPartners }
  | { readonly ok: false; readonly motif: MotifDIndisponibilite };

export interface CacheAttributions {
  lire(siren: string, maintenantMs: number): AttributionPartners | undefined;
  poser(siren: string, attribution: AttributionPartners, maintenantMs: number): void;
}

/** Un cache en mémoire, indexé par SIREN ; une entrée échue est retirée à sa lecture. */
export function creerCacheAttributions(): CacheAttributions {
  const entrees = new Map<string, { attribution: AttributionPartners; expireMs: number }>();
  return {
    lire(siren, maintenantMs) {
      const e = entrees.get(siren);
      if (e === undefined) return undefined;
      if (maintenantMs >= e.expireMs) {
        entrees.delete(siren);
        return undefined;
      }
      return e.attribution;
    },
    poser(siren, attribution, maintenantMs) {
      for (const [cle, e] of entrees) if (maintenantMs >= e.expireMs) entrees.delete(cle);
      entrees.set(siren, { attribution, expireMs: maintenantMs + CACHE_ATTRIBUTIONS_MS });
    },
  };
}

/** Le cache du processus serveur. */
const CACHE_DU_SERVEUR = creerCacheAttributions();

/** Le jeton porteur de l'API 1 ; `null` absent ou trop court. Relu à chaque appel. */
export function jetonApiPartners(): string | null {
  const brut = process.env.AXIONIA_API_TOKEN?.trim();
  return brut !== undefined && brut.length >= LONGUEUR_MIN_JETON ? brut : null;
}

/** Le signal d'une panne : le motif fermé, rien d'autre. */
function signalerParDefaut(motif: MotifDIndisponibilite): void {
  console.warn(`[partners] API 1 indisponible : ${motif}`);
}

export type DependancesAttributions = {
  fetch?: typeof globalThis.fetch;
  maintenantMs?: () => number;
  signaler?: (motif: MotifDIndisponibilite) => void;
  cache?: CacheAttributions;
};

/**
 * L'attribution de `siren` selon Partners, ou le motif fermé de son indisponibilité. Ne lève jamais.
 */
export async function lireAttributionPartners(
  siren: string,
  d: DependancesAttributions = {},
): Promise<LectureAttribution> {
  if (!SIREN.test(siren)) return { ok: false, motif: "siren_invalide" };
  const jeton = jetonApiPartners();
  const url = urlPartners();
  if (!canalPartnersOuvert() || jeton === null || url === null)
    return { ok: false, motif: "inactif" };

  const maintenant = (d.maintenantMs ?? Date.now)();
  const cache = d.cache ?? CACHE_DU_SERVEUR;
  const enCache = cache.lire(siren, maintenant);
  if (enCache !== undefined) return { ok: true, attribution: enCache };

  const signaler = d.signaler ?? signalerParDefaut;
  const echec = (motif: MotifDIndisponibilite): LectureAttribution => {
    signaler(motif);
    return { ok: false, motif };
  };

  let cible: URL;
  try {
    cible = new URL(CHEMIN_API_ATTRIBUTIONS, new URL(url).origin);
  } catch {
    return { ok: false, motif: "inactif" };
  }
  cible.searchParams.set("siren", siren);

  const abandon = new AbortController();
  const minuteur = setTimeout(() => abandon.abort(), DELAI_API_ATTRIBUTIONS_MS);
  let reponse: Response;
  try {
    reponse = await (d.fetch ?? globalThis.fetch)(cible.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${jeton}`, "x-axionia-kid": kidDe(jeton) },
      signal: abandon.signal,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return echec(abandon.signal.aborted ? "timeout" : "reseau");
  } finally {
    clearTimeout(minuteur);
  }
  // Un 3xx rendu tel quel (Node) ou une redirection opaque (navigateur) : jamais suivie, une panne.
  if (reponse.type === "opaqueredirect" || (reponse.status >= 300 && reponse.status < 400))
    return echec("redirection");
  if (reponse.status !== 200) return echec(`http_${reponse.status}`);

  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch {
    return echec("illisible");
  }
  const lu = schemaReponse().safeParse(corps);
  if (!lu.success) return echec("illisible");
  cache.poser(siren, lu.data, maintenant);
  return { ok: true, attribution: lu.data };
}

// ── Le bandeau (textes de la juriste, issue Partners 754, 5987058132, MOT POUR MOT) ─────────────

/**
 * Les textes du bandeau d'attribution, recopiés de la juriste. `{nom}` est le nom affichable rendu
 * par Partners ; `{mois}` est le mois de l'échéance en toutes lettres (« décembre 2026 »).
 */
export const TEXTES_DU_BANDEAU = {
  reservee:
    "Entreprise réservée par {nom} jusqu'en {mois} : une commande signée d'ici là peut ouvrir droit à commission pour cet apporteur.",
  deposee:
    "Entreprise déposée par {nom}, en cours de confirmation : si le dépôt est confirmé, une commande signée pendant la réservation pourra ouvrir droit à commission.",
  cliente:
    "Entreprise apportée par {nom} : ses commandes peuvent ouvrir droit à commission selon le contrat de l'apporteur.",
  panne:
    "Les réservations d'Axion Partners ne peuvent pas être lues pour le moment. Le devis reste possible ; une réservation existante s'appliquera quand même à la commande.",
  /** Le cas 5 : le nom indisponible est remplacé par ces mots, et rien d'autre ne change. */
  nomIndisponible: "un apporteur",
} as const;

const MOIS_EN_LETTRES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** « 2026-12 » → « décembre 2026 ». Le contrat ne porte que le mois : aucun fuseau n'entre en jeu. */
export function moisEnLettres(mois: string): string {
  const [annee, numero] = mois.split("-");
  return `${MOIS_EN_LETTRES[Number(numero) - 1]} ${annee}`;
}

/**
 * Le texte du bandeau pour une lecture de l'API 1, ou `null` quand il n'y a rien à dire : une
 * entreprise libre (cas 1), un canal inerte (Partners n'est pas en service) ou un client sans SIREN
 * (rien à demander). Toute autre lecture impossible donne le texte de la panne (cas 6), jamais un
 * bandeau vide qui ferait croire l'entreprise libre.
 */
export function texteDuBandeau(lecture: LectureAttribution): string | null {
  if (!lecture.ok)
    return lecture.motif === "inactif" || lecture.motif === "siren_invalide"
      ? null
      : TEXTES_DU_BANDEAU.panne;
  const a = lecture.attribution;
  const nom = a.nomAffichable ?? TEXTES_DU_BANDEAU.nomIndisponible;
  if (a.statut === "libre") return null;
  if (a.statut === "cliente") return TEXTES_DU_BANDEAU.cliente.replace("{nom}", () => nom);
  if (a.until === null) return TEXTES_DU_BANDEAU.deposee.replace("{nom}", () => nom);
  const mois = moisEnLettres(a.until);
  return TEXTES_DU_BANDEAU.reservee.replace("{nom}", () => nom).replace("{mois}", () => mois);
}

/**
 * Le bandeau pour CE rôle (arbitrage de la coordination sur l'issue Partners 754, 6032310061) : il
 * porte le prénom et l'initiale d'un apporteur, et seuls les rôles qui ouvrent le dossier d'un
 * apporteur (`peutOuvrirDossierApporteur`) le voient ; `reader` et `editor` non. Le rôle est jugé AU SERVEUR, AVANT l'appel :
 * pour un autre rôle, Partners n'est pas appelé, et aucun nom n'entre dans ce qui part au navigateur.
 */
export async function bandeauPourLeRole(
  role: string | null | undefined,
  siren: string | null,
  d: DependancesAttributions = {},
): Promise<string | null> {
  if (!peutOuvrirDossierApporteur(role) || siren === null) return null;
  return texteDuBandeau(await lireAttributionPartners(siren, d));
}
