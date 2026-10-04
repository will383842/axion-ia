// Le TYPE d'un rendez-vous Calendly — classé UNE fois, à l'écriture (2026-10-04).
//
// Chantier « Types de rendez-vous », lot L1. Plan :
// `_PLAN-TYPES-RDV-2026-10-04/PLAN.md`.
//
// ── Le défaut que ce module ferme ─────────────────────────────────────────
// Le compte Calendly unique porte plusieurs types de rendez-vous : diagnostic,
// échange projet, échange apporteur, rencontre salon. Le type se devinait
// jusqu'ici à CHAQUE lecture, par un mot-clé dans le NOM de l'événement
// (`appel-apporteur.ts`, `rdv-salon.ts`, `visio/liste-blanche-types.ts`).
// Renommer un type dans Calendly suffisait donc à le faire changer de monde :
// un « Discutons de votre projet » rebaptisé « Échange projet » sortait du
// dossier client sans que personne l'ait décidé.
//
// ── La règle ──────────────────────────────────────────────────────────────
// 1. D'abord l'URI du type (`scheduled_event.event_type`), comparée aux types
//    CONNUS, obtenus en résolvant les URL de réservation configurées contre la
//    liste `/event_types` (celle de `availability.ts`, en cache — aucun second
//    appel). L'URI ne change jamais quand on renomme un type.
// 2. Sinon (URI inconnue, API indisponible, jeton absent, build) : le NOM, avec
//    les règles historiques — les mêmes que la reprise SQL de la migration
//    `20261004180000_calendly_type_rendez_vous`.
// 3. Jamais d'exception : dans le doute, le nom ; et sans nom parlant, `autre`.
//
// Module NEUTRE (ni `server-only`, ni Next) : le worker du sondage l'importe.
// Au build (`stub.invalid`) et sans jeton, il n'émet AUCUNE requête.

import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import { estRdvSalon } from "@/server/calendly/rdv-salon";
import { canonicalPath, listerTypesEvenementCalendly } from "@/server/calendly/availability";
// Module pur, sans import : la règle « quelles réponses du formulaire » est la
// sienne (téléphone écarté), partagée avec la console et le dossier client.
import { reponsesFormulaire } from "@/features/admin-rendezvous/a-venir";

/** Les cinq types — 🔑 MIROIR EXACT de l'enum Prisma `TypeRendezVous`. */
export const TYPES_RENDEZ_VOUS = [
  "diagnostic",
  "echange_projet",
  "apporteur",
  "salon",
  "autre",
] as const;

export type TypeRendezVous = (typeof TYPES_RENDEZ_VOUS)[number];

/** Libellés français, pour la console, les alertes et les e-mails (lots L2/L3). */
export const LIBELLES_TYPE_RENDEZ_VOUS: Readonly<Record<TypeRendezVous, string>> = {
  diagnostic: "Diagnostic IA",
  echange_projet: "Échange projet",
  apporteur: "Apporteur",
  salon: "Salon",
  autre: "Autre",
};

/** Vrai si la valeur est l'un des cinq types. */
export function estTypeRendezVous(valeur: unknown): valeur is TypeRendezVous {
  return typeof valeur === "string" && (TYPES_RENDEZ_VOUS as readonly string[]).includes(valeur);
}

// ── URL de réservation connues ─────────────────────────────────────────────
//
// Les défauts sont les URL réelles du compte : le worker ne reçoit pas les
// variables `NEXT_PUBLIC_*` (elles sont inlinées au build de l'application),
// et un classement fiable ne doit pas dépendre d'une variable oubliée.

/** Type « Discutons de votre projet IA » (bientôt « Échange projet »). */
export const URL_CALENDLY_APPEL_PAR_DEFAUT = "https://calendly.com/axion-ia/premier-contact";
/** Type « Diagnostic IA » — à créer chez Calendly (lot 5 du plan). */
export const URL_CALENDLY_DIAGNOSTIC_PAR_DEFAUT = "https://calendly.com/axion-ia/diagnostic-ia";
/** Type « Échange apporteur d'affaires » (15 min). */
export const URL_CALENDLY_APPORTEUR_PAR_DEFAUT =
  "https://calendly.com/axion-ia/echange-apporteur-affaires";

function urlOuDefaut(valeur: string | undefined, defaut: string): string {
  const v = valeur?.trim();
  return v ? v : defaut;
}

/** Les URL de réservation configurées, chacune rattachée à son type. */
export function urlsDeReservationConfigurees(): ReadonlyArray<{
  readonly url: string;
  readonly type: TypeRendezVous;
}> {
  return [
    {
      url: urlOuDefaut(
        process.env.NEXT_PUBLIC_CALENDLY_DIAGNOSTIC_URL,
        URL_CALENDLY_DIAGNOSTIC_PAR_DEFAUT,
      ),
      type: "diagnostic",
    },
    {
      url: urlOuDefaut(process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL, URL_CALENDLY_APPEL_PAR_DEFAUT),
      type: "echange_projet",
    },
    {
      url: urlOuDefaut(process.env.CALENDLY_APPORTEUR_URL, URL_CALENDLY_APPORTEUR_PAR_DEFAUT),
      type: "apporteur",
    },
  ];
}

// ── Priorité 2 : le nom ────────────────────────────────────────────────────

/** « Échange-projet  IA » → « echange projet ia » (tirets du slug compris). */
function normaliserNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Morceaux de nom qui désignent un échange projet. « premier contact » = slug de l'iframe. */
const MOTS_ECHANGE_PROJET = ["discutons de votre projet", "echange projet", "premier contact"];

/**
 * Classement par le NOM seul — repli, et règle de la reprise SQL.
 *
 * Ordre : apporteur, salon (sans apporteur), diagnostic, échange projet, autre.
 * Les deux premiers réutilisent les règles existantes (`estAppelApporteur`,
 * `estRdvSalon`) pour qu'il n'existe qu'une définition de chaque mot-clé.
 */
export function classerParNom(nom: string | null | undefined): TypeRendezVous {
  if (!nom || !nom.trim()) return "autre";
  if (estAppelApporteur(nom)) return "apporteur";
  if (estRdvSalon(nom)) return "salon";
  const n = normaliserNom(nom);
  if (n.includes("diagnostic")) return "diagnostic";
  if (MOTS_ECHANGE_PROJET.some((m) => n.includes(m))) return "echange_projet";
  return "autre";
}

// ── Priorité 1 : l'URI ─────────────────────────────────────────────────────

/** URI d'API d'un type d'événement Calendly, ou `null` si la valeur n'en est pas une. */
export function uriDeTypeValide(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const v = valeur.trim();
  if (!v.startsWith("https://api.calendly.com/event_types/") || v.length > 255) return null;
  return v;
}

/**
 * Construit la table « URI du type → type de rendez-vous » à partir de la liste
 * `/event_types`. PURE : testable sans réseau.
 *
 * Un type dont l'URL de réservation correspond à une URL configurée prend le
 * type de celle-ci ; un type dont le SLUG contient « salon » est un salon ; les
 * autres ne sont pas dans la table (leurs rendez-vous retombent sur le nom).
 */
export function tableDesTypesConnus(
  typesCalendly: ReadonlyArray<Record<string, unknown>>,
  urls = urlsDeReservationConfigurees(),
): ReadonlyMap<string, TypeRendezVous> {
  const parChemin = new Map<string, TypeRendezVous>();
  for (const { url, type } of urls) {
    const chemin = canonicalPath(url);
    if (chemin && !parChemin.has(chemin)) parChemin.set(chemin, type);
  }

  const table = new Map<string, TypeRendezVous>();
  for (const et of typesCalendly) {
    const uri = uriDeTypeValide(et["uri"]);
    const sched = et["scheduling_url"];
    if (!uri || typeof sched !== "string") continue;
    const chemin = canonicalPath(sched);
    if (!chemin) continue;
    const configure = parChemin.get(chemin);
    if (configure) {
      table.set(uri, configure);
      continue;
    }
    const slug = chemin.split("/").pop() ?? "";
    if (slug.includes("salon")) table.set(uri, "salon");
  }
  return table;
}

/** Durée de vie de la table en mémoire. Le cache Next (24 h) ne vaut pas dans le worker. */
const TTL_TABLE_MS = 60 * 60_000;
/** Après un échec d'API, on ne réessaie pas avant ce délai (repli nom entre-temps). */
const TTL_ECHEC_MS = 5 * 60_000;

let tableEnCache: {
  readonly expireA: number;
  readonly table: ReadonlyMap<string, TypeRendezVous>;
} | null = null;
let chargementEnCours: Promise<ReadonlyMap<string, TypeRendezVous>> | null = null;

const TABLE_VIDE: ReadonlyMap<string, TypeRendezVous> = new Map();

/** Vrai au build (stubs) ou sans jeton : aucune requête ne doit partir. */
function apiInterdite(): boolean {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return true;
  if (process.env.NEXT_PHASE === "phase-production-build") return true;
  return !process.env.CALENDLY_API_TOKEN?.trim();
}

/**
 * Les types connus du compte, en cache. Ne lève JAMAIS : sur échec, table vide
 * (donc repli sur le nom) pendant `TTL_ECHEC_MS`.
 */
export async function chargerTypesConnus(
  nowMs: number = Date.now(),
): Promise<ReadonlyMap<string, TypeRendezVous>> {
  if (apiInterdite()) return TABLE_VIDE;
  if (tableEnCache && tableEnCache.expireA > nowMs) return tableEnCache.table;
  if (chargementEnCours) return chargementEnCours;

  chargementEnCours = (async () => {
    try {
      const liste = await listerTypesEvenementCalendly();
      if (!liste || "failure" in liste) {
        tableEnCache = { expireA: nowMs + TTL_ECHEC_MS, table: TABLE_VIDE };
        return TABLE_VIDE;
      }
      const table = tableDesTypesConnus(liste.types);
      tableEnCache = { expireA: nowMs + TTL_TABLE_MS, table };
      return table;
    } catch {
      tableEnCache = { expireA: nowMs + TTL_ECHEC_MS, table: TABLE_VIDE };
      return TABLE_VIDE;
    } finally {
      chargementEnCours = null;
    }
  })();
  return chargementEnCours;
}

/** Réservé aux tests : oublie la table en mémoire. */
export function reinitialiserCacheTypesRendezVous(): void {
  tableEnCache = null;
  chargementEnCours = null;
}

/**
 * LE point de classement. URI connue → son type ; sinon le nom. Ne lève jamais.
 */
export async function classerRendezVous(entree: {
  readonly eventTypeUri?: string | null;
  readonly eventTypeName?: string | null;
}): Promise<TypeRendezVous> {
  try {
    const uri = uriDeTypeValide(entree.eventTypeUri);
    if (uri) {
      const connu = (await chargerTypesConnus()).get(uri);
      if (connu) return connu;
    }
  } catch {
    // Repli nom ci-dessous : un classement ne doit jamais faire échouer une écriture.
  }
  return classerParNom(entree.eventTypeName);
}

// ── Lecture de la charge brute ─────────────────────────────────────────────

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * L'URI du type portée par `raw_payload`, quelle que soit sa forme :
 *   · ligne enrichie : `{ invitee, event: { event_type } }` ;
 *   · sondage avant enrichissement : le `scheduled_event` lui-même (`event_type`) ;
 *   · iframe non enrichie, saisie manuelle : aucune → `null`.
 */
export function eventTypeUriDuBrut(rawPayload: unknown): string | null {
  const brut = objet(rawPayload);
  if (!brut) return null;
  return (
    uriDeTypeValide(objet(brut["event"])?.["event_type"]) ?? uriDeTypeValide(brut["event_type"])
  );
}

/** Les réponses du formulaire de l'invité portées par `raw_payload` (ligne enrichie). */
function questionsDuBrut(rawPayload: unknown): unknown {
  return objet(objet(rawPayload)?.["invitee"])?.["questions_and_answers"];
}

/** Longueur maximale du besoin transmis au CRM. */
export const BESOIN_MAX = 300;

/**
 * Coupe un texte à `max` unités UTF-16 SANS casser un caractère en deux
 * (relecture A09, 2026-10-04). Un `slice` nu peut couper un emoji entre ses
 * deux moitiés : le surrogate orphelin rend le JSON invalide pour le CRM, qui
 * répond 422 — refus définitif, et tout le rendez-vous est perdu pour lui.
 * Si la coupe tombe après une moitié haute, on la retire : le résultat reste
 * ≤ `max` et toujours bien formé. Toute coupe d'un texte du payload CRM passe
 * par ici.
 */
export function couperTexte(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const dernier = coupe.charCodeAt(coupe.length - 1);
  return dernier >= 0xd800 && dernier <= 0xdbff ? coupe.slice(0, -1) : coupe;
}

/**
 * Le BESOIN exprimé : la réponse à la question dont le libellé contient
 * « service » ou « besoin » (liste audit / formation / intégration / coaching
 * du type Échange projet). `null` s'il n'y en a pas.
 */
export function besoinDesReponses(questionsAndAnswers: unknown): string | null {
  if (!Array.isArray(questionsAndAnswers)) return null;
  for (const qa of questionsAndAnswers) {
    const o = objet(qa);
    const q = o?.["question"];
    const a = o?.["answer"];
    if (typeof q !== "string" || typeof a !== "string" || !a.trim()) continue;
    const libelle = normaliserNom(q);
    // Le libellé RÉEL (« Quel service vous intéresse ? ») ou l'ancien « Quel est
    // votre besoin… » — pas n'importe quelle question qui cite « nos services ».
    if (libelle.includes("quel service") || libelle.includes("votre besoin")) {
      return couperTexte(a.trim(), BESOIN_MAX);
    }
  }
  return null;
}

/** Le besoin lu dans `raw_payload` (ligne enrichie), ou `null`. */
export function besoinDuBrut(rawPayload: unknown): string | null {
  return besoinDesReponses(questionsDuBrut(rawPayload));
}

// ── Réponses du questionnaire (contrat CRM, lot L5b) ───────────────────────

/** Une réponse du questionnaire telle que le CRM la reçoit. */
export interface ReponseCrm {
  readonly question: string;
  readonly reponse: string;
}

/** Bornes du champ `reponses` du payload CRM. */
export const REPONSES_CRM_MAX = 10;
export const QUESTION_CRM_MAX = 120;
export const REPONSE_CRM_MAX = 300;

/**
 * Borne une liste de réponses venue de n'importe où (charge de l'appelant
 * comprise) : au plus 10 entrées lisibles, question ≤ 120, réponse ≤ 300.
 * Une entrée sans question ou sans réponse texte est écartée.
 */
export function bornerReponsesCrm(valeur: unknown): ReponseCrm[] {
  if (!Array.isArray(valeur)) return [];
  const sortie: ReponseCrm[] = [];
  for (const x of valeur) {
    if (sortie.length >= REPONSES_CRM_MAX) break;
    const o = objet(x);
    const q = o?.["question"];
    const r = o?.["reponse"];
    if (typeof q !== "string" || typeof r !== "string") continue;
    const question = couperTexte(q.trim(), QUESTION_CRM_MAX).trim();
    const reponse = couperTexte(r.trim(), REPONSE_CRM_MAX).trim();
    if (!question || !reponse) continue;
    sortie.push({ question, reponse });
  }
  return sortie;
}

/** Les réponses d'un `questions_and_answers` Calendly, bornées pour le CRM. */
export function reponsesDesQuestions(questionsAndAnswers: unknown): ReponseCrm[] {
  return bornerReponsesCrm(
    reponsesFormulaire({ invitee: { questions_and_answers: questionsAndAnswers } }),
  );
}

/** Les réponses lues dans `raw_payload` (ligne enrichie), bornées pour le CRM. */
export function reponsesDuBrut(rawPayload: unknown): ReponseCrm[] {
  return bornerReponsesCrm(reponsesFormulaire(rawPayload));
}

/** Les types dont les réponses partent au CRM : les rendez-vous clients. */
export function typePorteLesReponses(type: TypeRendezVous): boolean {
  return type === "diagnostic" || type === "echange_projet";
}

/** Les UTM du `tracking` de l'invité Calendly, bornées aux colonnes (100). */
export interface UtmDuTracking {
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly utmContent: string | null;
}

export function utmDuTracking(invitee: unknown): UtmDuTracking {
  const t = objet(objet(invitee)?.["tracking"]);
  const lire = (cle: string): string | null => {
    const v = t?.[cle];
    return typeof v === "string" && v.trim() ? couperTexte(v.trim(), 100) : null;
  };
  return {
    utmSource: lire("utm_source"),
    utmMedium: lire("utm_medium"),
    utmCampaign: lire("utm_campaign"),
    utmContent: lire("utm_content"),
  };
}

// ── Contrat CRM ────────────────────────────────────────────────────────────

/**
 * Les trois champs que le `payload` CRM d'un rendez-vous porte TOUJOURS
 * (contrat figé dans le plan) : `eventTypeName`, `typeRendezVous`, `besoin`.
 * Lot L5b : `reponses` en plus, pour le diagnostic et l'échange projet
 * SEULEMENT (absent sinon).
 */
export interface ChampsCrmRendezVous {
  readonly eventTypeName: string;
  readonly typeRendezVous: TypeRendezVous;
  readonly besoin: string | null;
  readonly reponses?: readonly ReponseCrm[];
}

// ── Fenêtre app/worker ─────────────────────────────────────────────────────

const COLONNES_TYPE_RENDEZ_VOUS = ["typeRendezVous", "eventTypeUri", "utmContent"] as const;

/**
 * L'écriture a-t-elle échoué parce que la migration n'est pas encore passée ?
 *
 * Le worker peut redémarrer avec ce code AVANT que l'application ait migré la
 * base (AGENTS.md). `P2022` = colonne absente ; le type énuméré absent remonte,
 * lui, sous un autre code, d'où la lecture du message.
 */
export function estColonneTypeRendezVousAbsente(e: unknown): boolean {
  const o = objet(e);
  if (!o) return false;
  // Un doublon (P2002) n'est jamais une colonne absente, même si le message cite une colonne.
  if (o["code"] === "P2002") return false;
  const message = typeof o["message"] === "string" ? o["message"] : "";
  return /type_rendez_vous|event_type_uri|utm_content|TypeRendezVous/i.test(message);
}

/** Les mêmes données d'écriture, sans les colonnes ajoutées par ce lot. */
export function sansColonnesTypeRendezVous<T extends Record<string, unknown>>(data: T): T {
  const copie: Record<string, unknown> = { ...data };
  for (const c of COLONNES_TYPE_RENDEZ_VOUS) delete copie[c];
  return copie as T;
}
