/**
 * Agrégation des balises de tunnel en lectures exploitables.
 *
 * ── Pourquoi une fonction pure, séparée de la page ────────────────────────
 * Un taux de conversion faux est pire qu'absent : il oriente des décisions
 * publicitaires, donc de l'argent. Le calcul est donc isolé de tout accès base
 * et de tout rendu, pour être vérifiable ligne à ligne par des tests.
 *
 * ── Le piège central : la BASE d'un pourcentage ───────────────────────────
 * Une session qui arrive directement sur `/simulateur` n'a jamais vu la page
 * publicitaire. La compter au dénominateur de « clics sur le bouton de la
 * page pub » afficherait un taux effondré, sans que rien ne soit cassé.
 *
 * D'où DEUX entonnoirs distincts, chacun avec sa propre base :
 *   - l'entonnoir publicitaire ne compte que les sessions ayant vu la page ;
 *   - l'entonnoir questionnaire ne compte que celles ayant ouvert le
 *     questionnaire, d'où qu'elles viennent.
 *
 * Ne jamais les fusionner « pour simplifier » : ce serait mélanger deux
 * populations et rendre les deux taux faux à la fois.
 */

/** Projection minimale d'une ligne de `funnel_events`. */
export type LigneTunnel = {
  funnel: string;
  event: string;
  sessionId: string;
  step: string | null;
  stepIndex: number | null;
  deviceType: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  gainBucket: string | null;
  sector: string | null;
  createdAt: Date;
};

export type EtapeEntonnoir = {
  cle: string;
  libelle: string;
  sessions: number;
  /** Part des sessions de la BASE de cet entonnoir, en pourcentage. */
  partDepuisBase: number;
  /** Part des sessions ayant franchi l'étape précédente, en pourcentage. */
  partDepuisPrecedente: number;
  /** Sessions perdues entre l'étape précédente et celle-ci. */
  perdues: number;
};

export type Entonnoir = {
  titre: string;
  /** Ce que compte la base — affiché tel quel pour qu'aucun taux ne soit lu de travers. */
  base: string;
  etapes: EtapeEntonnoir[];
};

export type AbandonEcran = {
  step: string;
  stepIndex: number;
  /** Sessions ayant répondu à cet écran. */
  atteintes: number;
  /** Parmi elles, celles qui ont répondu à un écran suivant ou terminé. */
  poursuivies: number;
  /** Part des sessions qui s'arrêtent ici, en pourcentage. */
  partAbandon: number;
};

export type LigneRepartition = {
  cle: string;
  sessions: number;
  termines: number;
  rapports: number;
  /** Rapports demandés rapportés aux sessions, en pourcentage. */
  partRapport: number;
};

/** Statistiques d'un tunnel pris isolément. */
export type StatsTunnel = {
  cle: string;
  libelle: string;
  sessions: number;
  questionnairesOuverts: number;
  questionnairesTermines: number;
  rapportsDemandes: number;
  rappelsDemandes: number;
  /** Rapports demandés rapportés aux sessions du tunnel, en pourcentage. */
  partRapport: number;
};

export type SyntheseTunnels = {
  sessions: number;
  sessionsPub: number;
  questionnairesOuverts: number;
  questionnairesTermines: number;
  rapportsDemandes: number;
  rappelsDemandes: number;
  /**
   * Statistiques par tunnel, chaque session attribuée au tunnel où elle a
   * COMMENCÉ.
   *
   * 🔴 Attribution à l'entrée, et non présence : une session qui voit la page
   * publicitaire puis passe au questionnaire touche deux tunnels. La compter
   * dans les deux ferait une somme supérieure au total et rendrait tout
   * pourcentage faux. Attribuée à son entrée, la somme des tunnels égale
   * exactement le nombre de sessions — et la question à laquelle ce tableau
   * répond devient « quelle porte d'entrée amène, et convertit ».
   */
  parTunnel: StatsTunnel[];
  entonnoirs: Entonnoir[];
  abandonParEcran: AbandonEcran[];
  parCampagne: LigneRepartition[];
  parAppareil: LigneRepartition[];
  parSecteur: LigneRepartition[];
  parTranche: Array<{ cle: string; rapports: number }>;
};

/** Noms lisibles des tunnels. Une clé inconnue s'affiche telle quelle. */
const LIBELLES_TUNNEL: Readonly<Record<string, string>> = {
  diagnostic: "Page publicitaire (/diagnostic)",
  simulateur: "Questionnaire nu (/simulateur)",
  roi: "Questionnaire public (/roi)",
};

const E = {
  vue: "Landing Viewed",
  video: "Landing Video Played",
  clic: "Landing CTA Clicked",
  demarre: "Simulator Started",
  ecran: "Simulator Step",
  termine: "Simulator Completed",
  rapport: "Simulator Report Requested",
  rappel: "Simulator Callback Requested",
} as const;

/** Pourcentage arrondi au dixième, 0 quand la base est vide. */
function part(numerateur: number, denominateur: number): number {
  if (denominateur <= 0) return 0;
  return Math.round((numerateur / denominateur) * 1000) / 10;
}

/** Regroupe les lignes par session, en retenant ce qui sert au calcul. */
type Session = {
  evenements: Set<string>;
  /** Rang du dernier écran répondu — sert à situer l'abandon. */
  ecransRepondus: Map<number, string>;
  campagne: string | null;
  source: string | null;
  appareil: string | null;
  secteur: string | null;
  tranche: string | null;
  aVuLaPub: boolean;
  /**
   * Tunnel où la session a commencé, et l'instant correspondant.
   *
   * 🔴 Déterminé par la DATE la plus ancienne, jamais par l'ordre d'arrivée
   * des lignes. Se fier à l'ordre marcherait tant que l'appelant trie par
   * date croissante — et attribuerait silencieusement toutes les sessions au
   * mauvais tunnel le jour où quelqu'un changerait ce tri.
   */
  tunnelEntree: string | null;
  debut: number;
};

function grouper(lignes: readonly LigneTunnel[]): Map<string, Session> {
  const sessions = new Map<string, Session>();

  for (const l of lignes) {
    let s = sessions.get(l.sessionId);
    if (!s) {
      s = {
        evenements: new Set(),
        ecransRepondus: new Map(),
        campagne: null,
        source: null,
        appareil: null,
        secteur: null,
        tranche: null,
        aVuLaPub: false,
        tunnelEntree: null,
        debut: Number.POSITIVE_INFINITY,
      };
      sessions.set(l.sessionId, s);
    }

    s.evenements.add(l.event);
    const instant = l.createdAt.getTime();
    if (instant < s.debut) {
      s.debut = instant;
      s.tunnelEntree = l.funnel;
    }
    if (l.event === E.vue) s.aVuLaPub = true;
    if (l.event === E.ecran && typeof l.stepIndex === "number" && l.step) {
      s.ecransRepondus.set(l.stepIndex, l.step);
    }

    // Première valeur non vide rencontrée : les balises d'une même session
    // portent la même attribution, mais les premières (vue de page) n'ont pas
    // encore le secteur ni la tranche, qui n'existent qu'en fin de parcours.
    s.campagne ??= l.utmCampaign;
    s.source ??= l.utmSource;
    s.appareil ??= l.deviceType;
    s.secteur ??= l.sector;
    s.tranche ??= l.gainBucket;
  }

  return sessions;
}

/** Construit un entonnoir à partir d'une base et d'une suite d'étapes. */
function entonnoir(
  titre: string,
  base: string,
  sessions: readonly Session[],
  etapes: ReadonlyArray<{ cle: string; libelle: string; present: (s: Session) => boolean }>,
): Entonnoir {
  const total = sessions.length;
  let precedent = total;

  return {
    titre,
    base,
    etapes: etapes.map((e) => {
      const compte = sessions.filter(e.present).length;
      const ligne: EtapeEntonnoir = {
        cle: e.cle,
        libelle: e.libelle,
        sessions: compte,
        partDepuisBase: part(compte, total),
        partDepuisPrecedente: part(compte, precedent),
        perdues: Math.max(0, precedent - compte),
      };
      precedent = compte;
      return ligne;
    }),
  };
}

/** Répartition d'une dimension, triée par volume décroissant. */
function repartition(
  sessions: readonly Session[],
  cleDe: (s: Session) => string | null,
  etiquetteVide: string,
): LigneRepartition[] {
  const paniers = new Map<string, { sessions: number; termines: number; rapports: number }>();

  for (const s of sessions) {
    const cle = cleDe(s) ?? etiquetteVide;
    const p = paniers.get(cle) ?? { sessions: 0, termines: 0, rapports: 0 };
    p.sessions += 1;
    if (s.evenements.has(E.termine)) p.termines += 1;
    if (s.evenements.has(E.rapport)) p.rapports += 1;
    paniers.set(cle, p);
  }

  return [...paniers.entries()]
    .map(([cle, p]) => ({ cle, ...p, partRapport: part(p.rapports, p.sessions) }))
    .sort((a, b) => b.sessions - a.sessions || a.cle.localeCompare(b.cle));
}

/**
 * Courbe d'abandon écran par écran.
 *
 * C'est la lecture la plus actionnable du tableau de bord : elle désigne la
 * question précise qui fait décrocher. Une session « poursuit » si elle a
 * répondu à un écran de rang STRICTEMENT supérieur, ou si elle a terminé —
 * le dernier écran n'a pas de suivant, et sans cette seconde condition il
 * afficherait 100 % d'abandon alors qu'il convertit.
 */
function abandons(sessions: readonly Session[]): AbandonEcran[] {
  const paniers = new Map<number, { step: string; atteintes: number; poursuivies: number }>();

  for (const s of sessions) {
    if (s.ecransRepondus.size === 0) continue;
    const rangs = [...s.ecransRepondus.keys()];
    const maxRang = Math.max(...rangs);
    const aTermine = s.evenements.has(E.termine);

    for (const [rang, step] of s.ecransRepondus) {
      const p = paniers.get(rang) ?? { step, atteintes: 0, poursuivies: 0 };
      p.atteintes += 1;
      if (rang < maxRang || aTermine) p.poursuivies += 1;
      paniers.set(rang, p);
    }
  }

  return [...paniers.entries()]
    .map(([stepIndex, p]) => ({
      step: p.step,
      stepIndex,
      atteintes: p.atteintes,
      poursuivies: p.poursuivies,
      partAbandon: part(p.atteintes - p.poursuivies, p.atteintes),
    }))
    .sort((a, b) => a.stepIndex - b.stepIndex);
}

/** Statistiques par tunnel d'entrée, triées par volume décroissant. */
function parTunnel(sessions: readonly Session[]): StatsTunnel[] {
  const paniers = new Map<string, StatsTunnel>();

  for (const s of sessions) {
    const cle = s.tunnelEntree ?? "inconnu";
    const p =
      paniers.get(cle) ??
      ({
        cle,
        libelle: LIBELLES_TUNNEL[cle] ?? cle,
        sessions: 0,
        questionnairesOuverts: 0,
        questionnairesTermines: 0,
        rapportsDemandes: 0,
        rappelsDemandes: 0,
        partRapport: 0,
      } satisfies StatsTunnel);

    p.sessions += 1;
    if (s.evenements.has(E.demarre)) p.questionnairesOuverts += 1;
    if (s.evenements.has(E.termine)) p.questionnairesTermines += 1;
    if (s.evenements.has(E.rapport)) p.rapportsDemandes += 1;
    if (s.evenements.has(E.rappel)) p.rappelsDemandes += 1;
    paniers.set(cle, p);
  }

  return [...paniers.values()]
    .map((p) => ({ ...p, partRapport: part(p.rapportsDemandes, p.sessions) }))
    .sort((a, b) => b.sessions - a.sessions || a.cle.localeCompare(b.cle));
}

/** Transforme les balises brutes en synthèse affichable. */
export function agregerTunnels(lignes: readonly LigneTunnel[]): SyntheseTunnels {
  const toutes = [...grouper(lignes).values()];
  const vuesPub = toutes.filter((s) => s.aVuLaPub);
  const ouvertes = toutes.filter((s) => s.evenements.has(E.demarre));

  const a = (e: string) => (s: Session) => s.evenements.has(e);

  return {
    sessions: toutes.length,
    sessionsPub: vuesPub.length,
    questionnairesOuverts: ouvertes.length,
    questionnairesTermines: toutes.filter(a(E.termine)).length,
    rapportsDemandes: toutes.filter(a(E.rapport)).length,
    rappelsDemandes: toutes.filter(a(E.rappel)).length,
    parTunnel: parTunnel(toutes),
    entonnoirs: [
      entonnoir(
        "Depuis la page publicitaire",
        "sessions ayant affiché la page publicitaire",
        vuesPub,
        [
          { cle: "vue", libelle: "Page affichée", present: a(E.vue) },
          { cle: "video", libelle: "Vidéo lancée", present: a(E.video) },
          { cle: "clic", libelle: "Bouton cliqué", present: a(E.clic) },
          { cle: "demarre", libelle: "Questionnaire ouvert", present: a(E.demarre) },
          { cle: "termine", libelle: "Questionnaire terminé", present: a(E.termine) },
          { cle: "rapport", libelle: "Rapport demandé", present: a(E.rapport) },
          { cle: "rappel", libelle: "Rappel demandé", present: a(E.rappel) },
        ],
      ),
      entonnoir(
        "Questionnaire, toutes origines",
        "sessions ayant ouvert le questionnaire",
        ouvertes,
        [
          { cle: "demarre", libelle: "Questionnaire ouvert", present: a(E.demarre) },
          { cle: "termine", libelle: "Questionnaire terminé", present: a(E.termine) },
          { cle: "rapport", libelle: "Rapport demandé", present: a(E.rapport) },
          { cle: "rappel", libelle: "Rappel demandé", present: a(E.rappel) },
        ],
      ),
    ],
    abandonParEcran: abandons(toutes),
    parCampagne: repartition(toutes, (s) => s.campagne, "Sans campagne"),
    parAppareil: repartition(toutes, (s) => s.appareil, "Inconnu"),
    parSecteur: repartition(
      toutes.filter((s) => s.secteur !== null),
      (s) => s.secteur,
      "Non renseigné",
    ),
    parTranche: [
      ...toutes
        .filter((s) => s.tranche !== null && s.evenements.has(E.rapport))
        .reduce((acc, s) => {
          const cle = s.tranche as string;
          acc.set(cle, (acc.get(cle) ?? 0) + 1);
          return acc;
        }, new Map<string, number>())
        .entries(),
    ]
      .map(([cle, rapports]) => ({ cle, rapports }))
      .sort((x, y) => y.rapports - x.rapports),
  };
}
