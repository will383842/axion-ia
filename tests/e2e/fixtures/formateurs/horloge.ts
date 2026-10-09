// Banc @formateurs — l'HORLOGE PILOTÉE.
//
// ⛔ Aucune horloge truquée dans le serveur, aucune route de test. Les passages
// planifiés du dépôt reçoivent déjà leur instant en paramètre
// (`discoverNewCalendlyEvents(nowMs)`, `coupeCircuitDeclenche(maintenant)`,
// `rechercherSiren(…, { maintenant })`…) : le banc les appelle EN DIRECT avec
// l'instant qu'il choisit. Ce module ne fait que tenir cet instant et l'avancer.

export interface HorlogePilotee {
  /** L'instant courant du banc. */
  maintenant(): Date;
  /** Le même, en ISO 8601 — la forme qui traverse vers l'exécuteur `tsx`. */
  iso(): string;
  /** Avance l'horloge ; rend le nouvel instant. */
  avancer(duree: { jours?: number; heures?: number; minutes?: number }): Date;
}

export function horlogePilotee(depart: Date | string): HorlogePilotee {
  let ms = new Date(depart).getTime();
  if (Number.isNaN(ms))
    throw new Error(`horloge du banc : instant de départ illisible (${String(depart)})`);
  return {
    maintenant: () => new Date(ms),
    iso: () => new Date(ms).toISOString(),
    avancer({ jours = 0, heures = 0, minutes = 0 }) {
      ms += ((jours * 24 + heures) * 60 + minutes) * 60_000;
      return new Date(ms);
    },
  };
}
