/**
 * Réseau d'apporteurs — l'interrupteur de la validation par rendez-vous (future règle du
 * contrat 2.8, cf. `regle-attribution.ts`).
 *
 * ABSENT = ÉTEINT : allumé SEULEMENT si `APPORTEURS_VALIDATION_RDV` vaut exactement "true"
 * (« TRUE », « 1 », « true » entouré d'espaces : éteint). Lu à CHAQUE appel, jamais figé à
 * l'import : le site et le worker suivent la valeur de leur propre conteneur.
 *
 * ⚠️ Côté SERVEUR seulement (site et worker). Le fichier n'a pas `server-only`, pour rester lisible
 * par le worker : importé par un composant client, il rendrait toujours `false`, sans erreur (la
 * variable n'est pas `NEXT_PUBLIC_`).
 *
 * ⛔ Fenêtre app/worker (AGENTS.md, lot S3) : le gabarit `apporteur-presentation-recue-rendez-vous`
 * est un NOUVEAU nom, et il est émis SANS `gabaritRepli`. Le repli naturel,
 * `apporteur-presentation-recue`, annoncerait l'ancienne règle (« 30 jours », confirmation par le
 * silence) : ce serait faux. N'allumer `APPORTEURS_VALIDATION_RDV` QU'UNE FOIS le worker en ligne
 * sur un commit qui contient ce gabarit ; un worker antérieur reporterait le job 9 fois puis
 * échouerait.
 */
export function validationParRendezVousActive(): boolean {
  return process.env.APPORTEURS_VALIDATION_RDV === "true";
}
