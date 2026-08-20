/**
 * Ventilation d'une présence distancielle par JOURNÉE civile — module PUR.
 *
 * ## Le défaut que ce module corrige (`DIST-01`)
 *
 * Les trois parseurs de relevé (Zoom, Teams, Meet) réduisaient chaque
 * participant à **un seul triplet** : `joinAt` = la plus ancienne connexion,
 * `leaveAt` = la plus récente déconnexion, `dureeMinutes` = la somme de tout.
 *
 * Sur un export couvrant **plusieurs journées**, cette réduction détruit
 * l'information la plus importante : QUEL JOUR la personne était là.
 *
 * En bout de chaîne, l'import ne créait donc de créneaux que pour UNE journée —
 * celle de la première connexion. Conséquence mesurée par l'audit : un stagiaire
 * venu **1 jour sur 2** ressortait à **100 %**, parce que le dénominateur ne
 * couvrait que le jour où il était présent. Il obtenait une attestation
 * complète, et l'OPCO se voyait facturer une assiduité qui n'avait pas eu lieu.
 *
 * 🔑 **Surévaluer la présence est bien plus grave que la sous-évaluer** : c'est
 * ce qu'un contrôle de service fait sanctionne.
 *
 * ## Pourquoi un module séparé
 *
 * Les trois parseurs partageaient le défaut sans partager le code. Une
 * correction recopiée trois fois aurait divergé au premier ajustement — c'est
 * exactement ce que l'audit a trouvé ailleurs, sous un commentaire disant « les
 * deux DOIVENT rester alignées ».
 *
 * Module PUR : aucun import Prisma ni Next, testable sans harnais.
 */

/** Un intervalle de connexion brut, tel qu'une ligne de CSV le porte. */
export interface IntervalleConnexion {
  readonly join: Date | null;
  readonly leave: Date | null;
  /** Minutes de connexion effectives déclarées par la plateforme. */
  readonly duree: number;
}

/** La présence d'un participant sur UNE journée civile. */
export interface PresenceJour {
  /** Date civile Europe/Paris, `YYYY-MM-DD`. */
  readonly date: string;
  readonly joinAt: Date | null;
  readonly leaveAt: Date | null;
  readonly dureeMinutes: number;
}

/**
 * Date civile Europe/Paris d'un instant.
 *
 * ⚠️ `toISOString().slice(0, 10)` rendrait la date UTC : une connexion à 00 h 30
 * heure de Paris en été appartient au 10 juin pour le stagiaire et au 9 juin
 * pour UTC. Le relevé serait daté de la veille, sur une journée que la session
 * n'a pas planifiée — donc rattaché au jour de repli, et les minutes iraient au
 * mauvais jour.
 */
function dateCivileParis(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Regroupe des intervalles de connexion par journée civile.
 *
 * Choix, et leurs raisons :
 *
 * - **La journée est celle de la CONNEXION**, avec repli sur la déconnexion.
 *   Une séance qui déborde après minuit reste attachée au jour où elle a
 *   commencé : c'est le jour que la session a planifié, et celui que le
 *   stagiaire reconnaîtra sur son attestation.
 *
 * - **Un intervalle sans aucune date est IGNORÉ, pas rattaché au premier jour.**
 *   Certains exports portent une durée sans horodatage. Lui inventer une
 *   journée gonflerait un jour au détriment d'un autre — et le total resterait
 *   juste, ce qui rendrait l'erreur invisible. On préfère perdre la ventilation
 *   d'un intervalle que la fausser : `totalOrphelin` le dit à l'appelant.
 *
 * - **Le résultat est trié par date.** Un ordre dépendant de l'ordre des lignes
 *   du CSV rendrait deux imports du même fichier non comparables.
 */
export function ventilerParJour(intervalles: readonly IntervalleConnexion[]): {
  readonly jours: PresenceJour[];
  /** Minutes d'intervalles sans horodatage, non rattachables à une journée. */
  readonly totalOrphelin: number;
} {
  const parDate = new Map<string, { joinAt: Date | null; leaveAt: Date | null; duree: number }>();
  let totalOrphelin = 0;

  for (const i of intervalles) {
    const ancre = i.join ?? i.leave;
    if (ancre === null) {
      totalOrphelin += i.duree;
      continue;
    }
    const date = dateCivileParis(ancre);
    const courant = parDate.get(date) ?? { joinAt: null, leaveAt: null, duree: 0 };
    if (i.join !== null && (courant.joinAt === null || i.join < courant.joinAt)) {
      courant.joinAt = i.join;
    }
    if (i.leave !== null && (courant.leaveAt === null || i.leave > courant.leaveAt)) {
      courant.leaveAt = i.leave;
    }
    courant.duree += i.duree;
    parDate.set(date, courant);
  }

  const jours = [...parDate.entries()]
    .map(([date, v]) => ({
      date,
      joinAt: v.joinAt,
      leaveAt: v.leaveAt,
      dureeMinutes: v.duree,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { jours, totalOrphelin };
}

/**
 * Réduit une ventilation aux trois champs historiques du participant.
 *
 * Conservés pour ne rien casser en aval — et calculés ICI, à partir de la
 * ventilation, plutôt que recalculés en parallèle dans chaque parseur. Deux
 * calculs du même total finiraient par diverger, et c'est le genre d'écart que
 * personne ne remarque : les deux nombres restent plausibles.
 */
export function agregerVentilation(
  jours: readonly PresenceJour[],
  totalOrphelin = 0,
): { joinAt: Date | null; leaveAt: Date | null; dureeMinutes: number } {
  let joinAt: Date | null = null;
  let leaveAt: Date | null = null;
  let dureeMinutes = totalOrphelin;

  for (const j of jours) {
    if (j.joinAt !== null && (joinAt === null || j.joinAt < joinAt)) joinAt = j.joinAt;
    if (j.leaveAt !== null && (leaveAt === null || j.leaveAt > leaveAt)) leaveAt = j.leaveAt;
    dureeMinutes += j.dureeMinutes;
  }

  return { joinAt, leaveAt, dureeMinutes };
}
