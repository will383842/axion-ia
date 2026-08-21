/**
 * Console éditoriale — l'analyse (§3, lot 3).
 *
 * Module PUR : il agrège des relevés déjà chargés. Aucun accès base.
 *
 * ── 🔴 La distinction qui porte tout le lot ───────────────────────────────
 *
 * > « Une métrique absente affiche « NON DISPONIBLE », jamais `0`. »
 *
 * C'est le critère 4, et c'est le plus facile à rater parce que JavaScript
 * pousse dans l'autre sens : `null + 5` vaut `5`, `[].reduce((a,b)=>a+b, 0)`
 * vaut `0`, et `Number(null)` vaut `0`. Un agrégat écrit naturellement REND
 * DONC ZÉRO là où il faudrait dire « je ne sais pas ».
 *
 * La différence n'est pas cosmétique. « 0 rendez-vous attribué » veut dire
 * que la publication n'a rien produit — on la juge, on change de format. « Non
 * disponible » veut dire qu'on n'a pas relevé — on ne sait rien, et prendre
 * une décision serait la prendre sur du vide. Confondre les deux, c'est
 * arbitrer sur des chiffres inventés.
 *
 * D'où le type `Agregat` ci-dessous : il ne rend jamais un nombre sans dire
 * combien de relevés l'ont nourri.
 */

/** Un relevé, réduit à ce que l'analyse manipule. */
export interface ReleveMetrique {
  publicationId: string;
  releveA: Date;
  impressions: number | null;
  reactions: number | null;
  commentaires: number | null;
  partages: number | null;
  clics: number | null;
  abonnesGagnes: number | null;
  vuesCompletes: number | null;
  ouvertures: number | null;
  rdvAttribues: number | null;
  devisAttribues: number | null;
}

/** Les métriques agrégeables, par leur clé. */
export const METRIQUES = [
  "impressions",
  "reactions",
  "commentaires",
  "partages",
  "clics",
  "abonnesGagnes",
  "vuesCompletes",
  "ouvertures",
  "rdvAttribues",
  "devisAttribues",
] as const;

export type CleMetrique = (typeof METRIQUES)[number];

/** Libellés humains — l'écran ne doit pas afficher `rdvAttribues`. */
export const LIBELLES: Record<CleMetrique, string> = {
  impressions: "Impressions",
  reactions: "Réactions",
  commentaires: "Commentaires",
  partages: "Partages",
  clics: "Clics",
  abonnesGagnes: "Abonnés gagnés",
  vuesCompletes: "Vues complètes",
  ouvertures: "Ouvertures",
  rdvAttribues: "Rendez-vous attribués",
  devisAttribues: "Devis attribués",
};

/**
 * Le résultat d'une agrégation.
 *
 * `valeur === null` signifie **non disponible**, et c'est un état à part
 * entière — pas un zéro déguisé. `nbReleves` dit sur combien de relevés la
 * valeur repose : un total nourri par 2 publications sur 74 n'a pas le même
 * sens qu'un total complet, et l'écran doit pouvoir le montrer.
 */
export interface Agregat {
  valeur: number | null;
  /** Combien de relevés portaient RÉELLEMENT cette métrique. */
  nbReleves: number;
  /** Combien auraient pu la porter. */
  nbAttendus: number;
}

/** Vrai quand l'agrégat ne repose sur rien. */
export function estNonDisponible(a: Agregat): boolean {
  return a.valeur === null;
}

/**
 * Formate un agrégat pour l'affichage.
 *
 * 🔴 Rend « non disponible » et non « 0 ». C'est le critère 4, littéralement.
 */
export function formaterAgregat(a: Agregat): string {
  if (a.valeur === null) return "non disponible";
  return a.valeur.toLocaleString("fr-FR");
}

/**
 * Somme une métrique sur un ensemble de relevés.
 *
 * 🔴 Rend `null` si AUCUN relevé ne la porte — et non `0`. C'est tout l'enjeu.
 * Un seul relevé renseigné suffit en revanche à produire un total : dire
 * « non disponible » alors qu'on sait quelque chose serait l'erreur inverse.
 */
export function sommer(releves: readonly ReleveMetrique[], cle: CleMetrique): Agregat {
  let total = 0;
  let nb = 0;
  for (const r of releves) {
    const v = r[cle];
    if (v === null || v === undefined) continue;
    total += v;
    nb += 1;
  }
  return { valeur: nb === 0 ? null : total, nbReleves: nb, nbAttendus: releves.length };
}

/**
 * Ne garde que le DERNIER relevé de chaque publication.
 *
 * Le critère 1 impose qu'un nouveau relevé n'écrase pas le précédent : on
 * accumule donc des lignes dans le temps. Mais additionner tous les relevés
 * d'une même publication COMPTERAIT PLUSIEURS FOIS ses impressions — un
 * relevé est un instantané cumulatif, pas un incrément.
 *
 * C'est le piège central de ce lot : l'historique est fait pour être gardé,
 * pas pour être sommé.
 */
export function derniersReleves(releves: readonly ReleveMetrique[]): ReleveMetrique[] {
  const parPublication = new Map<string, ReleveMetrique>();
  for (const r of releves) {
    const courant = parPublication.get(r.publicationId);
    if (!courant || r.releveA > courant.releveA) parPublication.set(r.publicationId, r);
  }
  return [...parPublication.values()];
}

// ── L'analyse par format ──────────────────────────────────────────────────

export interface LignePublicationMesuree {
  publicationId: string;
  familleNom: string | null;
  identite: "perso" | "pro";
  compteLibelle: string;
}

export interface LigneAnalyse {
  cle: string;
  libelle: string;
  nbPublications: number;
  /** La métrique de classement. */
  principal: Agregat;
  /** Les autres, pour le détail. */
  secondaires: Partial<Record<CleMetrique, Agregat>>;
}

/**
 * Classe les familles par rendez-vous attribués — critère 2 du lot 3.
 *
 * > « L'analyse par format classe les familles par RENDEZ-VOUS ATTRIBUÉS. »
 *
 * Et non par impressions : le §2 du plan est explicite, `rdvAttribues` est
 * « LA métrique qui compte ». Classer par impressions ferait remonter les
 * formats qui font du bruit plutôt que ceux qui font du chiffre.
 *
 * ⚠️ Les familles sans aucun relevé sont rendues en DERNIER, avec un agrégat
 * `null` — et non écartées. Les faire disparaître laisserait croire qu'elles
 * n'existent pas, alors qu'elles sont seulement non mesurées.
 */
export function analyserParFamille(
  publications: readonly LignePublicationMesuree[],
  releves: readonly ReleveMetrique[],
  metriquePrincipale: CleMetrique = "rdvAttribues",
): LigneAnalyse[] {
  const derniers = derniersReleves(releves);
  const relevesParPublication = new Map(derniers.map((r) => [r.publicationId, r]));

  const groupes = new Map<string, { libelle: string; releves: ReleveMetrique[]; nb: number }>();
  for (const p of publications) {
    const cle = p.familleNom ?? "__sans_famille__";
    const libelle = p.familleNom ?? "Texte seul";
    const groupe = groupes.get(cle) ?? { libelle, releves: [], nb: 0 };
    groupe.nb += 1;
    const r = relevesParPublication.get(p.publicationId);
    if (r) groupe.releves.push(r);
    groupes.set(cle, groupe);
  }

  const lignes: LigneAnalyse[] = [...groupes.entries()].map(([cle, g]) => {
    const secondaires: Partial<Record<CleMetrique, Agregat>> = {};
    for (const m of METRIQUES) {
      if (m === metriquePrincipale) continue;
      secondaires[m] = sommer(g.releves, m);
    }
    return {
      cle,
      libelle: g.libelle,
      nbPublications: g.nb,
      principal: sommer(g.releves, metriquePrincipale),
      secondaires,
    };
  });

  // Les mesurées d'abord, par valeur décroissante ; les non mesurées ensuite,
  // par ordre alphabétique pour que l'affichage soit stable.
  return lignes.sort((a, b) => {
    const va = a.principal.valeur;
    const vb = b.principal.valeur;
    if (va === null && vb === null) return a.libelle.localeCompare(b.libelle);
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va || a.libelle.localeCompare(b.libelle);
  });
}

// ── La comparaison perso / pro ────────────────────────────────────────────

export interface SerieIdentite {
  identite: "perso" | "pro";
  nbPublications: number;
  agregats: Record<CleMetrique, Agregat>;
}

export interface ComparaisonIdentites {
  series: SerieIdentite[];
  /**
   * Maximum par métrique, TOUTES identités confondues — c'est ce qui met les
   * deux séries « sur la même échelle » (critère 3). Sans cette base commune,
   * chaque barre serait normalisée sur son propre maximum et deux séries très
   * inégales paraîtraient équivalentes.
   */
  echelle: Record<CleMetrique, number | null>;
}

/**
 * Compare les identités perso et pro — critère 3 du lot 3.
 *
 * > « La comparaison perso/pro affiche les deux séries SUR LA MÊME ÉCHELLE. »
 *
 * L'échelle commune est calculée ici plutôt qu'à l'affichage : c'est une
 * décision d'analyse, pas de mise en page, et la laisser au composant, c'est
 * la voir diverger entre deux écrans.
 */
export function comparerIdentites(
  publications: readonly LignePublicationMesuree[],
  releves: readonly ReleveMetrique[],
): ComparaisonIdentites {
  const derniers = derniersReleves(releves);
  const relevesParPublication = new Map(derniers.map((r) => [r.publicationId, r]));

  const series: SerieIdentite[] = (["perso", "pro"] as const).map((identite) => {
    const lesSiennes = publications.filter((p) => p.identite === identite);
    const leursReleves = lesSiennes
      .map((p) => relevesParPublication.get(p.publicationId))
      .filter((r): r is ReleveMetrique => r !== undefined);

    const agregats = {} as Record<CleMetrique, Agregat>;
    for (const m of METRIQUES) agregats[m] = sommer(leursReleves, m);

    return { identite, nbPublications: lesSiennes.length, agregats };
  });

  const echelle = {} as Record<CleMetrique, number | null>;
  for (const m of METRIQUES) {
    const valeurs = series.map((s) => s.agregats[m].valeur).filter((v): v is number => v !== null);
    echelle[m] = valeurs.length === 0 ? null : Math.max(...valeurs);
  }

  return { series, echelle };
}

/**
 * Part d'une valeur sur l'échelle commune, en pourcentage.
 *
 * Rend `null` quand la valeur est absente OU l'échelle inconnue : une barre
 * de largeur nulle se confondrait avec une mesure à zéro.
 */
export function partSurEchelle(valeur: number | null, echelle: number | null): number | null {
  if (valeur === null || echelle === null || echelle === 0) return null;
  return Math.round((valeur / echelle) * 100);
}

/**
 * Le ratio perso/pro, en points de pourcentage.
 *
 * Sert l'alerte `derive-identite` du §9, dont le seuil est ±10 points.
 * Rend `null` s'il n'y a aucune publication : un ratio sur zéro n'existe pas.
 */
export function ratioIdentite(
  publications: readonly LignePublicationMesuree[],
): { perso: number; pro: number } | null {
  if (publications.length === 0) return null;
  const perso = publications.filter((p) => p.identite === "perso").length;
  return {
    perso: Math.round((perso / publications.length) * 100),
    pro: Math.round(((publications.length - perso) / publications.length) * 100),
  };
}
