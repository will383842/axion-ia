// Ancienneté en toutes lettres — refonte UI 2026-08-01 (couche 4).
//
// Deux écrans en avaient besoin (le tableau de bord et « À traiter ») et le
// premier s'était écrit sa propre version, privée. Une seule implémentation :
// deux formulations différentes pour la même durée, sur deux pages voisines,
// se remarquent.
//
// Sur « À traiter », l'ancienneté n'est pas décorative : une signature qui
// attend depuis 14 jours n'appelle pas la même réaction qu'une signature posée
// ce matin, et c'est l'information qui manquait le plus à cette page.

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

/** Date absolue, pour les événements anciens où « il y a 137 j » ne parle plus. */
function dateAbsolue(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * « à l'instant » · « il y a 12 min » · « il y a 3 h » · « il y a 5 j »
 * puis la date absolue au-delà d'un mois.
 *
 * `maintenant` est injectable pour que les tests ne dépendent pas de l'horloge.
 */
export function depuisMaintenant(
  d: Date | null | undefined,
  maintenant: number = Date.now(),
): string {
  if (!d) return "—";
  const ecart = maintenant - d.getTime();

  // Une date future (horloge décalée, saisie à venir) ne doit pas produire
  // « il y a -3 j ».
  if (ecart < 0) return dateAbsolue(d);

  // Seuils explicites + troncature. Avec un arrondi, 30 secondes donnaient
  // « il y a 1 min » alors que la minute n'est pas écoulée, et 23 h 40
  // donnaient « il y a 24 h » — une unité qu'on n'affiche jamais.
  if (ecart < MINUTE) return "à l'instant";
  if (ecart < HEURE) return `il y a ${Math.floor(ecart / MINUTE)} min`;
  if (ecart < JOUR) return `il y a ${Math.floor(ecart / HEURE)} h`;

  const jours = Math.floor(ecart / JOUR);
  if (jours < 30) return `il y a ${jours} j`;

  return dateAbsolue(d);
}

/**
 * Nombre de jours entiers écoulés — sert à décider si une attente devient
 * préoccupante, indépendamment de la formulation affichée.
 */
export function joursEcoules(d: Date | null | undefined, maintenant: number = Date.now()): number {
  if (!d) return 0;
  return Math.max(0, Math.floor((maintenant - d.getTime()) / JOUR));
}
