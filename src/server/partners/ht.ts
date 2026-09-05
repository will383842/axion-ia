/**
 * ht.ts — la dérivation du HT encaissé (REQ-INT-005, REQ-DM-018).
 *
 * Le montant qu'un apporteur commissionne est un HT. Ce que la banque encaisse est un
 * TTC. Entre les deux il y a une règle de trois, et le piège tient en un mot :
 * l'ARRONDI. Trois encaissements d'un tiers d'une facture à 120 000 TTC / 100 000 HT
 * rendent trois fois 33 333 — soit 99 999. Le centime manquant n'est pas une coquille
 * comptable : c'est une commission qui ne sera jamais versée, sur chaque facture
 * payée en plusieurs fois, indéfiniment.
 *
 * D'où la règle de REQ-INT-005, transcrite ici mot pour mot : « le dernier
 * encaissement soldant la facture absorbe le reliquat de sorte que Σ HT dérivés =
 * factureMontantHtCents ».
 *
 * 🔑 AUCUN TAUX DE TVA N'EST INFÉRÉ, NULLE PART. REQ-DM-018 l'interdit explicitement,
 * et la raison est concrète : une facture peut être assujettie (20 %), exonérée
 * (261-4-4°) ou en franchise (293 B), et le régime est SNAPSHOTÉ sur la facture
 * (`FactureFormation.regimeTva`). Reconstituer un taux depuis deux montants marcherait
 * — jusqu'à la première facture à taux mixte, où il donnerait un chiffre plausible et
 * faux. Le rapport HT/TTC est pris tel quel ; il n'a pas besoin d'être nommé.
 */

/**
 * Les trois montants de la facture dont la dérivation dépend. Volontairement une
 * FORME, pas le modèle Prisma : cette fonction doit rester appelable depuis un test
 * sans base, et depuis `payloads.ts` avec une vraie ligne. Le raccordement au modèle
 * réel se fait dans `payloads.ts`, où `tsc` le vérifie.
 */
export type MontantsFacture = {
  readonly montantHtCents: number;
  readonly montantTvaCents: number;
  /** Nullable en base : « Null pour les anciennes factures » (schema.prisma). */
  readonly montantTtcCents: number | null;
};

/**
 * Le TTC de la facture, avec le repli que REQ-DM-018 écrit : « repli montantHtCents +
 * montantTvaCents si montantTtcCents null ».
 */
export function ttcDeLaFacture(f: MontantsFacture): number {
  return f.montantTtcCents ?? f.montantHtCents + f.montantTvaCents;
}

export type EntreeDerivationHt = {
  readonly facture: MontantsFacture;
  /** Le TTC de CET encaissement (`Payment.amountCents`, qui est un TTC). */
  readonly montantEncaisseTtcCents: number;
  /** Le cumul encaissé sur la facture, CET encaissement COMPRIS. */
  readonly totalEncaisseTtcCents: number;
};

export type DerivationHt = {
  /** Le HT attribuable à cet encaissement. C'est lui que REQ-DM-018 fait voyager. */
  readonly amountHtCents: number;
  /** Vrai si cet encaissement solde la facture — c'est lui qui absorbe le reliquat. */
  readonly soldeLaFacture: boolean;
};

/** Le prorata d'un TTC sur le HT de la facture, ARRONDI VERS LE BAS (REQ-INT-005). */
function prorataPlancher(ttcPartiel: number, htFacture: number, ttcFacture: number): number {
  return Math.floor((ttcPartiel * htFacture) / ttcFacture);
}

/**
 * Le HT attribuable à un encaissement.
 *
 * ⚠️ CETTE FONCTION NE COMPLÈTE RIEN. Deux incohérences la font LEVER plutôt que
 * rendre un zéro : un TTC de facture nul face à un encaissement non nul, et un cumul
 * inférieur à l'encaissement courant. Dans les deux cas, la donnée d'entrée est
 * fausse ; un repli silencieux produirait une commission de zéro euro qu'aucune
 * console ne signalerait, et l'apporteur découvrirait le défaut sur sa fiche de paie.
 */
export function derivationHt(e: EntreeDerivationHt): DerivationHt {
  const ttcFacture = ttcDeLaFacture(e.facture);

  if (e.totalEncaisseTtcCents < e.montantEncaisseTtcCents) {
    throw new Error(
      `[partners] cumul encaissé (${e.totalEncaisseTtcCents}) inférieur à l'encaissement courant ` +
        `(${e.montantEncaisseTtcCents}) : le cumul DOIT inclure l'encaissement courant.`,
    );
  }

  if (ttcFacture <= 0) {
    // Une facture à zéro encaissée à zéro est cohérente (avoir soldé, geste
    // commercial) : elle rend zéro. Une facture à zéro RÉELLEMENT encaissée ne
    // l'est pas, et rien ici ne peut deviner sur quoi proratiser.
    if (e.montantEncaisseTtcCents === 0 && e.totalEncaisseTtcCents === 0) {
      return { amountHtCents: 0, soldeLaFacture: true };
    }
    throw new Error(
      `[partners] TTC de facture nul ou négatif (${ttcFacture}) face à un encaissement de ` +
        `${e.montantEncaisseTtcCents} : montants incohérents, aucune dérivation possible.`,
    );
  }

  const soldeLaFacture = e.totalEncaisseTtcCents >= ttcFacture;

  if (!soldeLaFacture) {
    return {
      amountHtCents: prorataPlancher(
        e.montantEncaisseTtcCents,
        e.facture.montantHtCents,
        ttcFacture,
      ),
      soldeLaFacture: false,
    };
  }

  // L'encaissement SOLDANT prend tout ce qui reste. « Ce qui reste » se calcule sur le
  // cumul ANTÉRIEUR, dérivé par la même règle de plancher que les encaissements
  // partiels — sans quoi les deux moitiés du calcul ne se rejoindraient pas.
  const anterieurTtc = e.totalEncaisseTtcCents - e.montantEncaisseTtcCents;
  const anterieurHt = prorataPlancher(
    Math.min(anterieurTtc, ttcFacture),
    e.facture.montantHtCents,
    ttcFacture,
  );

  return { amountHtCents: e.facture.montantHtCents - anterieurHt, soldeLaFacture: true };
}
