/**
 * Carte des mots-clés (S5) : UNE page principale par recherche.
 *
 * Module PUR (aucun accès base, aucun réseau, aucun interrupteur à lire) : il reçoit les lignes
 * « requête × page » déjà agrégées sur 28 jours (`LigneRequete`, fournies par P3) et, en option,
 * les choix du plan éditorial. Il rend, pour chaque recherche, la page principale et les pages
 * qui la concurrencent.
 *
 * Il ne change AUCUNE URL et ne touche à aucun texte public : la seule suite proposée à une page
 * concurrente est un lien interne vers la page principale, avec un signalement « fusion à étudier »
 * qu'un humain tranche (règle 5 du plan). Une page protégée est marquée telle quelle.
 */
import { detecterInterdits } from "@/lib/contenu/interdits-publication";
import { evaluerSujetCible } from "@/server/content-gen/sujet-cible";
import { normaliserRequete, normaliserUrl } from "@/server/content-gen/strategie/carte-requetes";
import { SEUILS, TYPES_ATTENDUS } from "../opportunites/detecteurs";
import { estCheminProtege } from "../opportunites/garde-fous";
import { classerIntention, estRequeteMarque, type Intention } from "../opportunites/intention";
import type { LigneRequete } from "../opportunites/types";

export interface EntreePlan {
  readonly requete: string;
  readonly url: string;
}

export interface OptionsCarteMotsCles {
  /** Choix du plan éditorial : la page désignée est propriétaire, quoi qu'en dise la mesure. */
  readonly plan?: readonly EntreePlan[];
  readonly villes?: ReadonlySet<string>;
}

export type StatutMotCle = "unique" | "concurrence" | "trop_peu_de_donnees";
export type RaisonProprietaire = "plan" | "mesure";

export interface PageConcurrente {
  readonly url: string;
  readonly impressions: number;
  /** Part des impressions de la recherche, 0 à 1. */
  readonly part: number;
}

export interface EntreeMotCle {
  /** Clé normalisée (mots triés, sans accents ni mots vides). */
  readonly cle: string;
  /** Formulation la plus vue, telle que tapée. */
  readonly exemple: string;
  readonly intention: Intention;
  readonly proprietaire: string;
  readonly raison: RaisonProprietaire;
  readonly statut: StatutMotCle;
  /** Aucune page significative n'a le type attendu par l'intention : à examiner, sans changer de propriétaire. */
  readonly typeAttenduAbsent: boolean;
  readonly impressions: number;
  readonly concurrentes: readonly PageConcurrente[];
}

export interface Rapprochement {
  readonly requete: string;
  readonly proprietaire: string;
  readonly concurrente: string;
  /**
   * Un lien interne vers la page principale ; « signalement_seul » si la page concurrente est
   * protégée (aucune action sans Will). Jamais de changement d'URL.
   */
  readonly action: "lien_interne" | "signalement_seul";
  /** Décision humaine : fusion à étudier. */
  readonly fusionAEtudier: true;
  /** La page concurrente est protégée : aucune modification sans Will. */
  readonly protegee: boolean;
}

export interface SortieCarteMotsCles {
  readonly entrees: readonly EntreeMotCle[];
  readonly rapprochements: readonly Rapprochement[];
}

interface PageAgregee {
  url: string;
  impressions: number;
  positionPonderee: number;
  typePage: LigneRequete["typePage"];
  /** Impressions de la ligne qui a donné `typePage` (le type le plus vu l'emporte, ex. aequo : ordre alphabétique). */
  impressionsType: number;
}

function ecartee(requete: string, url: string): boolean {
  const sansAccent = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (/grenoble/i.test(sansAccent(requete)) || /grenoble/i.test(sansAccent(url))) return true;
  if (estRequeteMarque(requete)) return true;
  if (detecterInterdits(requete, { actualite: false, financementPublicAutorise: false }).length > 0)
    return true;
  const v = evaluerSujetCible(requete);
  return !v.accepte && v.raison === "grenoble";
}

function position(p: PageAgregee): number {
  return p.impressions > 0 ? p.positionPonderee / p.impressions : Number.POSITIVE_INFINITY;
}

function comparer(a: PageAgregee, b: PageAgregee): number {
  return b.impressions - a.impressions || position(a) - position(b) || a.url.localeCompare(b.url);
}

export function construireCarteMotsCles(
  lignes: readonly LigneRequete[],
  options: OptionsCarteMotsCles = {},
): SortieCarteMotsCles {
  const plan = new Map<string, string>();
  for (const e of options.plan ?? []) {
    const cle = normaliserRequete(e.requete);
    const url = normaliserUrl(e.url);
    if (!cle || !url || ecartee(e.requete, url)) continue;
    // Deux entrées de même clé : l'URL la plus petite gagne, quel que soit l'ordre d'entrée.
    const deja = plan.get(cle);
    if (deja === undefined || url < deja) plan.set(cle, url);
  }

  const parCle = new Map<
    string,
    { formes: Map<string, number>; pages: Map<string, PageAgregee> }
  >();
  for (const ligne of lignes) {
    if (!Number.isFinite(ligne.impressions) || ligne.impressions < 0) continue;
    const cle = normaliserRequete(ligne.requete);
    const url = normaliserUrl(ligne.url);
    if (!cle || !url || ecartee(ligne.requete, url)) continue;
    const groupe = parCle.get(cle) ?? { formes: new Map(), pages: new Map() };
    const forme = ligne.requete.trim();
    groupe.formes.set(forme, (groupe.formes.get(forme) ?? 0) + ligne.impressions);
    const page = groupe.pages.get(url) ?? {
      url,
      impressions: 0,
      positionPonderee: 0,
      typePage: ligne.typePage,
      impressionsType: -1,
    };
    if (
      ligne.impressions > page.impressionsType ||
      (ligne.impressions === page.impressionsType && ligne.typePage < page.typePage)
    ) {
      page.typePage = ligne.typePage;
      page.impressionsType = ligne.impressions;
    }
    page.impressions += ligne.impressions;
    page.positionPonderee +=
      (Number.isFinite(ligne.position) ? ligne.position : 100) * ligne.impressions;
    groupe.pages.set(url, page);
    parCle.set(cle, groupe);
  }

  const entrees: EntreeMotCle[] = [];
  const rapprochements: Rapprochement[] = [];

  for (const [cle, { formes, pages }] of parCle) {
    const exemple = [...formes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
    const { intention } = classerIntention(
      exemple,
      options.villes ? { villes: options.villes } : {},
    );
    const candidates = [...pages.values()].sort(comparer);
    const total = candidates.reduce((s, p) => s + p.impressions, 0);

    const assezDeDonnees = total >= SEUILS.cannibImpressionsMin;
    // Même règle que `construireCarte` (plan, puis meilleure position, puis impressions, puis URL),
    // appliquée aux seules pages significatives : une page à peine vue ne devient pas propriétaire.
    const significatives = candidates.filter(
      (p) => total > 0 && p.impressions / total >= SEUILS.cannibPartMin,
    );
    const pool = significatives.length > 0 ? significatives : candidates;
    const parPosition = [...pool].sort((a, b) => position(a) - position(b) || comparer(a, b))[0]!;
    const urlPlan = plan.get(cle);
    const proprietaire = urlPlan ?? parPosition.url;
    const raison: RaisonProprietaire = urlPlan ? "plan" : "mesure";
    const attendus = TYPES_ATTENDUS[intention];
    const typeAttenduAbsent =
      attendus !== undefined && !pool.some((p) => attendus.includes(p.typePage));

    // Plus large que le détecteur d (pas de plancher de semaines ni de bascules : la carte est un
    // état, pas un historique) : le détecteur d confirme avant toute action.
    // Plan en tête : une page à 0 % reste propriétaire, c'est un choix éditorial.
    const concurrentes: PageConcurrente[] = assezDeDonnees
      ? significatives
          .filter((p) => p.url !== proprietaire)
          .map((p) => ({ url: p.url, impressions: p.impressions, part: p.impressions / total }))
      : [];

    entrees.push({
      cle,
      exemple,
      intention,
      proprietaire,
      raison,
      typeAttenduAbsent,
      statut: !assezDeDonnees
        ? "trop_peu_de_donnees"
        : concurrentes.length > 0
          ? "concurrence"
          : "unique",
      impressions: total,
      concurrentes,
    });
    for (const c of concurrentes) {
      rapprochements.push({
        requete: exemple,
        proprietaire,
        concurrente: c.url,
        action: estCheminProtege(c.url) ? "signalement_seul" : "lien_interne",
        fusionAEtudier: true,
        protegee: estCheminProtege(c.url),
      });
    }
  }

  entrees.sort((a, b) => b.impressions - a.impressions || a.cle.localeCompare(b.cle));
  rapprochements.sort(
    (a, b) => a.requete.localeCompare(b.requete) || a.concurrente.localeCompare(b.concurrente),
  );
  return { entrees, rapprochements };
}
