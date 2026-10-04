// Le CHOIX du rendez-vous sur le parcours public (2026-10-04).
//
// Chantier « Types de rendez-vous », lot L2. Plan :
// `_PLAN-TYPES-RDV-2026-10-04/PLAN.md`.
//
// `/appel` propose désormais deux rendez-vous, pris sur le MÊME compte Calendly :
//   · `?rdv=diagnostic` — « Diagnostic IA » (type `diagnostic-ia`) ;
//   · `?rdv=projet`     — « Échange projet » (type `premier-contact`).
//
// Ce module est la SEULE traduction « choix du visiteur → URL Calendly ». Le
// widget, les créneaux, le formulaire maison, le lien de secours, la capture de
// l'iframe et le report passent tous par lui : deux traductions finiraient par
// diverger, et la divergence se verrait sous la forme d'un créneau du mauvais
// type — c'est-à-dire d'un rendez-vous que personne n'a choisi.
//
// ── Le repli, et ce qu'il couvre exactement ───────────────────────────────
// Si le type « Diagnostic IA » est INTROUVABLE chez Calendly (supprimé,
// désactivé, URL fausse) alors que la liste des types a bien été lue, le choix
// « diagnostic » retombe SANS BRUIT sur le type appel. Le visiteur réserve un
// échange au lieu d'une page d'erreur Calendly.
//
// ⚠️ Quand la liste est ILLISIBLE (jeton absent, API en panne), on garde l'URL du
// diagnostic : l'absence n'est pas prouvée, et le repli de la page (l'iframe
// Calendly derrière un clic) ouvrira la vraie page du type, qui existe.
//
// Module NEUTRE (ni `server-only`, ni Next) : testable sans framework.

import { canonicalPath, listerTypesEvenementCalendly } from "@/server/calendly/availability";
import {
  classerParNom,
  estTypeRendezVous,
  uriDeTypeValide,
  URL_CALENDLY_APPEL_PAR_DEFAUT,
  URL_CALENDLY_APPORTEUR_PAR_DEFAUT,
  URL_CALENDLY_DIAGNOSTIC_PAR_DEFAUT,
  type TypeRendezVous,
} from "@/server/calendly/type-rendez-vous";

/** Les deux choix offerts au public. */
export const CHOIX_RENDEZ_VOUS = ["diagnostic", "projet"] as const;
export type ChoixRendezVous = (typeof CHOIX_RENDEZ_VOUS)[number];

/** Nom du paramètre d'URL qui porte le choix (`/appel?rdv=…`). */
export const PARAM_RDV = "rdv";
/** Nom du paramètre d'URL qui porte l'emplacement du bouton (`/appel?depuis=…`). */
export const PARAM_DEPUIS = "depuis";

/** Le choix lu dans un paramètre d'URL ou un champ de formulaire ; `null` sinon. */
export function lireChoixRendezVous(valeur: unknown): ChoixRendezVous | null {
  if (typeof valeur !== "string") return null;
  const v = valeur.trim().toLowerCase();
  return (CHOIX_RENDEZ_VOUS as readonly string[]).includes(v) ? (v as ChoixRendezVous) : null;
}

/** Longueur maximale de l'emplacement : `utm_content` en tient 100. */
const DEPUIS_MAX = 60;

/**
 * L'emplacement du bouton (`?depuis=accueil-hero`), nettoyé : minuscules,
 * chiffres, tirets. Tout le reste est refusé — la valeur part chez Calendly et
 * revient dans nos colonnes, elle ne doit rien porter d'autre qu'un repère.
 */
export function lireDepuis(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const v = valeur.trim().toLowerCase();
  if (!v || v.length > DEPUIS_MAX || !/^[a-z0-9][a-z0-9-]*$/.test(v)) return null;
  return v;
}

/** Le type de rendez-vous visé par un choix. */
export function typeDuChoix(choix: ChoixRendezVous): TypeRendezVous {
  return choix === "diagnostic" ? "diagnostic" : "echange_projet";
}

/**
 * La valeur `utm_content` envoyée à Calendly : `diagnostic`, `projet`, ou
 * `diagnostic:accueil-hero` quand l'emplacement est connu. Elle mesure le
 * BOUTON cliqué, pas le type finalement réservé (le repli peut les séparer).
 */
export function utmContentDuChoix(choix: ChoixRendezVous, depuis?: string | null): string {
  const d = lireDepuis(depuis);
  return (d ? `${choix}:${d}` : choix).slice(0, 100);
}

/**
 * Les paramètres de SUIVI d'arrivée que la page `/appel` lit dans son URL (les
 * quatre déjà lus sur main). `utm_content` n'en fait PAS partie : sur ce
 * parcours, il mesure le bouton cliqué (`utmContentDuChoix`).
 */
export const PARAMS_SUIVI = ["utm_source", "utm_medium", "utm_campaign", "ref"] as const;
export type ParamSuivi = (typeof PARAMS_SUIVI)[number];
export type SuiviArrivee = Partial<Record<ParamSuivi, string>>;

/** Même borne et même nettoyage que `parseUtmFromUrl` (`src/lib/utm.ts`). */
const SUIVI_MAX = 200;

/**
 * Les paramètres de suivi d'arrivée (`?utm_source=linkedin…`), bornés et
 * nettoyés. Sans eux, un visiteur arrivé d'une campagne perdait son attribution
 * au premier clic du parcours (chantier « Types de rendez-vous », L5a).
 */
export function lireSuiviArrivee(source: Readonly<Record<string, unknown>>): SuiviArrivee {
  const out: SuiviArrivee = {};
  for (const cle of PARAMS_SUIVI) {
    const v = source[cle];
    if (typeof v !== "string" || v.length === 0 || v.length > SUIVI_MAX) continue;
    const propre = v.replace(/[^\w\s.\-/+]/g, "").trim();
    if (propre) out[cle] = propre;
  }
  return out;
}

function ajouterSuivi(p: URLSearchParams, suivi?: SuiviArrivee | null): void {
  if (!suivi) return;
  for (const cle of PARAMS_SUIVI) {
    const v = suivi[cle];
    if (v) p.set(cle, v);
  }
}

/**
 * `rdv=diagnostic&depuis=…&utm_source=…` — à recopier dans les liens internes
 * du parcours (cartes, formulaire, renvois de l'action).
 */
export function parametresDuChoix(
  choix: ChoixRendezVous,
  depuis?: string | null,
  suivi?: SuiviArrivee | null,
): string {
  const p = new URLSearchParams({ [PARAM_RDV]: choix });
  const d = lireDepuis(depuis);
  if (d) p.set(PARAM_DEPUIS, d);
  ajouterSuivi(p, suivi);
  return p.toString();
}

/**
 * `depuis=…&utm_source=…` SANS choix — le lien « Changer de rendez-vous », qui
 * ramène à l'écran du choix. Chaîne vide quand il n'y a rien à recopier.
 */
export function parametresDuRetour(depuis?: string | null, suivi?: SuiviArrivee | null): string {
  const p = new URLSearchParams();
  const d = lireDepuis(depuis);
  if (d) p.set(PARAM_DEPUIS, d);
  ajouterSuivi(p, suivi);
  return p.toString();
}

function urlOuDefaut(valeur: string | undefined, defaut: string): string {
  const v = valeur?.trim();
  return v ? v : defaut;
}

/** URL du type appel (« Échange projet »), configurée ou par défaut. */
export function urlCalendlyAppel(): string {
  return urlOuDefaut(process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL, URL_CALENDLY_APPEL_PAR_DEFAUT);
}

/** URL du type « Diagnostic IA », configurée ou par défaut. */
export function urlCalendlyDiagnostic(): string {
  return urlOuDefaut(
    process.env.NEXT_PUBLIC_CALENDLY_DIAGNOSTIC_URL,
    URL_CALENDLY_DIAGNOSTIC_PAR_DEFAUT,
  );
}

/** L'URL configurée d'un choix, SANS vérification chez Calendly. */
export function urlConfigureeDuChoix(choix: ChoixRendezVous): string {
  return choix === "diagnostic" ? urlCalendlyDiagnostic() : urlCalendlyAppel();
}

/** Vrai au build (stubs) ou sans jeton : aucune requête ne doit partir. */
function apiInterdite(): boolean {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return true;
  if (process.env.NEXT_PHASE === "phase-production-build") return true;
  return !process.env.CALENDLY_API_TOKEN?.trim();
}

/** Ce que le compte Calendly dit d'une URL de réservation. */
interface TypeLu {
  readonly uri: string;
  readonly url: string;
  readonly dureeMinutes?: number;
}

/**
 * La liste des types actifs, indexée par chemin canonique. `null` quand elle
 * est illisible (build, jeton absent, API en échec) — jamais d'exception.
 */
async function typesParChemin(): Promise<ReadonlyMap<string, TypeLu> | null> {
  if (apiInterdite()) return null;
  try {
    const liste = await listerTypesEvenementCalendly();
    if (!liste || "failure" in liste) return null;
    const table = new Map<string, TypeLu>();
    for (const et of liste.types) {
      const uri = uriDeTypeValide(et["uri"]);
      const sched = et["scheduling_url"];
      if (!uri || typeof sched !== "string") continue;
      const chemin = canonicalPath(sched);
      if (!chemin || table.has(chemin)) continue;
      const duree = et["duration"];
      table.set(chemin, {
        uri,
        url: sched,
        ...(typeof duree === "number" && duree > 0 ? { dureeMinutes: duree } : {}),
      });
    }
    return table;
  } catch {
    return null;
  }
}

/** Ce que la page a besoin de savoir d'un choix, une fois vérifié chez Calendly. */
export interface ChoixResolu {
  /** Le choix du visiteur (celui du bouton). */
  readonly choix: ChoixRendezVous;
  /** L'URL Calendly réellement utilisée (après repli éventuel). */
  readonly url: string;
  /** Vrai si le diagnostic, introuvable, a été remplacé par le type appel. */
  readonly replie: boolean;
  /** Durée lue chez Calendly, absente si la liste est illisible. */
  readonly dureeMinutes?: number;
}

function resoudreAvec(
  choix: ChoixRendezVous,
  table: ReadonlyMap<string, TypeLu> | null,
): ChoixResolu {
  const voulue = urlConfigureeDuChoix(choix);
  if (!table) return { choix, url: voulue, replie: false };
  const trouve = table.get(canonicalPath(voulue) ?? "");
  if (trouve) {
    return {
      choix,
      url: voulue,
      replie: false,
      ...(trouve.dureeMinutes ? { dureeMinutes: trouve.dureeMinutes } : {}),
    };
  }
  if (choix === "diagnostic") {
    // Repli SILENCIEUX : le diagnostic n'existe pas (ou plus) chez Calendly.
    const appel = urlCalendlyAppel();
    const lu = table.get(canonicalPath(appel) ?? "");
    return {
      choix,
      url: appel,
      replie: true,
      ...(lu?.dureeMinutes ? { dureeMinutes: lu.dureeMinutes } : {}),
    };
  }
  return { choix, url: voulue, replie: false };
}

/** L'URL Calendly d'un choix, avec le repli du diagnostic. Ne lève jamais. */
export async function resoudreChoix(choix: ChoixRendezVous): Promise<ChoixResolu> {
  return resoudreAvec(choix, await typesParChemin());
}

/** Les deux choix résolus d'un coup (une seule lecture de la liste, en cache). */
export async function resoudreLesDeuxChoix(): Promise<
  Readonly<Record<ChoixRendezVous, ChoixResolu>>
> {
  const table = await typesParChemin();
  return { diagnostic: resoudreAvec("diagnostic", table), projet: resoudreAvec("projet", table) };
}

/** Ce qu'il faut savoir d'un rendez-vous existant pour le reprogrammer. */
export interface RendezVousAReprogrammer {
  readonly eventTypeUri?: string | null;
  readonly typeRendezVous?: string | null;
  readonly eventTypeName?: string | null;
}

/**
 * L'URL de réservation sur laquelle REPROGRAMMER un rendez-vous existant : son
 * type d'ORIGINE, jamais le type appel par défaut.
 *
 * 1. L'URI du type stockée, retrouvée dans la liste des types actifs ;
 * 2. sinon le type stocké (repli : le nom) — diagnostic (avec son propre repli),
 *    apporteur, ou à défaut le type appel.
 */
export async function urlDeReprogrammation(rdv: RendezVousAReprogrammer): Promise<string> {
  const table = await typesParChemin();
  const uri = uriDeTypeValide(rdv.eventTypeUri);
  if (uri && table) {
    for (const t of table.values()) {
      if (t.uri === uri) return t.url;
    }
  }
  const type: TypeRendezVous = estTypeRendezVous(rdv.typeRendezVous)
    ? rdv.typeRendezVous
    : classerParNom(rdv.eventTypeName);
  if (type === "diagnostic") return resoudreAvec("diagnostic", table).url;
  if (type === "apporteur") {
    return urlOuDefaut(process.env.CALENDLY_APPORTEUR_URL, URL_CALENDLY_APPORTEUR_PAR_DEFAUT);
  }
  return urlCalendlyAppel();
}

/** Le choix public correspondant à un type stocké (`null` hors des deux choix). */
export function choixDuType(type: unknown): ChoixRendezVous | null {
  if (type === "diagnostic") return "diagnostic";
  if (type === "echange_projet") return "projet";
  return null;
}

/**
 * Les paramètres d'arrivée que CALENDLY sait garder (dans `tracking` de
 * l'invité, relu par le sondage). `ref` n'en fait pas partie : Calendly ne le
 * reprend pas, il reste porté par nos propres URL et par la capture de la page.
 */
export const PARAMS_SUIVI_CALENDLY = ["utm_source", "utm_medium", "utm_campaign"] as const;

/**
 * Ajoute `utm_content` (le BOUTON) et, s'il y en a, les UTM d'ARRIVÉE (L5a) à
 * une URL Calendly : iframe, lien de secours, créneau. Sans l'arrivée, une
 * réservation prise chez Calendly ne gardait que le bouton.
 */
export function avecUtmContent(
  url: string,
  utmContent: string | null | undefined,
  suivi?: SuiviArrivee | null,
): string {
  const arrivee = PARAMS_SUIVI_CALENDLY.filter((cle) => suivi?.[cle]);
  if (!utmContent && arrivee.length === 0) return url;
  try {
    const u = new URL(url);
    if (utmContent) u.searchParams.set("utm_content", utmContent);
    for (const cle of arrivee) u.searchParams.set(cle, suivi?.[cle] ?? "");
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * La provenance d'une réservation directe, prise comme un BLOC : si l'URL
 * d'arrivée porte au moins une UTM, tout le bloc d'arrivée ; sinon tout le bloc
 * du cookie. Jamais un mélange champ par champ de deux provenances.
 */
export function provenanceEnBloc(
  arrivee: SuiviArrivee,
  cookie: Readonly<Partial<Record<"utm_source" | "utm_medium" | "utm_campaign", string>>>,
): { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null } {
  const bloc = PARAMS_SUIVI_CALENDLY.some((cle) => arrivee[cle]) ? arrivee : cookie;
  return {
    utmSource: bloc.utm_source ?? null,
    utmMedium: bloc.utm_medium ?? null,
    utmCampaign: bloc.utm_campaign ?? null,
  };
}
