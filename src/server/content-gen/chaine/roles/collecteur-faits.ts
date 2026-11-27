/**
 * R3 · Collecteur de faits sourcés et datés (conception § 3, PR C5). Modèle : Sonnet + web.
 *
 * Répond aux questions factuelles du brief avec des sources primaires DATÉES. Le modèle propose,
 * le CODE décide : chaque fait est refusé s'il n'a pas
 *  - une URL réellement lue par l'outil (liste `sources` de la réponse) ;
 *  - un extrait EXACT retrouvé dans le texte de la page lue (aucun fait sans extrait) ;
 *  - une date de publication ; une source de moins de 3 ans (sauf texte de référence) ;
 *  - une confiance haute ou moyenne (en cas de doute, écarté) ;
 *  - une valeur chiffrée présente telle quelle dans l'extrait.
 * Dossier valide : au moins 3 sources distinctes et, sur un sujet d'IA ou de réglementation,
 * au moins une de moins de 18 mois (B09 de la porte). Sinon verdict `dossier_insuffisant`.
 *
 * Module sans entrée-sortie : l'appel au modèle est injecté. Aucune écriture en base ici : le
 * dossier sort en lignes prêtes pour `ContenuFait` (statut « propose »). Une valeur n'entre dans
 * `CHIFFRES_VERIFIES` qu'après relecture humaine (statut « verifie »).
 */

import { z } from "zod";
import {
  CONSIGNE_DONNEES,
  appelerRole,
  encadrerDonnees,
  lireJson,
  type AppelModele,
  type CompteurCout,
} from "./commun";
import type { ChiffreVerifie } from "../../kb/chiffres-verifies";
import { nombresDe } from "./nombres";

/** Seuls ces domaines peuvent porter un « texte de référence » exempté de la règle des 3 ans. */
export const DOMAINES_TEXTE_REFERENCE = [
  "legifrance.gouv.fr",
  "eur-lex.europa.eu",
  "journal-officiel.gouv.fr",
  "service-public.fr",
];

/** Plafond de recherches de la phase de collecte (relevé de 4 à 8, conception § 3 R3). */
export const PLAFOND_RECHERCHES_COLLECTE = 8;
export const MAX_LECTURES_COLLECTE = 10;
export const SOURCES_DISTINCTES_MIN = 3;
export const AGE_MAX_SOURCE_MOIS = 36;
export const AGE_MAX_SOURCE_SENSIBLE_MOIS = 18;
const EXTRAIT_MIN_CARACTERES = 15;
const MAX_FAITS = 30;

export const RAISONS_ECART_FAIT = [
  "url_non_lue",
  "extrait_introuvable",
  "extrait_trop_court",
  "date_absente",
  "date_invalide",
  "source_trop_ancienne",
  "confiance_basse",
  "valeur_absente_de_l_extrait",
  "enonce_hors_extrait",
  "date_future",
  "annee_absente_de_la_page",
  "reference_non_admise",
] as const;
export type RaisonEcartFait = (typeof RAISONS_ECART_FAIT)[number];

const faitBrutSchema = z
  .object({
    enonce: z.string().trim().min(1).max(1000),
    valeur: z.string().trim().min(1).max(100).nullish(),
    extrait: z.string().trim().min(1),
    url: z.string().trim().min(1).max(1000),
    editeur: z.string().trim().min(1).max(200).nullish(),
    datePublication: z.string().trim().nullish(),
    confiance: z.enum(["haute", "moyenne", "basse"]),
    texteReference: z.boolean().optional(),
  })
  .strict();

const sortieSchema = z.object({ faits: z.array(faitBrutSchema).max(MAX_FAITS) }).strict();

export interface FaitSource {
  readonly enonce: string;
  readonly valeur: string | null;
  readonly extrait: string;
  readonly url: string;
  readonly editeur: string | null;
  /** Date de publication de la source (AAAA-MM-JJ). */
  readonly datePublication: string;
  readonly confiance: "haute" | "moyenne";
  readonly texteReference: boolean;
}

export interface EntreeCollecte {
  readonly sujet: string;
  readonly questionsFactuelles: ReadonlyArray<string>;
  /** Sujet d'IA ou de réglementation : exige une source de moins de 18 mois. */
  readonly sujetSensible: boolean;
  readonly maintenant: Date;
}

export interface ResultatCollecte {
  readonly verdict: "dossier_complet" | "dossier_insuffisant";
  readonly faits: ReadonlyArray<FaitSource>;
  readonly ecartes: ReadonlyArray<{ readonly enonce: string; readonly raison: RaisonEcartFait }>;
  /** Raison en français simple quand le dossier est insuffisant. */
  readonly raison: string | null;
}

const SYSTEM = [
  "Tu es le collecteur de faits d'une équipe éditoriale pour dirigeants de PME et de TPE.",
  "Tu réponds aux questions factuelles avec des sources PRIMAIRES : statistiques publiques, textes officiels, études, documentation d'éditeurs. Cherche avec web_search, lis avec web_fetch.",
  "Pour chaque fait, donne : enonce (une phrase), valeur (le chiffre tel qu'écrit, sinon null), extrait (copie EXACTE, mot pour mot, d'une phrase de la page lue), url (la page lue), editeur, datePublication (AAAA-MM-JJ, date de la source), confiance (haute, moyenne ou basse), texteReference (true seulement pour un texte de loi ou une norme de référence).",
  "Aucun fait sans extrait exact. En cas de doute, n'écris pas le fait. Jamais de résultat chiffré attribué à Axion-IA.",
  CONSIGNE_DONNEES,
  'Réponds uniquement par un objet JSON : {"faits":[...]}.',
].join("\n");

function construireUser(e: EntreeCollecte): string {
  const questions = e.questionsFactuelles.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return [
    encadrerDonnees("sujet", e.sujet),
    encadrerDonnees("questions", questions),
    `Date du jour : ${e.maintenant.toISOString().slice(0, 10)}.`,
    e.sujetSensible
      ? "Sujet d'IA ou de réglementation : privilégie les sources de moins de 18 mois."
      : "Privilégie les sources de moins de 3 ans.",
  ].join("\n\n");
}

const normaliser = (s: string) =>
  s
    .replace(/[\s  ]+/g, " ")
    .trim()
    .toLowerCase();

function ageEnMois(date: Date, maintenant: Date): number {
  return (
    (maintenant.getUTCFullYear() - date.getUTCFullYear()) * 12 +
    (maintenant.getUTCMonth() - date.getUTCMonth())
  );
}

function hoteDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function collecterFaits(
  entree: EntreeCollecte,
  appel: AppelModele,
  compteur: CompteurCout,
): Promise<ResultatCollecte> {
  const reponse = await appelerRole(appel, compteur, "collecteur", {
    system: SYSTEM,
    user: construireUser(entree),
    maxTokens: 6000,
    outils: ["web_search", "web_fetch"],
    maxRecherches: PLAFOND_RECHERCHES_COLLECTE,
    maxLectures: MAX_LECTURES_COLLECTE,
  });

  const lu = lireJson(reponse.texte, sortieSchema);
  if (!lu.ok) {
    return {
      verdict: "dossier_insuffisant",
      faits: [],
      ecartes: [],
      raison: `Réponse du collecteur illisible (${lu.raison})`,
    };
  }

  const pagesLues = new Map((reponse.sources ?? []).map((s) => [s.url, s.texte ?? ""]));
  const faits: FaitSource[] = [];
  const ecartes: Array<{ enonce: string; raison: RaisonEcartFait }> = [];

  for (const brut of lu.valeur.faits) {
    const raison = motifDEcart(brut, pagesLues, entree.maintenant);
    if (raison) {
      ecartes.push({ enonce: brut.enonce, raison });
      continue;
    }
    faits.push({
      enonce: brut.enonce,
      valeur: brut.valeur ?? null,
      extrait: brut.extrait,
      url: brut.url,
      editeur: brut.editeur ?? null,
      datePublication: brut.datePublication as string,
      confiance: brut.confiance as "haute" | "moyenne",
      texteReference: brut.texteReference === true,
    });
  }

  const raisonDossier = verifierDossier(faits, entree);
  return {
    verdict: raisonDossier ? "dossier_insuffisant" : "dossier_complet",
    faits,
    ecartes,
    raison: raisonDossier,
  };
}

function motifDEcart(
  f: z.infer<typeof faitBrutSchema>,
  pagesLues: ReadonlyMap<string, string>,
  maintenant: Date,
): RaisonEcartFait | null {
  if (!pagesLues.has(f.url)) return "url_non_lue";
  if (f.extrait.length < EXTRAIT_MIN_CARACTERES) return "extrait_trop_court";
  const page = normaliser(pagesLues.get(f.url) ?? "");
  const extrait = normaliser(f.extrait);
  if (!page.includes(extrait)) return "extrait_introuvable";
  if (f.confiance === "basse") return "confiance_basse";
  if (!f.datePublication) return "date_absente";
  const date = new Date(f.datePublication);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.datePublication) || Number.isNaN(date.getTime())) {
    return "date_invalide";
  }
  if (date.getTime() > maintenant.getTime()) return "date_future";
  if (
    f.texteReference === true &&
    !DOMAINES_TEXTE_REFERENCE.some((d) => hoteDe(f.url).endsWith(d))
  ) {
    return "reference_non_admise";
  }
  if (f.texteReference !== true && ageEnMois(date, maintenant) > AGE_MAX_SOURCE_MOIS) {
    return "source_trop_ancienne";
  }
  // La page lue doit porter l'année de publication annoncée (date contrôlée, pas seulement formée).
  if (f.texteReference !== true && !page.includes(f.datePublication.slice(0, 4))) {
    return "annee_absente_de_la_page";
  }
  if (f.valeur && !extrait.includes(normaliser(f.valeur))) return "valeur_absente_de_l_extrait";
  // Un chiffre de l'énoncé doit figurer dans l'extrait exact (l'énoncé est écrit par le modèle).
  const dansExtrait = new Set(nombresDe(f.extrait).map((n) => n.cle));
  if (nombresDe(f.enonce).some((n) => n.notable && !n.annee && !dansExtrait.has(n.cle))) {
    return "enonce_hors_extrait";
  }
  return null;
}

function verifierDossier(faits: ReadonlyArray<FaitSource>, e: EntreeCollecte): string | null {
  const hotes = new Set(faits.map((f) => hoteDe(f.url)));
  if (hotes.size < SOURCES_DISTINCTES_MIN) {
    return `Pas assez de faits sourcés pour ce sujet : ${hotes.size} source(s) distincte(s), ${SOURCES_DISTINCTES_MIN} sources distinctes exigées.`;
  }
  if (e.sujetSensible) {
    const recente = faits.some(
      (f) => ageEnMois(new Date(f.datePublication), e.maintenant) <= AGE_MAX_SOURCE_SENSIBLE_MOIS,
    );
    if (!recente) {
      return `Aucune source de moins de ${AGE_MAX_SOURCE_SENSIBLE_MOIS} mois pour un sujet d'IA ou de réglementation.`;
    }
  }
  return null;
}

// ── Sortie vers la base (lignes préparées, aucune écriture ici) ─────────────

export interface LigneContenuFait {
  readonly briefId: string | null;
  readonly enonce: string;
  readonly extrait: string;
  readonly url: string;
  readonly editeur: string | null;
  readonly datePublication: Date;
  readonly dateLecture: Date;
  readonly confiance: "haute" | "moyenne";
  readonly valeur: string | null;
  readonly statut: "propose";
}

/** Lignes prêtes pour `ContenuFait` : toujours « propose » (« verifie » = relecture humaine). */
export function lignesContenuFait(
  faits: ReadonlyArray<FaitSource>,
  briefId: string | null,
  lueLe: Date,
): LigneContenuFait[] {
  return faits.map((f) => ({
    briefId,
    enonce: f.enonce,
    extrait: f.extrait,
    url: f.url,
    editeur: f.editeur,
    datePublication: new Date(f.datePublication),
    dateLecture: lueLe,
    confiance: f.confiance,
    valeur: f.valeur,
    statut: "propose" as const,
  }));
}

export interface FaitRelu {
  readonly enonce: string;
  readonly valeur: string | null;
  readonly url: string;
  readonly editeur: string | null;
  readonly statut: string;
  readonly verifieLe: Date | null;
}

/**
 * Alimentation GOUVERNÉE de `CHIFFRES_VERIFIES` : seuls les faits « verifie » (relus par un
 * humain) qui portent une valeur et une date de vérification deviennent un chiffre citable.
 */
export function chiffresVerifiesDepuisFaits(faits: ReadonlyArray<FaitRelu>): ChiffreVerifie[] {
  const sortie: ChiffreVerifie[] = [];
  for (const f of faits) {
    if (f.statut !== "verifie" || !f.valeur || !f.verifieLe || !f.editeur) continue;
    sortie.push({
      valeur: f.valeur,
      libelle: f.enonce,
      source: f.editeur,
      url: f.url,
      date: f.verifieLe.toISOString().slice(0, 10),
    });
  }
  return sortie;
}
