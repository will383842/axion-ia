/**
 * T0 / Lot 0 — Le registre des surfaces admin mesurées au volume cible.
 *
 * ## Le défaut que ce registre ferme
 *
 * Une liste admin peut être ajoutée, ou réécrite, sans que personne ne sache ce
 * qu'elle coûte à 1 200 sessions. C'est déjà arrivé : la liste des sessions
 * chargeait la totalité des inscriptions pour en compter les présents (T2). Le
 * défaut n'était pas subtil ; il était simplement **jamais mesuré**, parce que
 * la base de développement contient trois sessions.
 *
 * Ce fichier est la SSOT des surfaces qui doivent avoir une mesure committée
 * dans `_AUDIT/BASELINE-VOLUMETRIQUE.json`. Deux gardes s'appuient dessus :
 *
 * - un test unitaire (`sondes-volumetriques.spec.ts`) : toute sonde déclarée ici
 *   doit avoir son entrée dans la baseline. Ajouter une surface sans la
 *   baseliner rougit **au commit**, sans base de données ;
 * - un job CI (`pnpm volumetrie:mesure`) : il exécute réellement chaque sonde
 *   contre la fixture volumétrique et refuse une mesure absente ou dégradée.
 *
 * ## Ce que le registre ne couvre PAS, et pourquoi
 *
 * Les sondes mesurent le **temps serveur d'une lecture**, pas le temps perçu.
 * Le plan (Lot 0, mesure (b)) demande en plus un Playwright bridé en 4G sur le
 * hub et les deux pages d'émargement, avec un critère exprimé en « contenu utile
 * visible et CTA cliquable ». Cette seconde mesure exige l'application lancée et
 * un environnement de préproduction : elle n'est pas remplaçable par ce qui suit,
 * et sa marque dans la baseline reste `null` tant qu'elle n'a pas été faite.
 * 🔴 Ne pas confondre les deux : une requête à 40 ms sur une page qui met 6 s à
 * devenir cliquable reste une page inutilisable.
 */

/** Identifiant stable d'une sonde. Il sert de clé dans la baseline committée. */
export type CleSonde =
  "sessions_liste" | "sessions_liste_archives" | "dossiers_pipeline" | "dossiers_pipeline_archives";

export interface Sonde {
  cle: CleSonde;
  /** La page de la console que cette lecture alimente. */
  page: string;
  /** Ce qu'on mesure, en une phrase — lisible dans le rapport CI. */
  intitule: string;
  /**
   * Budget en millisecondes au volume cible. Dépassé = rouge.
   *
   * ⚠️ Ce ne sont pas des seuils devinés : ils viennent des budgets Web Vitals
   * du dépôt (LCP ≤ 1 800 ms p75). Une lecture serveur qui consomme à elle seule
   * plus du quart du budget de la page ne laisse rien au rendu ni au réseau.
   */
  budgetMs: number;
}

/**
 * 🔴 Ajouter une entrée ici SANS ajouter sa mesure dans
 * `_AUDIT/BASELINE-VOLUMETRIQUE.json` fait rougir la suite. C'est l'effet
 * recherché : le plan T0 exige qu'aucune liste admin ne parte sans baseline.
 */
export const SONDES: readonly Sonde[] = [
  {
    cle: "sessions_liste",
    page: "/[adminPrefix]/qualiopi/sessions",
    intitule: "Liste des sessions, page 1, fenêtre 12 mois",
    budgetMs: 450,
  },
  {
    cle: "sessions_liste_archives",
    page: "/[adminPrefix]/qualiopi/sessions?archives=1",
    intitule: "Liste des sessions, mode archives (sans borne de date)",
    budgetMs: 700,
  },
  {
    cle: "dossiers_pipeline",
    page: "/[adminPrefix]/qualiopi/dossiers",
    intitule: "Pipeline des dossiers, 7 colonnes dérivées",
    budgetMs: 600,
  },
  {
    cle: "dossiers_pipeline_archives",
    page: "/[adminPrefix]/qualiopi/dossiers?archives=1",
    intitule: "Pipeline des dossiers, mode archives",
    budgetMs: 900,
  },
] as const;

export function sondeParCle(cle: string): Sonde | undefined {
  return SONDES.find((s) => s.cle === cle);
}
