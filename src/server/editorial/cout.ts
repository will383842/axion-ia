/**
 * Console éditoriale — le coût par résultat (lot 6, « achat média »).
 *
 * Module PUR.
 *
 * Le §1 ter classe l'achat média en « crochets dans le modèle, rien à
 * l'écran » : `EdCompteType.publicitaire`, `EdAssetUsage.payant`, et surtout
 * `EdPublication.coutCentimes`, dont le commentaire dit le but exact —
 * « rend comparable un post gratuit et une campagne payante ».
 *
 * Ce fichier réalise cette comparabilité. C'est tout ce que le lot 6 peut
 * livrer aujourd'hui, et c'est déjà l'essentiel : sans coût par résultat, on
 * compare un post qui a coûté zéro à une campagne qui a coûté trois cents
 * euros comme s'ils jouaient dans la même catégorie.
 *
 * ── 🔴 Trois pièges d'arithmétique, tous silencieux ───────────────────────
 *
 * 1. **Diviser par zéro résultat.** Une campagne à 300 € qui n'a produit
 *    aucun rendez-vous n'a pas un coût « infini » : elle a un coût
 *    INDÉTERMINÉ. `Infinity` s'affiche mal, se trie mal, et casse tout calcul
 *    en aval.
 * 2. **Confondre gratuit et non mesuré.** Un post organique coûte réellement
 *    zéro : son coût par rendez-vous est zéro, pas « non disponible ». C'est
 *    l'inverse exact de la règle du lot 3 sur les métriques, et les deux
 *    doivent coexister sans se contaminer.
 * 3. **Les centimes.** Tout est en centimes en base — diviser des centimes
 *    par des rendez-vous donne des centimes par rendez-vous, pas des euros.
 *    L'erreur d'un facteur 100 sur un coût d'acquisition ne se voit pas :
 *    « 4,50 » et « 450 » sont tous deux plausibles.
 */

/** Une publication, réduite à ce que le calcul de coût manipule. */
export interface PublicationCoutee {
  publicationId: string;
  coutCentimes: number;
  identite: "perso" | "pro";
  /** `organique`, `payant` ou `mixte` — l'usage des assets portés. */
  usage: "organique" | "payant" | "mixte";
  /** Résultats attribués, `null` si non relevé. */
  rdvAttribues: number | null;
  devisAttribues: number | null;
  clics: number | null;
  impressions: number | null;
}

export type EtatCout = "gratuit" | "calcule" | "indetermine" | "non_mesure";

export interface CoutParResultat {
  /** En CENTIMES. `null` quand l'état n'est pas `gratuit` ni `calcule`. */
  centimes: number | null;
  etat: EtatCout;
  /** Ce que l'état veut dire, en français. */
  explication: string;
}

/**
 * Coût par résultat, en centimes.
 *
 * Quatre états, et ils ne se confondent pas :
 *
 * | État           | Quand                                    | Ce qu'on en fait          |
 * | -------------- | ---------------------------------------- | ------------------------- |
 * | `gratuit`      | coût nul                                 | comparable, vaut 0        |
 * | `calcule`      | coût > 0 et résultats > 0                | comparable                |
 * | `indetermine`  | coût > 0 et résultats = 0                | **on a payé pour rien**   |
 * | `non_mesure`   | résultats non relevés                    | on ne sait pas            |
 */
export function coutParResultat(coutCentimes: number, resultats: number | null): CoutParResultat {
  if (resultats === null) {
    return {
      centimes: null,
      etat: "non_mesure",
      explication:
        "Résultats non relevés : le coût par résultat ne peut pas être calculé. " +
        "Saisissez un relevé avant de juger cette dépense.",
    };
  }

  if (coutCentimes === 0) {
    // 🔴 Zéro euro est un COÛT, pas une absence de donnée. Un post organique
    // coûte réellement zéro, et c'est comparable.
    return {
      centimes: 0,
      etat: "gratuit",
      explication: "Publication organique : aucun budget engagé.",
    };
  }

  if (resultats === 0) {
    // 🔴 Ni `Infinity`, ni `null` : un état À PART. On a payé et rien n'est
    // venu — c'est une information forte, pas une absence d'information.
    return {
      centimes: null,
      etat: "indetermine",
      explication:
        `${formaterEuros(coutCentimes)} engagés pour aucun résultat attribué. ` +
        `Le coût par résultat n'existe pas — la dépense, si.`,
    };
  }

  return {
    centimes: Math.round(coutCentimes / resultats),
    etat: "calcule",
    explication: "",
  };
}

/**
 * Centimes → euros lisibles.
 *
 * ⚠️ C'est ici que se joue le facteur 100. Tout est en centimes en base ; un
 * affichage qui l'oublierait donnerait « 45 000 € » pour 450 €, ou l'inverse.
 */
export function formaterEuros(centimes: number | null): string {
  if (centimes === null) return "non disponible";
  return (centimes / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: centimes % 100 === 0 ? 0 : 2,
  });
}

/** Formate un coût par résultat, état compris. */
export function formaterCoutParResultat(c: CoutParResultat): string {
  if (c.etat === "gratuit") return "gratuit";
  if (c.etat === "indetermine") return "aucun résultat";
  if (c.etat === "non_mesure") return "non mesuré";
  return formaterEuros(c.centimes);
}

// ── La comparaison organique / payant ─────────────────────────────────────

export interface BilanUsage {
  usage: "organique" | "payant" | "mixte";
  nbPublications: number;
  /** Somme engagée, en centimes. Toujours connue — un coût non saisi vaut 0. */
  coutTotalCentimes: number;
  /** Résultats attribués, `null` si aucun relevé. */
  resultats: number | null;
  /** Combien de publications ont été relevées. */
  nbMesurees: number;
  coutMoyen: CoutParResultat;
}

/**
 * Compare l'organique au payant — la question que le lot 6 pose vraiment.
 *
 * ⚠️ Le coût total est TOUJOURS connu : `coutCentimes` a une valeur par défaut
 * de `0` en base, donc « non saisi » et « gratuit » sont indiscernables. C'est
 * une limite du modèle, pas du calcul, et elle est acceptable : une campagne
 * payante dont on oublie de saisir le budget est une erreur de saisie visible
 * (elle apparaîtra en « gratuit » dans un groupe `payant`), là où une métrique
 * non relevée est le cas NORMAL.
 */
export function comparerUsages(
  publications: readonly PublicationCoutee[],
  metrique: "rdvAttribues" | "devisAttribues" | "clics" = "rdvAttribues",
): BilanUsage[] {
  const usages: ("organique" | "payant" | "mixte")[] = ["organique", "payant", "mixte"];

  return usages
    .map((usage) => {
      const lesSiennes = publications.filter((p) => p.usage === usage);
      const coutTotalCentimes = lesSiennes.reduce((s, p) => s + p.coutCentimes, 0);

      let resultats: number | null = null;
      let nbMesurees = 0;
      for (const p of lesSiennes) {
        const v = p[metrique];
        if (v === null) continue;
        resultats = (resultats ?? 0) + v;
        nbMesurees += 1;
      }

      return {
        usage,
        nbPublications: lesSiennes.length,
        coutTotalCentimes,
        resultats,
        nbMesurees,
        coutMoyen: coutParResultat(coutTotalCentimes, resultats),
      };
    })
    .filter((b) => b.nbPublications > 0);
}

/**
 * Les publications payantes qui n'ont rien rapporté.
 *
 * C'est la liste qu'on veut voir en premier quand on fait de l'achat média :
 * de l'argent engagé sans résultat attribué. Triée par montant décroissant —
 * la plus coûteuse d'abord, parce que c'est celle qu'on arrête en premier.
 */
export function depensesSansResultat(
  publications: readonly PublicationCoutee[],
): PublicationCoutee[] {
  return publications
    .filter((p) => p.coutCentimes > 0 && p.rdvAttribues === 0)
    .sort((a, b) => b.coutCentimes - a.coutCentimes);
}

/** Somme engagée sur un ensemble, en centimes. */
export function budgetTotal(publications: readonly PublicationCoutee[]): number {
  return publications.reduce((s, p) => s + p.coutCentimes, 0);
}
