/**
 * Veille « indexation stagnante » (P18, chantier pilotage SEO/GEO).
 *
 * Pourquoi l'ancienne alerte ne marchait pas (coupée le 2026-07-11) :
 *  1. elle passait au message des impressions et un CTR CODÉS EN DUR à 0 (« CTR 0,00 % sur
 *     0 impression ») : aucun chiffre réel, donc rien d'actionnable ;
 *  2. son critère (« aucune ligne KeywordTracking ») ne regardait pas la Search Console ;
 *  3. elle tournait toutes les heures sans anti-répétition : même article, même message,
 *     chaque heure.
 *
 * Ici : les chiffres viennent de `GscPageJour` (fenêtre de 28 j), une réservation Redis de
 * 30 jours par slug empêche toute seconde alerte, et une source indisponible (table absente,
 * robot éteint ou trop récent) ne produit AUCUNE alerte : `null` n'est pas 0.
 *
 * Module sans accès direct à la base ni à Redis : tout passe par `DepsIndexationStagnante`.
 */
import { buildArticlePath } from "@/server/content-gen/indexing/url-builder";
import { normaliserChemin } from "@/server/seo-pilotage/donnees/chemins";

/** Âge minimal (jours) d'un article tier-1 avant qu'on lui demande d'exister dans Google. */
export const AGE_MIN_JOURS = 30;
/** Fenêtre de mesure Search Console (jours). */
export const FENETRE_JOURS = 28;
/**
 * Jours distincts à couvrir dans la fenêtre pour que la source soit jugée exploitable. Les seuils
 * d'impressions sont calibrés sur 28 jours : une fenêtre partielle fabriquerait de fausses
 * alertes (retard Search Console de 2 à 3 jours compris).
 */
export const JOURS_COUVERTS_MIN = 24;
/** Sous ce nombre d'impressions sur la fenêtre, la page est jugée non indexée. */
export const IMPRESSIONS_MIN = 10;
/** Au-delà de ce nombre d'impressions, un CTR sous le seuil est jugé stagnant. */
export const IMPRESSIONS_CTR_MIN = 100;
/** Seuil de CTR (%). */
export const CTR_MIN_PCT = 1;
/** Plafond d'alertes par passage. */
export const MAX_ALERTES = 5;
/** Durée de l'anti-répétition par slug. */
export const ANTI_REPETITION_SECONDES = 30 * 86_400;

export interface ArticleCandidat {
  slug: string;
  isNews: boolean;
  templateVariant: string | null;
  publishedAt: Date;
}

export interface MesurePage {
  impressions: number;
  clics: number;
}

export interface DepsIndexationStagnante {
  maintenant: () => Date;
  /** Articles tier-1 publiés depuis au moins `AGE_MIN_JOURS` (le plus ancien d'abord). */
  lireArticles: (publieAvant: Date) => Promise<ArticleCandidat[]>;
  /** Nombre de jours distincts ayant des lignes dans `GscPageJour` depuis `depuis`. */
  lireJoursCouverts: (depuis: Date) => Promise<number>;
  /** Cumul clics/impressions par chemin normalisé depuis `depuis`. */
  lireMesures: (chemins: string[], depuis: Date) => Promise<Map<string, MesurePage>>;
  /** Réserve le slug pour 30 j ; `false` si déjà réservé. Lève si Redis est indisponible. */
  reserverAlerte: (slug: string) => Promise<boolean>;
  alerter: (slug: string, ctrPct: number, ageJours: number, impressions: number) => Promise<void>;
  /** Source trop peu fournie : silence voulu, mais journalisé pour ne pas passer inaperçu. */
  signalerSourceInsuffisante?: (joursCouverts: number) => void;
}

const JOUR_MS = 86_400_000;

export function estStagnante(m: MesurePage): boolean {
  if (m.impressions < IMPRESSIONS_MIN) return true;
  if (m.impressions >= IMPRESSIONS_CTR_MIN) return (m.clics / m.impressions) * 100 < CTR_MIN_PCT;
  return false;
}

export async function detecterIndexationStagnante(deps: DepsIndexationStagnante): Promise<void> {
  const maintenant = deps.maintenant();
  // `date` est un jour calendaire (minuit UTC) : on tronque pour couvrir exactement 28 jours.
  const depuis = new Date(maintenant.getTime() - FENETRE_JOURS * JOUR_MS);
  depuis.setUTCHours(0, 0, 0, 0);

  // 1. Source exploitable ? Sinon silence Telegram (jamais de zéros fabriqués). Une lecture en
  // échec REMONTE (journal + Sentry par processJob) : une veille muette ne doit pas être invisible.
  const joursCouverts = await deps.lireJoursCouverts(depuis);
  if (joursCouverts < JOURS_COUVERTS_MIN) {
    deps.signalerSourceInsuffisante?.(joursCouverts);
    return;
  }

  // 2. Candidats et leurs chemins.
  const publieAvant = new Date(maintenant.getTime() - AGE_MIN_JOURS * JOUR_MS);
  const parChemin = new Map<string, ArticleCandidat>();
  for (const a of await deps.lireArticles(publieAvant)) {
    if (a.publishedAt > publieAvant) continue; // garde-fou : jamais d'article trop récent
    const chemin = normaliserChemin(
      buildArticlePath({ slug: a.slug, isNews: a.isNews, templateVariant: a.templateVariant }),
    );
    if (chemin) parChemin.set(chemin, a);
  }
  if (parChemin.size === 0) return;
  const mesures = await deps.lireMesures([...parChemin.keys()], depuis);

  // 3. Alertes, plafonnées, avec réservation de 30 j avant l'envoi.
  let envoyees = 0;
  for (const [chemin, a] of parChemin) {
    if (envoyees >= MAX_ALERTES) break;
    const m = mesures.get(chemin) ?? { impressions: 0, clics: 0 };
    if (!estStagnante(m)) continue;
    // Anti-répétition impossible (Redis en panne) : la lève remonte, aucune alerte n'est envoyée.
    // La réservation précède l'envoi : si Telegram échoue, l'article n'est pas re-signalé avant
    // 30 jours (choix assumé : mieux vaut manquer une info que répéter).
    if (!(await deps.reserverAlerte(a.slug))) continue;
    const ctrPct = m.impressions > 0 ? Math.round((m.clics / m.impressions) * 10_000) / 100 : 0;
    const age = Math.floor((maintenant.getTime() - a.publishedAt.getTime()) / JOUR_MS);
    await deps.alerter(a.slug, ctrPct, age, m.impressions);
    envoyees += 1;
  }
}
