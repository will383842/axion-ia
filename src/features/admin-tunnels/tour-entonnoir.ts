/**
 * Tunnel Tour de France IA — l'AGRÉGATION, pure et testée (2026-10-26).
 *
 * Aucune lecture base ici : `tour.ts` charge, ce module calcule.
 *
 * Le parcours, et ce que chaque marche mesure VRAIMENT :
 *
 *   landing `/tourdefrance-ia`  →  bouton « Je veux mon audit offert »  →  page de réservation
 *   `/fr/appel/tour-de-france-ia?depuis=tdf-…`  →  rendez-vous pris  →  maintenu
 *   →  honoré.
 *
 * 🔴 LES VISITES DE LA LANDING NE SONT PAS MESURÉES, PAR CHOIX. La page ne porte
 * aucune balise ni mesure d'audience (verrou `le-tour-est-ouvert.spec.ts`, et la
 * politique de confidentialité l'écrit : elle « ne collecte elle-même aucune
 * donnée supplémentaire »). L'écran le dit ; il n'affiche jamais un zéro à la
 * place. Changer cela est une décision de Will, pas un détail de code.
 *
 * Deux sources, deux unités, dites à l'écran :
 *   · les ARRIVÉES sur la page de réservation (= clics « Je veux mon audit offert »,
 *     qui demandent la venue du Tour chez vous) viennent
 *     des balises anonymes (`funnel_events`, tunnel `tour`) et se comptent en
 *     SESSIONS ;
 *   · les RENDEZ-VOUS viennent de `calendly_events` (type `tour_de_france_ia`)
 *     par le bilan commun des rendez-vous (`agregerBilan`), et se comptent en
 *     RÉSERVATIONS — mêmes règles que l'écran « Ce que rapporte chaque
 *     rendez-vous » : un report ne compte qu'une fois, une annulation reste une
 *     annulation.
 *
 * 🔴 « NON MESURÉ » N'EST JAMAIS UN ZÉRO : une lecture en échec rend `null`.
 *
 * Le lien entre les deux, bouton par bouton : le `depuis` du bouton
 * (`tdf-heros`) est la `placement` de la balise ET la fin de l'`utm_content` du
 * rendez-vous (`tour:tdf-heros`).
 */

import {
  libelleEmplacement,
  type BilanType,
  type CompteursBilan,
} from "@/features/admin-rendezvous/bilan-rendez-vous";

/** Sous ce nombre d'arrivées, une transformation en pourcentage est du bruit. */
export const SEUIL_TRANSFORMATION = 5;

/** Une balise lue en base (`funnel_events`, tunnel `tour`, « Call Booking Viewed »). */
export interface LigneBaliseTour {
  readonly sessionId: string;
  readonly placement: string | null;
}

export type Cellule = number | null;

export interface CompteursRdvTour {
  readonly pris: number;
  /** Pris et non annulés : le rendez-vous tient (à venir ou passé). */
  readonly maintenus: number;
  readonly honores: number;
  readonly absents: number;
  readonly annules: number;
  /** Rattachés (validés) à une fiche du dossier client. */
  readonly fiches: number;
}

export interface LigneBoutonTour {
  /** Le `depuis` du bouton (`tdf-heros`), `null` = non renseigné. */
  readonly cle: string | null;
  readonly libelle: string;
  readonly arrivees: Cellule;
  readonly pris: Cellule;
  readonly maintenus: Cellule;
}

export interface TableauTour {
  /** Toujours `null` : la landing ne porte aucune mesure (voir l'en-tête). */
  readonly visites: null;
  /** Sessions arrivées sur la page de réservation du Tour ; `null` = non mesuré. */
  readonly arrivees: Cellule;
  /** `null` = lecture des rendez-vous en échec. */
  readonly rdv: CompteursRdvTour | null;
  /** Rendez-vous pris / arrivées, en %, arrondi à l'unité ; `null` si trop peu ou non mesuré. */
  readonly transformation: number | null;
  readonly parBouton: readonly LigneBoutonTour[];
}

/** `tour:tdf-heros` → `tdf-heros` ; `tour` seul ou vide → `null`. */
export function boutonDeUtmContent(utmContent: string | null | undefined): string | null {
  const v = utmContent?.trim().toLowerCase();
  if (!v) return null;
  const i = v.indexOf(":");
  if (i === -1) return null;
  const bouton = v.slice(i + 1).trim();
  return bouton ? bouton : null;
}

function normaliserBouton(placement: string | null | undefined): string | null {
  const v = placement?.trim().toLowerCase();
  return v ? v : null;
}

function rdvDesCompteurs(c: CompteursBilan): CompteursRdvTour {
  return {
    pris: c.reserves,
    maintenus: Math.max(0, c.reserves - c.annules),
    honores: c.honores,
    absents: c.absents,
    annules: c.annules,
    fiches: c.fiches,
  };
}

const ZERO: CompteursBilan = {
  reserves: 0,
  honores: 0,
  absents: 0,
  annules: 0,
  fiches: 0,
  clients: 0,
};

/**
 * Construit le tableau du Tour.
 *
 * @param balises  `null` = lecture en échec (non mesuré) ; `[]` = personne n'est arrivé.
 * @param bilanTour  le groupe `tour_de_france_ia` du bilan ; `undefined` = aucun
 *   rendez-vous (le bilan omet le Tour sans réservation) ; `null` = lecture en échec.
 */
export function construireTableauTour(
  balises: readonly LigneBaliseTour[] | null,
  bilanTour: BilanType | undefined | null,
): TableauTour {
  // Une session = une arrivée, comptée sur son PREMIER bouton connu.
  const boutonParSession = new Map<string, string | null>();
  for (const b of balises ?? []) {
    const bouton = normaliserBouton(b.placement);
    const deja = boutonParSession.get(b.sessionId);
    if (deja === undefined || (deja === null && bouton !== null)) {
      boutonParSession.set(b.sessionId, bouton);
    }
  }
  const arrivees: Cellule = balises === null ? null : boutonParSession.size;

  const rdv: CompteursRdvTour | null =
    bilanTour === null ? null : rdvDesCompteurs(bilanTour?.total ?? ZERO);

  const transformation =
    arrivees !== null && rdv !== null && arrivees >= SEUIL_TRANSFORMATION
      ? Math.round((rdv.pris / arrivees) * 100)
      : null;

  // Par bouton : l'union des boutons vus côté balises et côté rendez-vous.
  const lignes = new Map<string, { cle: string | null; arrivees: number; rdv: CompteursBilan }>();
  const ligne = (cle: string | null) => {
    const k = cle ?? "";
    let l = lignes.get(k);
    if (!l) {
      l = { cle, arrivees: 0, rdv: { ...ZERO } };
      lignes.set(k, l);
    }
    return l;
  };
  for (const bouton of boutonParSession.values()) ligne(bouton).arrivees += 1;
  for (const e of bilanTour?.emplacements ?? []) {
    const l = ligne(boutonDeUtmContent(e.cle));
    l.rdv.reserves += e.compteurs.reserves;
    l.rdv.annules += e.compteurs.annules;
  }

  const parBouton: LigneBoutonTour[] = [...lignes.values()]
    .map((l) => ({
      cle: l.cle,
      libelle: l.cle ? libelleEmplacement(l.cle) : "Non renseigné",
      arrivees: balises === null ? null : l.arrivees,
      pris: rdv === null ? null : l.rdv.reserves,
      maintenus: rdv === null ? null : Math.max(0, l.rdv.reserves - l.rdv.annules),
    }))
    .sort(
      (a, b) =>
        (b.pris ?? 0) - (a.pris ?? 0) ||
        (b.arrivees ?? 0) - (a.arrivees ?? 0) ||
        (a.cle ?? "~").localeCompare(b.cle ?? "~"),
    );

  return { visites: null, arrivees, rdv, transformation, parBouton };
}
